import path from 'node:path';
import { cp, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { Catalog } from '../storage/catalog.ts';
import { loadSource, revision, sourceGraph, exists, sourceFiles, inside } from '../storage/sources.ts';
import { identifier, normalizePosition, type Position } from '../shared/manifest.ts';
import { appRoot, compile } from './vite.ts';
import ts from 'typescript';

export class Presentations {
  readonly catalog: Catalog;
  readonly positions = new Map<string, Position>();
  constructor(readonly dataDir: string) {this.catalog = new Catalog(dataDir);}
  async register(directory: string) {
    const source = await realpath(directory), {manifest} = await loadSource(source);
    return this.catalog.register(manifest.id, manifest.title, source, await revision(source));
  }
  async create({id, title, theme = 'editorial', directory}: {id: string; title: string; theme?: 'editorial' | 'midnight'; directory?: string}) {
    identifier.parse(id);
    if (this.catalog.list().some(d => d.id === id)) throw new Error(`Presentation already exists: ${id}`);
    const destination = path.resolve(directory ?? path.join(this.dataDir, 'presentations', id));
    if (await exists(destination)) throw new Error(`Destination already exists: ${destination}`);
    await cp(path.join(appRoot, 'templates/story'), destination, {recursive: true, errorOnExist: true});
    const manifest = JSON.parse(await readFile(path.join(destination, 'deck.json'), 'utf8'));
    manifest.id = id; manifest.title = title; manifest.slides[0].title = title;
    await writeFile(path.join(destination, 'deck.json'), JSON.stringify(manifest, null, 2) + '\n');
    await cp(path.join(appRoot, 'templates/brands', `${theme}.json`), path.join(destination, 'brand.json'));
    return this.register(destination);
  }
  async inspect(id: string) {
    const deck = this.catalog.get(id), {manifest, brand} = await loadSource(deck.source);
    if (manifest.id !== id) throw new Error('Deck ID changed; register under the new ID');
    const current = await this.register(deck.source);
    return {...current, manifest, brand, position: this.positions.get(id) ?? {slideId: manifest.slides[0].id, step: 0}, graph: await sourceGraph(deck.source, manifest), sdk: path.join(appRoot, 'src/presentation-sdk/index.tsx'), authoring: 'Edit source files directly. MCP operates and inspects the presentation.'};
  }
  async position(id: string, target: Position) {
    const {manifest} = await loadSource(this.catalog.get(id).source);
    if (!manifest.slides.some(s => s.id === target.slideId)) throw new Error(`Unknown slide: ${target.slideId}`);
    const normalized = normalizePosition(manifest, target);
    if (normalized.step !== target.step) throw new Error(`Invalid step ${target.step} for ${target.slideId}`);
    this.positions.set(id, normalized); return normalized;
  }
  async validate(id: string, visual = false) {
    const deck = await this.inspect(id), errors: string[] = [], warnings: string[] = [];
    for (const file of (await sourceFiles(deck.source)).filter(f => /\.tsx?$/.test(f))) {
      const source = await readFile(await inside(deck.source, file), 'utf8');
      const result = ts.transpileModule(source, {fileName: file, reportDiagnostics: true, compilerOptions: {jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext}});
      for (const d of result.diagnostics ?? []) errors.push(`${file}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
      if (/<section(?:\s|>)/.test(source)) warnings.push(`${file}: use div/article inside slides; nested section elements can confuse Reveal navigation.`);
    }
    for (const slide of deck.manifest.slides) if (!slide.purpose) warnings.push(`${slide.id}: add a purpose to make story review easier.`);
    if (visual) warnings.push('Static validation does not establish visual quality; use screenshots and walk through the steps.');
    const output = path.join(this.dataDir, 'validation', id, deck.revision);
    try {await compile(deck.source, output);} catch (error) {errors.push(String(error));}
    return {id, revision: deck.revision, ok: errors.length === 0, errors, warnings};
  }
  async build(id: string) {
    const deck = await this.inspect(id), output = path.join(this.dataDir, 'builds', id, deck.revision);
    try {await mkdir(output, {recursive: true}); await compile(deck.source, output); this.catalog.recordBuild(id, deck.revision, output, 'pass', '');}
    catch (error) {this.catalog.recordBuild(id, deck.revision, output, 'fail', String(error)); throw error;}
    return {id, revision: deck.revision, output, entry: path.join(output, 'index.html'), serving: 'Serve this directory with any static HTTP server. The Freyja service is not required.'};
  }
}

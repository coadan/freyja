import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { brandSchema, deckSchema, type DeckManifest } from '../shared/manifest.ts';

export async function inside(root: string, file: string) {
  const base = await realpath(root), resolved = await realpath(path.resolve(base, file));
  if (resolved !== base && !resolved.startsWith(base + path.sep)) throw new Error(`Source escapes presentation: ${file}`);
  return resolved;
}
export async function loadSource(root: string) {
  const manifest = deckSchema.parse(JSON.parse(await readFile(await inside(root, 'deck.json'), 'utf8')));
  const brand = brandSchema.parse(JSON.parse(await readFile(await inside(root, manifest.brand), 'utf8')));
  for (const s of manifest.slides) await inside(root, s.file);
  if (brand.logo) await inside(root, brand.logo);
  return {manifest, brand};
}
export async function sourceFiles(root: string, directory = ''): Promise<string[]> {
  const entries = await readdir(path.join(root, directory), {withFileTypes: true});
  const result: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (['node_modules', '.git', 'dist', '.freyja', '.workbench'].includes(entry.name)) continue;
    const relative = path.posix.join(directory, entry.name);
    await inside(root, relative);
    if (entry.isDirectory()) result.push(...await sourceFiles(root, relative));
    else if (entry.isFile()) result.push(relative);
    else throw new Error(`Unsupported source entry: ${relative}`);
  }
  return result;
}
export async function revision(root: string) {
  const hash = createHash('sha256');
  for (const file of await sourceFiles(root)) {hash.update(file); hash.update('\0'); hash.update(await readFile(await inside(root, file))); hash.update('\0');}
  return hash.digest('hex');
}
export async function sourceGraph(root: string, manifest: DeckManifest) {
  const files = await sourceFiles(root);
  const edges: {from: string; to: string; kind: string}[] = manifest.slides.map(s => ({from: 'deck.json', to: s.file, kind: 'slide'}));
  edges.push({from: 'deck.json', to: manifest.brand, kind: 'brand'});
  for (const file of files.filter(f => /\.[cm]?[jt]sx?$/.test(f))) {
    const source = ts.createSourceFile(file, await readFile(await inside(root, file), 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node: ts.Node) => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text;
        let target = specifier;
        if (specifier.startsWith('.')) {
          const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
          target = [base, ...['.tsx','.ts','.json','.svg','.png','/index.tsx','/index.ts'].map(ext => base + ext)].find(p => files.includes(p)) ?? base;
        }
        edges.push({from: file, to: target, kind: specifier.startsWith('.') ? 'import' : 'package'});
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  const {brand} = await loadSource(root);
  if (brand.logo) edges.push({from: manifest.brand, to: brand.logo, kind: 'asset'});
  return {nodes: files.map(id => ({id})), edges, limitation: 'Static imports and manifest/logo references; computed runtime asset paths are not inferred.'};
}
export async function exists(file: string) {try {await stat(file); return true;} catch {return false;}}

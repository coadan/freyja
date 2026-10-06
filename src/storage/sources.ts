import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { brandSchema, deckSchema, profileSchema, type DeckManifest, type ProfileManifest } from '../shared/manifest.ts';

export type Profile = {root: string; manifest: ProfileManifest};

export async function inside(root: string, file: string) {
  const base = await realpath(root), resolved = await realpath(path.resolve(base, file));
  if (resolved !== base && !resolved.startsWith(base + path.sep)) throw new Error(`Source escapes presentation: ${file}`);
  return resolved;
}
export async function loadProfile(directory: string): Promise<Profile> {
  const root = await realpath(directory);
  const manifest = profileSchema.parse(JSON.parse(await readFile(await inside(root, 'profile.json'), 'utf8')));
  for (const file of [...manifest.styles, ...manifest.guidelines.map(g => g.file)]) await inside(root, file);
  if (manifest.template) await inside(root, manifest.template);
  return {root, manifest};
}
// Resolve a deck reference: `@profile/<path>` lives in the profile, anything else in the deck.
export async function resolveRef(root: string, profile: Profile | undefined, ref: string) {
  if (!ref.startsWith('@profile/')) return inside(root, ref);
  if (!profile) throw new Error(`${ref} needs a profile in deck.json`);
  return inside(profile.root, ref.slice('@profile/'.length));
}
export async function loadSource(root: string) {
  const manifest = deckSchema.parse(JSON.parse(await readFile(await inside(root, 'deck.json'), 'utf8')));
  let profile: Profile | undefined;
  if (manifest.profile) {
    try {profile = await loadProfile(path.resolve(await realpath(root), manifest.profile));}
    catch (error) {throw new Error(`Profile ${manifest.profile}: ${error instanceof Error ? error.message : String(error)}`);}
  }
  const brand = brandSchema.parse(JSON.parse(await readFile(await resolveRef(root, profile, manifest.brand), 'utf8')));
  for (const s of manifest.slides) await inside(root, s.file);
  if (brand.logo) await resolveRef(root, profile, brand.logo);
  return {manifest, brand, profile};
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
  // A profile is part of what the deck renders, so its files change the revision too.
  const {profile} = await loadSource(root);
  if (profile) for (const file of await sourceFiles(profile.root)) {hash.update(`@profile/${file}`); hash.update('\0'); hash.update(await readFile(await inside(profile.root, file))); hash.update('\0');}
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
        edges.push({from: file, to: target, kind: specifier.startsWith('.') ? 'import' : specifier.startsWith('@profile/') ? 'profile' : 'package'});
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  const {brand, profile} = await loadSource(root);
  if (brand.logo) edges.push({from: manifest.brand, to: brand.logo, kind: 'asset'});
  if (profile) for (const style of profile.manifest.styles) edges.push({from: 'deck.json', to: `@profile/${style}`, kind: 'profile-style'});
  return {nodes: files.map(id => ({id})), edges, limitation: 'Static imports and manifest/logo references; computed runtime asset paths are not inferred. Profile files are listed by reference, not walked.'};
}
export async function exists(file: string) {try {await stat(file); return true;} catch {return false;}}

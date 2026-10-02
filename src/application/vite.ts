import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, createServer, type Plugin, type ViteDevServer } from 'vite';
import type { Server } from 'node:http';
import { inside, loadSource } from '../storage/sources.ts';

export const appRoot = fileURLToPath(new URL('../../', import.meta.url));
const playerRoot = path.join(appRoot, 'src/player');
function sourcePlugin(source: string): Plugin {
  const id = '\0virtual:freyja-deck';
  const metadata = new Set([path.join(source, 'deck.json')]);
  return {
    name: 'freyja-source',
    resolveId(name) {if (name === 'virtual:freyja-deck') return id;},
    async load(name) {
      if (name !== id) return;
      const {manifest, brand} = await loadSource(source);
      metadata.add(path.join(source, manifest.brand));
      for (const file of metadata) this.addWatchFile(file);
      const imports = await Promise.all(manifest.slides.map(async (s, i) => `import Slide${i} from ${JSON.stringify(await inside(source, s.file))};`));
      const logo = brand.logo ? `import logoUrl from ${JSON.stringify(await inside(source, brand.logo))}; export {logoUrl};` : 'export const logoUrl=undefined;';
      return `${imports.join('\n')}\n${logo}\nexport const manifest=${JSON.stringify(manifest)}; export const brand=${JSON.stringify(brand)}; export const components={${manifest.slides.map((s, i) => `${JSON.stringify(s.id)}:Slide${i}`).join(',')}};`;
    },
    handleHotUpdate(ctx) {
      if (metadata.has(ctx.file)) {
        const module = ctx.server.moduleGraph.getModuleById(id);
        if (module) ctx.server.moduleGraph.invalidateModule(module);
        ctx.server.ws.send({type: 'full-reload'}); return [];
      }
    },
  };
}
function common(source: string, live: boolean) {
  return {root: playerRoot, configFile: false as const, publicDir: false as const, logLevel: 'silent' as const,
    plugins: [sourcePlugin(source)], esbuild: {jsx: 'automatic' as const},
    resolve: {alias: {'@freyja/sdk': path.join(appRoot, 'src/presentation-sdk/index.tsx')}, dedupe: ['react', 'react-dom']},
    define: {__FREYJA_LIVE__: JSON.stringify(live)},
  };
}
export async function createPreview(source: string, id: string, httpServer: Server): Promise<ViteDevServer> {
  const base = `/p/${id}/`;
  return createServer({...common(source, true), base, server: {middlewareMode: true, hmr: {server: httpServer, path: `${base}hmr`}, fs: {allow: [appRoot, source]}}, appType: 'spa'});
}
export async function compile(source: string, output: string) {
  await build({...common(source, false), base: './', build: {outDir: output, emptyOutDir: false, assetsDir: 'assets'}});
  return output;
}
export async function browserBinary() {
  // An explicitly configured executable is useful on machines with an existing Chrome installation.
  return process.env.FREYJA_BROWSER || undefined;
}

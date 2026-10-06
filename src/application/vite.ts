import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, createServer, type Plugin, type ViteDevServer } from 'vite';
import type { Server } from 'node:http';
import { inside, loadSource, resolveRef } from '../storage/sources.ts';

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
      const {manifest, brand, profile} = await loadSource(source);
      metadata.add(await resolveRef(source, profile, manifest.brand));
      if (profile) metadata.add(path.join(profile.root, 'profile.json'));
      for (const file of metadata) this.addWatchFile(file);
      // Profile styles load before slides so deck CSS can still override them.
      const styles = profile ? await Promise.all(profile.manifest.styles.map(async file => `import ${JSON.stringify(await inside(profile.root, file))};`)) : [];
      const imports = await Promise.all(manifest.slides.map(async (s, i) => `import Slide${i} from ${JSON.stringify(await inside(source, s.file))};`));
      const logo = brand.logo ? `import logoUrl from ${JSON.stringify(await resolveRef(source, profile, brand.logo))}; export {logoUrl};` : 'export const logoUrl=undefined;';
      return `${styles.join('\n')}\n${imports.join('\n')}\n${logo}\nexport const manifest=${JSON.stringify(manifest)}; export const brand=${JSON.stringify(brand)}; export const components={${manifest.slides.map((s, i) => `${JSON.stringify(s.id)}:Slide${i}`).join(',')}};`;
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
// The profile directory is read when the server starts; changing a deck's profile path needs a new preview.
async function common(source: string, live: boolean) {
  const {profile} = await loadSource(source);
  const alias: Record<string, string> = {'@freyja/sdk': path.join(appRoot, 'src/presentation-sdk/index.tsx')};
  if (profile) alias['@profile'] = profile.root;
  return {config: {root: playerRoot, configFile: false as const, publicDir: false as const, logLevel: 'silent' as const,
    plugins: [sourcePlugin(source)], esbuild: {jsx: 'automatic' as const},
    // Profiles and decks outside the app checkout resolve these packages from the app.
    resolve: {alias, dedupe: ['react', 'react-dom', 'lucide-react']},
    define: {__FREYJA_LIVE__: JSON.stringify(live)},
  }, allow: profile ? [appRoot, source, profile.root] : [appRoot, source]};
}
// Pre-bundle the player's dependencies up front. Discovering one later (for example from a profile
// component) re-optimizes mid-session, and open pages then request outdated chunks and render blank.
const optimizeDeps = {include: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client', '@revealjs/react', 'reveal.js', 'lucide-react', 'zod']};
// Each preview owns its dependency cache. A shared node_modules/.vite is rewritten by any other
// server or test run, which breaks module URLs already loaded in a live presentation.
export async function createPreview(source: string, id: string, httpServer: Server, cacheDir: string): Promise<ViteDevServer> {
  const base = `/p/${id}/`, {config, allow} = await common(source, true);
  return createServer({...config, base, cacheDir, optimizeDeps, server: {middlewareMode: true, hmr: {server: httpServer, path: `${base}hmr`}, fs: {allow}}, appType: 'spa'});
}
export async function compile(source: string, output: string) {
  const {config} = await common(source, false);
  await build({...config, base: './', build: {outDir: output, emptyOutDir: false, assetsDir: 'assets'}});
  return output;
}
export async function browserBinary() {
  // An explicitly configured executable is useful on machines with an existing Chrome installation.
  return process.env.FREYJA_BROWSER || undefined;
}

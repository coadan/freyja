import { createServer, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import type { ViteDevServer } from 'vite';
import { Presentations } from '../../application/presentations.ts';
import { browserBinary, createPreview } from '../../application/vite.ts';
import type { Position } from '../../shared/manifest.ts';
import {toolDefinitions} from '../../shared/operations.ts';
import {z} from 'zod';
import {exportPdf} from '../../application/pdf.ts';

export async function startApp(dataDir: string, port = 0) {
  const service = new Presentations(dataDir), token = randomBytes(24).toString('hex');
  const previews = new Map<string, Promise<ViteDevServer>>(), listeners = new Map<string, Set<ServerResponse>>();
  const send = (id: string, position: Position) => {for (const res of listeners.get(id) ?? []) res.write(`event: navigate\ndata: ${JSON.stringify(position)}\n\n`);};
  let url = '';
  const preview = async (id: string) => {
    if (!previews.has(id)) {const promise = createPreview(service.catalog.get(id).source, id, http, path.join(dataDir, 'vite', id)); previews.set(id, promise); promise.catch(() => previews.delete(id));}
    await previews.get(id); return `${url}/p/${id}/`;
  };
  const operations: Record<string, (args: any) => Promise<unknown> | unknown> = {
    list_presentations: () => service.catalog.list(),
    create_presentation: args => service.create(args),
    register_presentation: args => service.register(args.directory),
    inspect_presentation: args => service.inspect(args.id),
    preview_presentation: async args => ({id: args.id, url: await preview(args.id)}),
    open_presentation: async args => {
      const deck = await service.inspect(args.id), target = await service.position(args.id, {slideId: args.slideId ?? deck.manifest.slides[0].id, step: args.step ?? 0});
      const base = await preview(args.id); send(args.id, target);
      return {url: `${base}#/${target.slideId}/${target.step}`, position: target};
    },
    get_presentation_state: async args => {
      const deck = await service.inspect(args.id);
      return {id: args.id, position: deck.position, connectedViews: listeners.get(args.id)?.size ?? 0};
    },
    validate_presentation: args => service.validate(args.id, true),
    build_presentation: args => service.build(args.id),
    export_pdf: async args => {
      const deck = await service.inspect(args.id), allSteps = args.allSteps ?? false;
      const output = path.join(dataDir, 'exports', args.id, deck.revision, `${args.id}${allSteps ? '-all-steps' : ''}.pdf`);
      return {id: args.id, revision: deck.revision, ...await exportPdf({url: await preview(args.id), manifest: deck.manifest, output, allSteps})};
    },
    render_slide: async args => {
      const deck = await service.inspect(args.id), slide = deck.manifest.slides.find(s => s.id === args.slideId);
      if (!slide || args.step < 0 || args.step >= slide.steps.length) throw new Error('Invalid slide or step');
      const base = await preview(args.id), output = path.join(dataDir, 'captures', args.id, `${slide.id}-${args.step}.png`);
      await mkdir(path.dirname(output), {recursive: true});
      const browser = await chromium.launch({executablePath: await browserBinary()});
      try {
        const page = await browser.newPage({viewport: {width: 1440, height: 810}, reducedMotion: 'reduce'});
        const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${base}?capture=1#/${slide.id}/${args.step}`);
        await page.waitForFunction(([id, step]) => window.freyja?.position.slideId === id && window.freyja?.position.step === step, [slide.id, args.step]);
        await page.waitForSelector('.reveal.ready');
        await page.waitForSelector(`.present [data-slide-id="${slide.id}"]`);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => Array.from(document.images).every(img => img.complete));
        await page.waitForTimeout(250);
        const imageErrors = await page.locator('img').evaluateAll(images => images.filter(img => !(img as HTMLImageElement).naturalWidth).map(img => img.getAttribute('src')));
        const renderErrors = await page.locator('[role=alert]').allTextContents();
        if (errors.length || imageErrors.length || renderErrors.length) throw new Error(JSON.stringify({errors, imageErrors, renderErrors}));
        await page.screenshot({path: output});
      } finally {await browser.close();}
      return {id: args.id, slideId: slide.id, step: args.step, path: output, revision: deck.revision};
    },
  };
  const json = (res: ServerResponse, code: number, value: unknown) => {res.writeHead(code, {'Content-Type': 'application/json'}); res.end(JSON.stringify(value));};
  const http = createServer(async (req, res) => {
    try {
      const host = req.headers.host ?? '';
      if (!/^127\.0\.0\.1:\d+$/.test(host)) return json(res, 403, {error: 'Loopback requests only'});
      if (req.headers.origin && req.headers.origin !== url) return json(res, 403, {error: 'Origin rejected'});
      const route = new URL(req.url ?? '/', url || 'http://127.0.0.1').pathname;
      if (route === '/api/health') return json(res, 200, {app: 'freyja', version: '0.1.0'});
      if (route === '/api/operations' && req.method === 'POST') {
        if (req.headers.authorization !== `Bearer ${token}`) return json(res, 403, {error: 'App credential required'});
        const {operation, args} = await body(req);
        if (!Object.hasOwn(operations, operation)) return json(res, 400, {error: 'Unknown operation'});
        const definition = toolDefinitions.find(([name]) => name === operation)!;
        const validated = z.object(definition[2]).strict().parse(args ?? {});
        return json(res, 200, {result: await operations[operation](validated)});
      }
      const pdf = route.match(/^\/api\/pdf\/([a-z][a-z0-9-]*)$/);
      if (pdf && req.method === 'POST') {
        if (req.headers.origin !== url) return json(res, 403, {error: 'Same-origin presenter request required'});
        const options = z.object({allSteps: z.boolean().optional()}).strict().parse(await body(req));
        const result = await operations.export_pdf({id: pdf[1], ...options}) as {path: string};
        const content = await readFile(result.path);
        res.writeHead(200, {'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${path.basename(result.path)}"`, 'Cache-Control': 'no-store'});
        res.end(content); return;
      }
      const events = route.match(/^\/api\/events\/([a-z][a-z0-9-]*)$/);
      if (events && req.method === 'GET') {
        const id = events[1]; service.catalog.get(id);
        res.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive'});
        res.write(': connected\n\n');
        const set = listeners.get(id) ?? new Set(); set.add(res); listeners.set(id, set);
        const heartbeat = setInterval(() => res.write(': alive\n\n'), 15000);
        req.on('close', () => {clearInterval(heartbeat); set.delete(res);}); return;
      }
      const state = route.match(/^\/api\/state\/([a-z][a-z0-9-]*)$/);
      if (state && req.method === 'POST') {return json(res, 200, await service.position(state[1], await body(req)));}
      const presentation = route.match(/^\/p\/([a-z][a-z0-9-]*)\//);
      if (presentation) {await preview(presentation[1]); (await previews.get(presentation[1]))!.middlewares(req, res, () => {res.writeHead(404); res.end('Not found');}); return;}
      if (route === '/') {
        const decks = service.catalog.list();
        if (decks.length) {res.writeHead(302, {Location: await preview(decks[0].id)}); res.end(); return;}
        res.writeHead(200, {'Content-Type': 'text/html'}); res.end('<html><title>Freyja</title><body style="font:24px system-ui;padding:10vw"><h1>Freyja</h1><p>Create a presentation through MCP or the CLI to begin.</p></body></html>'); return;
      }
      res.writeHead(404); res.end('Not found');
    } catch (error) {json(res, 400, {error: error instanceof Error ? error.message : String(error)});}
  });
  await new Promise<void>((resolve, reject) => {http.once('error', reject); http.listen(port, '127.0.0.1', () => resolve());});
  const address = http.address(); if (!address || typeof address === 'string') throw new Error('No local address');
  url = `http://127.0.0.1:${address.port}`;
  await mkdir(dataDir, {recursive: true});
  const runtimeFile = path.join(dataDir, 'runtime.json');
  await writeFile(runtimeFile, JSON.stringify({url, token, pid: process.pid}), {mode: 0o600});
  return {url, token, service, operations, preview, async close() {
    for (const set of listeners.values()) for (const res of set) res.end();
    for (const server of previews.values()) await (await server).close();
    http.closeAllConnections(); await new Promise<void>(resolve => http.close(() => resolve()));
    service.catalog.close();
    try {const state = JSON.parse(await readFile(runtimeFile, 'utf8')); if (state.token === token) await unlink(runtimeFile);} catch {}
  }};
}
async function body(req: import('node:http').IncomingMessage) {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) {size += chunk.length; if (size > 1024 * 1024) throw new Error('Request too large'); chunks.push(chunk);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

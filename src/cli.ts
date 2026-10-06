import { parseArgs } from 'node:util';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { startApp } from './interfaces/http/server.ts';
import { serveMcp } from './interfaces/mcp/server.ts';

const {values, positionals} = parseArgs({allowPositionals: true, options: {
  'all-steps': {type: 'boolean'}, help: {type: 'boolean', short: 'h'}, version: {type: 'boolean'}, 'data-dir': {type: 'string'}, port: {type: 'string'}, id: {type: 'string'}, title: {type: 'string'}, theme: {type: 'string'}, directory: {type: 'string'}, profile: {type: 'string'}, slide: {type: 'string'}, step: {type: 'string'},
}});
const dataDir = path.resolve(values['data-dir'] ?? process.env.FREYJA_DATA_DIR ?? path.join(homedir(), '.local/share/freyja'));
const command = positionals[0] ?? 'serve';
async function running() {
  try {const runtime = JSON.parse(await readFile(path.join(dataDir, 'runtime.json'), 'utf8'));
    if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(runtime.url)) return null;
    const response = await fetch(`${runtime.url}/api/health`, {signal: AbortSignal.timeout(700)});
    const health = await response.json() as {app?: string}; return response.ok && health.app === 'freyja' ? runtime : null;
  } catch {return null;}
}
async function ensureApp() {
  const active = await running(); if (active) return active;
  await mkdir(dataDir, {recursive: true});
  const lock = path.join(dataDir, 'startup.lock');
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await mkdir(lock);
      await writeFile(path.join(lock, 'pid'), String(process.pid));
      try {
        const current = await running(); if (current) return current;
        const child = spawn(process.execPath, [fileURLToPath(new URL('../scripts/cli.mjs', import.meta.url)), 'serve', '--data-dir', dataDir, '--port', '0'], {detached: true, stdio: 'ignore', env: process.env});
        child.unref();
        for (let i = 0; i < 100; i++) {const app = await running(); if (app) return app; await delay(100);}
        throw new Error('Freyja failed to start. Run npm run dev in the app checkout to inspect the error.');
      } finally {await rm(lock, {recursive: true, force: true});}
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      try {const pid = Number(await readFile(path.join(lock, 'pid'), 'utf8')); process.kill(pid, 0);} catch (e) {if ((e as NodeJS.ErrnoException).code === 'ESRCH') await rm(lock, {recursive: true, force: true});}
      const current = await running(); if (current) return current;
      await delay(100);
    }
  }
  throw new Error('Freyja startup is still locked. Check the app process before removing startup.lock.');
}
async function call(operation: string, args: unknown) {
  const app = await ensureApp();
  const response = await fetch(`${app.url}/api/operations`, {method: 'POST', headers: {'Content-Type':'application/json', Authorization:`Bearer ${app.token}`}, body: JSON.stringify({operation,args})});
  const result = await response.json() as {result?: unknown; error?: string}; if (!response.ok) throw new Error(result.error); return result.result;
}
try {
  if (values.help || command === 'help') {
    console.log(`Freyja — interactive presentations from ordinary TSX source

Usage: node scripts/cli.mjs <command> [options]

Commands:
  create     --id <id> --title <title> [--theme editorial|midnight] [--directory <path>] [--profile <path>]
  register   --directory <path>
  list       List registered presentations
  inspect    --id <id>
  preview    --id <id>
  open       --id <id> --slide <slide-id> [--step <number>]
  capture    --id <id> --slide <slide-id> [--step <number>]
  validate   --id <id>
  build      --id <id>
  pdf        --id <id> [--all-steps] (final rendered slides by default)
  serve      [--port <number>] (default 4174; 0 chooses an available port)
  mcp        Run the stdio MCP interface
  stop       Stop the shared local app

Options:
  --data-dir <path>  Override FREYJA_DATA_DIR / ~/.local/share/freyja
  -h, --help        Show this help
  --version         Show the application version

Source edits control slides, order, demos and branding. See docs/cli.md.`);
  } else if (values.version || command === 'version') {
    const metadata = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    console.log(metadata.version);
  } else if (command === 'serve') {
    if (await running()) throw new Error('Freyja is already running for this data directory.');
    const app = await startApp(dataDir, Number(values.port ?? 4174));
    console.error(`Freyja: ${app.url}\nData: ${dataDir}`);
    for (const signal of ['SIGTERM','SIGINT'] as const) process.once(signal, () => {void app.close().then(() => process.exit(0));});
  } else if (command === 'mcp') {await ensureApp(); await serveMcp(dataDir);}
  else if (command === 'stop') {const app = await running(); if (app) process.kill(app.pid, 'SIGTERM'); console.log('Freyja stopped.');}
  else {
    const id = values.id;
    const mappings: Record<string, [string, unknown]> = {
      list: ['list_presentations', {}], create: ['create_presentation', {id, title: values.title, theme: values.theme, directory: values.directory && path.resolve(values.directory), profile: values.profile && path.resolve(values.profile)}],
      register: ['register_presentation', {directory: values.directory}], inspect: ['inspect_presentation', {id}],
      preview: ['preview_presentation', {id}], open: ['open_presentation', {id, slideId: values.slide, step: Number(values.step ?? 0)}],
      pdf: ['export_pdf', {id, allSteps: values['all-steps'] ?? false}],
      validate: ['validate_presentation', {id}], build: ['build_presentation', {id}],
      capture: ['render_slide', {id, slideId: values.slide, step: Number(values.step ?? 0)}],
    };
    if (!mappings[command]) throw new Error('Commands: serve, mcp, stop, list, create, register, inspect, preview, open, validate, capture, build, pdf');
    console.log(JSON.stringify(await call(...mappings[command]), null, 2));
  }
} catch (error) {console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1;}

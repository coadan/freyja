#!/usr/bin/env node
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const sibling = fileURLToPath(new URL('../../', import.meta.url));
const root = process.env.FREYJA_ROOT ?? (existsSync(path.join(sibling, 'src/cli.ts')) ? sibling : path.join(homedir(), 'repos/freyja'));
const entry = path.join(root, 'scripts/cli.mjs');
if (!existsSync(entry)) {console.error('Freyja app not found. Set FREYJA_ROOT to the app checkout and run npm ci there.'); process.exit(1);}
const child = spawn(process.execPath, [entry, 'mcp'], {stdio: 'inherit', env: process.env});
child.on('error', error => {console.error(error.message); process.exit(1);});
child.on('exit', code => process.exit(code ?? 1));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => child.kill(signal));

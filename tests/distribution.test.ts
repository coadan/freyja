import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, cp, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { appRoot } from '../src/application/vite.ts';
import { startApp } from '../src/interfaces/http/server.ts';

const exec = promisify(execFile);
const json = async (file: string) => JSON.parse(await readFile(path.join(appRoot, file), 'utf8'));

test('help and version work without starting the app or creating local data', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'freyja-help-'));
  const data = path.join(temporary, 'unused');
  try {
    const options = {env: {...process.env, FREYJA_DATA_DIR: data}, timeout: 10000};
    const help = await exec(process.execPath, [path.join(appRoot, 'scripts/cli.mjs'), '--help'], options);
    assert.match(help.stdout, /Usage:.*<command>/);
    const version = await exec(process.execPath, [path.join(appRoot, 'scripts/cli.mjs'), '--version'], options);
    assert.equal(version.stdout.trim(), (await json('package.json')).version);
    await assert.rejects(access(data));
  } finally {await rm(temporary, {recursive: true, force: true});}
});

for (const host of ['codex', 'claude'] as const) {
  test(`${host} marketplace package launches real MCP from a cached copy`, async () => {
    const temporary = await mkdtemp(path.join(tmpdir(), `freyja-${host}-`));
    const cache = path.join(temporary, 'cache');
    const data = path.join(temporary, 'data');
    const app = await startApp(data);
    const client = new Client({name: `freyja-${host}-package-test`, version: '1.0.0'});
    try {
      const catalog = await json(host === 'codex' ? '.agents/plugins/marketplace.json' : '.claude-plugin/marketplace.json');
      const entry = catalog.plugins.find((plugin: {name: string}) => plugin.name === 'freyja');
      const source = host === 'codex' ? entry.source.path : entry.source;
      assert.equal(catalog.name, 'freyja-local');
      await cp(path.join(appRoot, source), cache, {recursive: true});
      const manifest = JSON.parse(await readFile(path.join(cache, `.${host}-plugin/plugin.json`), 'utf8'));
      assert.equal(manifest.version, (await json('package.json')).version);
      const config = typeof manifest.mcpServers === 'string'
        ? JSON.parse(await readFile(path.join(cache, manifest.mcpServers), 'utf8')).mcpServers
        : manifest.mcpServers;
      const server = config.freyja;
      const variable = host === 'codex' ? '${CODEX_PLUGIN_ROOT}' : '${CLAUDE_PLUGIN_ROOT}';
      const args = server.args.map((argument: string) => argument.replace(variable, cache));
      const skill = await readFile(path.join(cache, 'skills/engaging-presentations/SKILL.md'), 'utf8');
      assert.match(skill, /Edit manifests, TSX, CSS and assets with normal file tools/);
      await assert.rejects(access(path.join(cache, 'node_modules')));
      const environment = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
      const transport = new StdioClientTransport({command: server.command, args, cwd: temporary,
        env: {...environment, FREYJA_ROOT: appRoot, FREYJA_DATA_DIR: data}, stderr: 'pipe'});
      await client.connect(transport);
      const tools = (await client.listTools()).tools;
      assert.equal(tools.length, 12);
      const created = await client.callTool({name: 'create_presentation', arguments: {id: `${host}-talk`, title: 'A shared workflow'}});
      assert.equal(created.isError, undefined);
      const inspected = await client.callTool({name: 'inspect_presentation', arguments: {id: `${host}-talk`}});
      assert.equal((inspected.structuredContent as any).manifest.title, 'A shared workflow');
    } finally {
      await client.close();
      await app.close();
      await rm(temporary, {recursive: true, force: true});
    }
  });
}

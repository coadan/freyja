import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { deckSchema, advance, normalizePosition } from '../src/shared/manifest.ts';
import { Presentations } from '../src/application/presentations.ts';
import { inside } from '../src/storage/sources.ts';
import { appRoot } from '../src/application/vite.ts';
import { startApp } from '../src/interfaces/http/server.ts';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const fixture = deckSchema.parse(JSON.parse(await readFile(path.join(appRoot, 'templates/story/deck.json'), 'utf8')));
test('navigation reverses every forward transition including slide boundaries', () => {
  let p = {slideId: fixture.slides[0].id, step: 0};
  const journey = [p];
  for (let i=1; i<fixture.slides.reduce((n,s)=>n+s.steps.length,0); i++) {p = advance(fixture, p, 1); journey.push(p);}
  assert.deepEqual(advance(fixture,p,1),p);
  for (let i=journey.length-2;i>=0;i--) {p=advance(fixture,p,-1);assert.deepEqual(p,journey[i]);}
  assert.deepEqual(advance(fixture,p,-1),p);
  assert.deepEqual(normalizePosition(fixture,{slideId:'absent',step:99}),journey[0]);
});
test('manifest rejects duplicate identities and escaping paths', () => {
  assert.throws(()=>deckSchema.parse({...fixture, slides:[fixture.slides[0],fixture.slides[0]]}));
  assert.throws(()=>deckSchema.parse({...fixture, slides:[{...fixture.slides[0],file:'../escape.tsx'}]}));
});
test('catalog persists, direct source edits change inspection and duplicate create preserves files', async () => {
  const root=await mkdtemp(path.join(tmpdir(),'freyja-catalog-'));
  let service=new Presentations(root);
  try {
    const deck=await service.create({id:'test-talk',title:'An unrelated topic',theme:'midnight'});
    assert.equal((await service.inspect(deck.id)).brand.colors.background,'#101629');
    const file=path.join(deck.source,'slides/intro.tsx');
    const original=await readFile(file,'utf8'); await writeFile(file,original+'\n// ordinary direct source edit\n');
    assert.notEqual((await service.inspect(deck.id)).revision,deck.revision);
    await assert.rejects(service.create({id:deck.id,title:'Overwrite'}));
    assert.equal(await readFile(file,'utf8'),original+'\n// ordinary direct source edit\n');
    const graph=(await service.inspect(deck.id)).graph;
    assert.ok(graph.edges.some(e=>e.to==='slides/flow-example.tsx'));
    await symlink(path.join(root,'catalog.sqlite'),path.join(deck.source,'escape'));
    await assert.rejects(inside(deck.source,'escape'),/escapes/);
    await rm(path.join(deck.source,'escape'));
    service.catalog.close();service=new Presentations(root);
    assert.equal(service.catalog.list()[0].id,deck.id);
    await assert.rejects(service.position(deck.id,{slideId:'recovery',step:100}),/Invalid step/);
  } finally {service.catalog.close();await rm(root,{recursive:true,force:true});}
});
test('real stdio MCP operates the shared service and exposes no source edits', async () => {
  const root=await mkdtemp(path.join(tmpdir(),'freyja-mcp-')), app=await startApp(root);
  const transport=new StdioClientTransport({command:process.execPath,args:[path.join(appRoot,'scripts/cli.mjs'),'mcp','--data-dir',root],stderr:'pipe'});
  const client=new Client({name:'freyja-test',version:'1.0.0'});
  try {
    await client.connect(transport);
    const tools=(await client.listTools()).tools.map(t=>t.name);
    assert.equal(tools.length,11); assert.ok(!tools.some(t=>/update_sources|set_slide_order|write|patch/.test(t)));
    const created=await client.callTool({name:'create_presentation',arguments:{id:'mcp-talk',title:'Through MCP'}});
    assert.equal(created.isError,undefined);
    const inspected=await client.callTool({name:'inspect_presentation',arguments:{id:'mcp-talk'}});
    assert.equal((inspected.structuredContent as any).manifest.title,'Through MCP');
    const opened=await client.callTool({name:'open_presentation',arguments:{id:'mcp-talk',slideId:'recovery',step:2}});
    assert.match((opened.structuredContent as any).url,/#\/recovery\/2$/);
    const invalid=await client.callTool({name:'open_presentation',arguments:{id:'mcp-talk',slideId:'absent',step:0}});
    assert.equal(invalid.isError,true);
    const rejected=await fetch(`${app.url}/api/operations`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"operation":"list_presentations"}'});
    assert.equal(rejected.status,403);
    const foreign=await fetch(`${app.url}/api/health`,{headers:{Origin:'https://foreign.example'}});assert.equal(foreign.status,403);
  } finally {await client.close();await app.close();await rm(root,{recursive:true,force:true});}
});

import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { startApp } from '../src/interfaces/http/server.ts';

const root=await mkdtemp(path.join(tmpdir(),'freyja-browser-')),app=await startApp(root);
const browser=await chromium.launch({executablePath:process.env.FREYJA_BROWSER});
let staticServer: ReturnType<typeof createServer> | undefined;
try {
  const created=await app.service.create({id:'browser-talk',title:'How retries recover'});
  const base=await app.preview(created.id), page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}#/recovery/0`);
  await page.waitForSelector('.reveal.ready');
  const position=async(id:string,step:number)=>page.waitForFunction(([id,step])=>window.freyja?.position.slideId===id&&window.freyja.position.step===step,[id,step]);
  await position('recovery',0);
  for(let i=1;i<=3;i++){await page.keyboard.press('ArrowRight');await position('recovery',i);}
  assert.equal(await page.locator('.present .f-metric strong').first().textContent(),'1');
  const panelBox=await page.locator('.present .f-state-panel').boundingBox();
  const footerBox=await page.locator('.present .f-footer').boundingBox();
  assert.ok(panelBox&&footerBox&&panelBox.y+panelBox.height<=footerBox.y,'Starter flow state must fit above its footer');
  await page.keyboard.press('ArrowLeft');await position('recovery',2);
  await page.getByRole('button',{name:'Saved',exact:true}).click();await position('recovery',1);
  await page.keyboard.press('ArrowRight');await position('recovery',2);
  await page.keyboard.press('g');await page.getByRole('textbox',{name:'Search slides'}).fill('conversation');
  await page.getByRole('button',{name:/A conversation that leads/}).click();await position('demo',0);
  assert.equal(await page.locator('.present .demo-layout').evaluate(e=>e.classList.contains('has-results')),false);
  await page.keyboard.press('ArrowRight');await position('demo',1);
  assert.equal(await page.locator('.present .demo-layout').evaluate(e=>e.classList.contains('has-results')),true);
  await page.reload();await page.waitForSelector('.reveal.ready');await position('demo',1);
  await page.keyboard.press('o');assert.ok(await page.getByRole('dialog',{name:'Slide overview'}).isVisible());await page.keyboard.press('Escape');
  await app.operations.open_presentation({id:created.id,slideId:'decisions',step:2});await position('decisions',2);
  const screenshot=await app.operations.render_slide({id:created.id,slideId:'recovery',step:3}) as {path:string};
  assert.ok((await readFile(screenshot.path)).length>10000);await position('decisions',2);
  // Ordinary source editing must become visible through Vite.
  const intro=path.join(created.source,'slides/intro.tsx'),code=await readFile(intro,'utf8');
  await writeFile(intro,code.replace('{slide.title}','Source edited directly'));
  await app.operations.open_presentation({id:created.id,slideId:'intro',step:0});
  await page.getByRole('heading',{name:'Source edited directly'}).waitFor();
  const brandFile=path.join(created.source,'brand.json'),brand=JSON.parse(await readFile(brandFile,'utf8'));
  brand.colors.accent='#8844cc';await writeFile(brandFile,JSON.stringify(brand));
  await page.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent')==='#8844cc');
  const validated=await app.service.validate(created.id);assert.equal(validated.ok,true,JSON.stringify(validated));
  const built=await app.service.build(created.id);
  staticServer=createServer(async(req,res)=>{try{const file=path.join(built.output,(req.url??'/').split('?')[0]==='/'?'index.html':(req.url??'/').slice(1));const mime=file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html';res.writeHead(200,{'Content-Type':mime});res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
  await new Promise<void>(resolve=>staticServer!.listen(0,'127.0.0.1',resolve));const address=staticServer.address();assert.ok(address&&typeof address!=='string');
  const exported=await browser.newPage();await exported.goto(`http://127.0.0.1:${address.port}/#/recovery/2`);await exported.waitForSelector('.reveal.ready');
  await exported.waitForFunction(()=>window.freyja?.position.step===2);assert.equal(await exported.locator('.present .f-flow-node').first().textContent(),'WorkerReply lost');
  await exported.keyboard.press('ArrowRight');await exported.waitForFunction(()=>window.freyja?.position.step===3);
  const midnight=await app.service.create({id:'another-topic',title:'Another topic',theme:'midnight'});
  const dark=await browser.newPage();await dark.goto(await app.preview(midnight.id));await dark.waitForSelector('.reveal.ready');
  assert.equal(await dark.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--background')),'#101629');
  assert.deepEqual(errors,[]);assert.equal(await page.locator('[role=alert]').count(),0);
  console.log('Browser checks passed: reverse, tabs, jump, overview, deep links, MCP navigation, isolated capture, source/theme refresh, static build and second theme.');
}finally{await browser.close();if(staticServer)await new Promise<void>(resolve=>staticServer!.close(()=>resolve()));await app.close();await rm(root,{recursive:true,force:true});}

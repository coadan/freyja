import { mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import type { DeckManifest } from '../shared/manifest.ts';
import { browserBinary } from './vite.ts';

// The normal slide source and step drive printing too; no second slide renderer.
const printStyles = `
  @page { size: 1280px 720px; margin: 0; }
  html, body, #root { width: 1280px !important; height: 720px !important; margin: 0 !important; overflow: hidden !important; }
  body { position: fixed !important; inset: 0 !important; }
  .reveal::after, .aria-status, .reveal .backgrounds { display: none !important; }
  .reveal { width: 1280px !important; height: 720px !important; }
  .reveal .slides { position: static !important; width: 1280px !important; height: 720px !important; transform: none !important; margin: 0 !important; }
  .reveal .slides > section { display: none !important; }
  .reveal .slides > section.present { display: block !important; position: static !important; width: 1280px !important; height: 720px !important; transform: none !important; margin: 0 !important; padding: 0 !important; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .f-controls, .f-overlay { display: none !important; }
`;

export async function exportPdf({url, manifest, output, allSteps = false}: {
  url: string; manifest: DeckManifest; output: string; allSteps?: boolean;
}) {
  const browser = await chromium.launch({executablePath: await browserBinary()});
  const pdf = await PDFDocument.create();
  pdf.setTitle(manifest.title);
  pdf.setCreator('Freyja');
  pdf.setProducer('Freyja / Chromium');
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 720}, reducedMotion: 'reduce'});
    // Reveal's generic print stylesheet lays out the whole deck. Keep screen
    // styling and normalize just the active slide for a faithful single page.
    await page.emulateMedia({media: 'screen'});
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const slide of manifest.slides) {
      const steps = allSteps ? slide.steps.map((_, index) => index) : [slide.steps.length - 1];
      for (const step of steps) {
        await page.goto(`${url}?capture=1#/${slide.id}/${step}`);
        await page.waitForFunction(([id, step]) => window.freyja?.position.slideId === id && window.freyja?.position.step === step, [slide.id, step]);
        await page.waitForSelector('.reveal.ready');
        await page.waitForSelector(`.present [data-slide-id="${slide.id}"]`);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => Array.from(document.images).every(image => image.complete));
        await page.waitForTimeout(250);
        const missingImages = await page.locator('.present img').evaluateAll(images => images.filter(image => !(image as HTMLImageElement).naturalWidth).map(image => image.getAttribute('src')));
        const renderErrors = await page.locator('[role=alert]').allTextContents();
        if (errors.length || missingImages.length || renderErrors.length) throw new Error(`Cannot export ${slide.id}/${step}: ${JSON.stringify({errors, missingImages, renderErrors})}`);
        await page.addStyleTag({content: printStyles});
        const printed = await PDFDocument.load(await page.pdf({width: '1280px', height: '720px', printBackground: true, preferCSSPageSize: true, margin: {top: 0, right: 0, bottom: 0, left: 0}}));
        if (printed.getPageCount() !== 1) throw new Error(`Slide ${slide.id}/${step} printed ${printed.getPageCount()} pages instead of one.`);
        const [rendered] = await pdf.copyPages(printed, [0]);
        pdf.addPage(rendered);
      }
    }
    await mkdir(path.dirname(output), {recursive: true});
    const temporary = `${output}.${randomUUID()}.tmp`;
    try {await writeFile(temporary, await pdf.save()); await rename(temporary, output);}
    finally {await rm(temporary, {force: true});}
    return {path: output, pages: pdf.getPageCount(), mode: allSteps ? 'all-steps' : 'final'};
  } finally {await browser.close();}
}

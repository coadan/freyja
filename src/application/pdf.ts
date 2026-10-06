import { mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import type { DeckManifest } from '../shared/manifest.ts';
import { forEachRenderedStep } from './render.ts';

export async function exportPdf({url, manifest, output, allSteps = false}: {
  url: string; manifest: DeckManifest; output: string; allSteps?: boolean;
}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(manifest.title);
  pdf.setCreator('Freyja');
  pdf.setProducer('Freyja / Chromium');
  await forEachRenderedStep({url, manifest, allSteps}, async (page, slide, step) => {
    const printed = await PDFDocument.load(await page.pdf({width: '1280px', height: '720px', printBackground: true, preferCSSPageSize: true, margin: {top: 0, right: 0, bottom: 0, left: 0}}));
    if (printed.getPageCount() !== 1) throw new Error(`Slide ${slide.id}/${step} printed ${printed.getPageCount()} pages instead of one.`);
    const [rendered] = await pdf.copyPages(printed, [0]);
    pdf.addPage(rendered);
  });
  await writeAtomically(output, await pdf.save());
  return {path: output, pages: pdf.getPageCount(), mode: allSteps ? 'all-steps' : 'final'};
}

export async function writeAtomically(output: string, data: Uint8Array) {
  await mkdir(path.dirname(output), {recursive: true});
  const temporary = `${output}.${randomUUID()}.tmp`;
  try {await writeFile(temporary, data); await rename(temporary, output);}
  finally {await rm(temporary, {force: true});}
}

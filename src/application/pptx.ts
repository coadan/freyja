import PptxGenJS from 'pptxgenjs';
import type { DeckManifest } from '../shared/manifest.ts';
import { forEachRenderedStep } from './render.ts';
import { writeAtomically } from './pdf.ts';

// PowerPoint receives each rendered slide as a full-bleed 2× image: faithful to the deck, including
// custom React and WebGL scenes, but not editable as native shapes. Titles become alt text.
export async function exportPptx({url, manifest, output, allSteps = false}: {
  url: string; manifest: DeckManifest; output: string; allSteps?: boolean;
}) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = manifest.title;
  pptx.company = 'Freyja';
  let slides = 0;
  await forEachRenderedStep({url, manifest, allSteps, scale: 2}, async (page, slide, step) => {
    const image = await page.screenshot({clip: {x: 0, y: 0, width: 1280, height: 720}, type: 'png'});
    const sheet = pptx.addSlide();
    sheet.addImage({data: `image/png;base64,${image.toString('base64')}`, x: 0, y: 0, w: 10, h: 5.625,
      altText: allSteps && slide.steps.length > 1 ? `${slide.title} (${slide.steps[step]})` : slide.title});
    slides++;
  });
  await writeAtomically(output, await pptx.write({outputType: 'nodebuffer'}) as Uint8Array);
  return {path: output, slides, mode: allSteps ? 'all-steps' : 'final'};
}

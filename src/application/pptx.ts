import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import { slideTransition, type DeckManifest, type Transition } from '../shared/manifest.ts';
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
  const entries: (Transition | 'step')[] = [];
  await forEachRenderedStep({url, manifest, allSteps, scale: 2}, async (page, slide, step) => {
    const image = await page.screenshot({clip: {x: 0, y: 0, width: 1280, height: 720}, type: 'png'});
    const sheet = pptx.addSlide();
    sheet.addImage({data: `image/png;base64,${image.toString('base64')}`, x: 0, y: 0, w: 10, h: 5.625,
      altText: allSteps && slide.steps.length > 1 ? `${slide.title} (${slide.steps[step]})` : slide.title});
    entries.push(allSteps && step > 0 ? 'step' : slideTransition(manifest, slide));
    slides++;
  });
  let file = await pptx.write({outputType: 'nodebuffer'}) as Uint8Array;
  if (entries.some(e => e === 'step' || e.type !== 'none')) file = await addTransitions(file, entries);
  await writeAtomically(output, file);
  return {path: output, slides, mode: allSteps ? 'all-steps' : 'final'};
}

// pptxgenjs has no transition API, so the OOXML transition element is added to each slide after
// <p:clrMapOvr>, where the PresentationML schema expects it. Slide entries follow the deck's
// transition schema; a further step of the same slide fades quickly, as step reveals do live.
const speeds = {fast: 'fast', medium: 'med', slow: 'slow'} as const;
const directions = {left: 'l', right: 'r', up: 'u', down: 'd'} as const;
export function transitionXml(entry: Transition | 'step') {
  if (entry === 'step') return '<p:transition spd="fast"><p:fade/></p:transition>';
  if (entry.type === 'none') return '';
  const effect = entry.type === 'fade' ? '<p:fade/>' : `<p:push dir="${directions[entry.direction]}"/>`;
  return `<p:transition spd="${speeds[entry.speed]}">${effect}</p:transition>`;
}
async function addTransitions(file: Uint8Array, entries: (Transition | 'step')[]) {
  const zip = await JSZip.loadAsync(file);
  for (let i = 0; i < entries.length; i++) {
    const element = transitionXml(entries[i]); if (!element) continue;
    const name = `ppt/slides/slide${i + 1}.xml`, xml = await zip.file(name)?.async('string');
    if (!xml || !xml.includes('</p:clrMapOvr>')) throw new Error(`Unexpected PowerPoint slide layout in ${name}`);
    zip.file(name, xml.replace('</p:clrMapOvr>', `</p:clrMapOvr>${element}`));
  }
  return zip.generateAsync({type: 'uint8array', compression: 'DEFLATE'});
}

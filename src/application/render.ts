import { chromium, type Page } from 'playwright';
import type { DeckManifest, SlideManifest } from '../shared/manifest.ts';
import { browserBinary } from './vite.ts';

// The normal slide source and step drive exports too; no second slide renderer.
// These styles normalize the active slide to exactly 1280×720 without Reveal's scaling.
const exportStyles = `
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

/**
 * Open each slide at its final step (or every step) in an isolated capture page, wait until it has
 * fully rendered, normalize it to one 1280×720 slide and hand the page to `visit`.
 */
export async function forEachRenderedStep({url, manifest, allSteps = false, scale = 1}: {url: string; manifest: DeckManifest; allSteps?: boolean; scale?: number},
  visit: (page: Page, slide: SlideManifest, step: number) => Promise<void>) {
  const browser = await chromium.launch({executablePath: await browserBinary()});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 720}, deviceScaleFactor: scale, reducedMotion: 'reduce'});
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
        await page.addStyleTag({content: exportStyles});
        await visit(page, slide, step);
      }
    }
  } finally {await browser.close();}
}

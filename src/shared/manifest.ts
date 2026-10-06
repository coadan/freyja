import { z } from 'zod';

export const identifier = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
export const relativeFile = z.string().refine(s => !!s && !s.startsWith('/') && !s.includes('\\') && !s.split('/').some(p => p === '..' || p === '.' || !p), 'Use a relative path inside the presentation');
// A path inside the presentation, or inside its profile when prefixed with `@profile/`.
export const sourceRef = z.string().refine(s => relativeFile.safeParse(s.startsWith('@profile/') ? s.slice(9) : s).success, 'Use a relative path inside the presentation or @profile/<path>');
// Profiles are shared directories outside the deck, so their path may leave it.
export const profilePath = z.string().refine(s => !!s && !s.startsWith('/') && !s.includes('\\') && !s.split('/').some(p => p === '.' || !p), 'Use a relative path from the presentation to its profile directory');
export const slideSchema = z.object({
  id: identifier, title: z.string().min(1), file: relativeFile.refine(s => s.endsWith('.tsx'), 'Slide must be TSX'),
  section: z.string().optional(), purpose: z.string().optional(), chrome: z.enum(['standard', 'bare']).default('standard'),
  variant: identifier.optional(),
  steps: z.array(z.string().min(1)).min(1).max(40),
  sources: z.array(z.string()).default([]),
}).strict();
export const deckSchema = z.object({
  version: z.literal(1), id: identifier, title: z.string().min(1),
  profile: profilePath.optional(),
  brand: sourceRef.default('brand.json'),
  slides: z.array(slideSchema).min(1).max(200),
}).strict().superRefine((deck, ctx) => {
  const ids = new Set<string>();
  deck.slides.forEach((s, i) => {
    if (ids.has(s.id)) ctx.addIssue({code: 'custom', path: ['slides', i, 'id'], message: 'Duplicate slide ID'});
    ids.add(s.id);
  });
});
export const brandSchema = z.object({
  name: z.string().min(1), logo: sourceRef.optional(),
  colors: z.object({background: z.string(), foreground: z.string(), muted: z.string(), accent: z.string(), surface: z.string(), border: z.string(), success: z.string(), warning: z.string(), danger: z.string()}),
  font: z.string().default('Inter, system-ui, sans-serif'),
  headingFont: z.string().optional(), radius: z.number().min(0).max(40).default(16),
  tokens: z.record(z.string().regex(/^[a-z][a-z0-9-]{0,63}$/), z.string()).default({}),
}).strict();
export const profileSchema = z.object({
  version: z.literal(1), name: z.string().min(1), description: z.string().optional(),
  template: relativeFile.optional(),
  styles: z.array(relativeFile).default([]),
  guidelines: z.array(z.object({file: relativeFile, purpose: z.string().min(1)}).strict()).default([]),
}).strict();
export type DeckManifest = z.infer<typeof deckSchema>;
export type SlideManifest = z.infer<typeof slideSchema>;
export type Brand = z.infer<typeof brandSchema>;
export type ProfileManifest = z.infer<typeof profileSchema>;
export type Position = {slideId: string; step: number};

export function normalizePosition(deck: DeckManifest, position: Position): Position {
  const slide = deck.slides.find(s => s.id === position.slideId) ?? deck.slides[0];
  return {slideId: slide.id, step: Math.max(0, Math.min(Number.isFinite(position.step) ? Math.floor(position.step) : 0, slide.steps.length - 1))};
}
export function advance(deck: DeckManifest, position: Position, direction: 1 | -1): Position {
  const p = normalizePosition(deck, position), i = deck.slides.findIndex(s => s.id === p.slideId);
  if (direction === 1) return p.step < deck.slides[i].steps.length - 1 ? {...p, step: p.step + 1} : {slideId: deck.slides[Math.min(i + 1, deck.slides.length - 1)].id, step: i === deck.slides.length - 1 ? p.step : 0};
  return p.step > 0 ? {...p, step: p.step - 1} : {slideId: deck.slides[Math.max(0, i - 1)].id, step: i > 0 ? deck.slides[i - 1].steps.length - 1 : 0};
}

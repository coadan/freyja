# Source authoring

`create_presentation` returns an absolute source directory. `inspect_presentation`
returns its manifest, brand, dependency graph, revision and SDK source path.

## Manifest

```json
{
  "version": 1, "id": "my-talk", "title": "A clear argument", "brand": "brand.json",
  "slides": [{
    "id": "recovery", "title": "What happens when the reply is lost?",
    "file": "slides/recovery.tsx", "section": "ARCHITECTURE",
    "purpose": "Explain retry safety using one request",
    "steps": ["Request", "Saved", "Reply lost", "Retry"], "sources": []
  }]
}
```

Optional `profile` is the relative path from the deck to a profile directory.
Optional per-slide `variant` (an identifier such as `section`) adds `variant-<name>`
and `data-variant` to the slide canvas so profile or deck CSS can restyle the whole
slide, including its background and chrome.

`steps[0]` is entry. Four labels mean steps 0–3, not four extra reveals. Stable IDs
preserve links when slides move. `chrome: "bare"` omits the regular title for a
centered title or custom scene. Title, order and step labels have one home: the
manifest. File paths stay inside the presentation. Don't nest `<section>` inside
slide content; Reveal interprets it as slide structure.

## TSX contract

```tsx
import {Reveal, StepTabs, type SlideProps} from '@freyja/sdk';
export default function Recovery({step}: SlideProps) {
  const states = ['Request sent', 'Saved', 'Reply lost', 'Result recovered'];
  return <>
    <StepTabs />
    <div>{states[step]}</div>
    <Reveal at={3}><p>The retry returns the existing result.</p></Reveal>
  </>;
}
```

Slides receive `{step, slide, goTo}`. `goTo(step)` updates the shared controller.
`StepTabs` reads the manifest. `Reveal` hides content while reserving space;
`reserve={false}` removes it from layout until its step.

Optional visual helpers are `Title`, `Columns`, `Card`, `Point`, `Icon`, `Metric`
and `StatePanel`. Use ordinary JSX, SVG and CSS for custom visuals. They are
presentation-owned code, not framework modes. Read the scaffold's recovery slide
and its local component for one example; don't copy its semantics into unrelated talks.

Derive scripted scene state from `step`. Avoid separate counters, timers or
accumulated mutations. A jump and reverse should reconstruct the scene exactly.
Handle genuinely exploratory interactions locally when they are part of the demo.

## Branding and assets

`brand.json` has `name`, optional `logo`, `font`, optional `headingFont`, `radius`
and colors: `background`, `foreground`, `muted`, `accent`, `surface`, `border`,
`success`, `warning`, `danger`. Deck CSS can use `var(--accent)` etc.

Optional `tokens` maps extra names to values, each exposed as a CSS variable
(`"tokens": {"highlight": "#FFC400"}` becomes `var(--highlight)`).

## Profiles

A profile directory holds `profile.json`:

```json
{
  "version": 1, "name": "Acme", "description": "Acme presentation house style",
  "template": "template",
  "styles": ["styles/acme.css"],
  "guidelines": [{"file": "guidelines/voice.md", "purpose": "Tone of voice for slide copy"}]
}
```

`create_presentation({profile})` copies `template` (a complete deck directory) and
records the relative `profile` path in `deck.json`. A deck references profile files
with `@profile/<path>`: `"brand": "@profile/brand.json"`, a logo, or a TSX/CSS
import such as `import {Statement} from '@profile/kit'`. Profile `styles` load after
the player's base styles and before deck CSS, so a deck can still override them.
Profile files count toward the deck revision. Restart the preview after changing
a deck's `profile` path. Profile components may import `react`, `lucide-react` icons and
`@freyja/sdk`; other packages don't resolve from outside the application checkout.

Import local assets and styles from TSX so Vite bundles them. Relative imports
share custom components between slides. Official logos are ordinary assets;
`Icon` accepts a generic name or imported image `src`. Use local/system fonts or
import deck-owned font files; check remote dependencies if introducing them.

## Preview and checks

The player uses arrows/space, G for searchable slide jump, O for overview and F
for fullscreen. Jumping starts at step 0; a URL can target a particular step.

`open_presentation({id, slideId, step})` navigates connected views or returns a
deep link. `render_slide` returns a PNG using an isolated view. It requires
Playwright Chromium or a compatible executable set through `FREYJA_BROWSER`.

Validation compiles sources and reports structural warnings; it is not a complete
semantic TypeScript check of arbitrary deck code. Check complex types separately.
Builds produce a static HTTP-served directory, not a single self-contained HTML
file. Imported local assets are bundled; explicit remote resources remain remote.

Source graph inspection covers static imports and explicit manifest/logo references.
Computed runtime asset paths aren't inferred. SQLite records catalog/revision hashes
and build outcomes; it is not source backup. Keep source in ordinary files or Git.

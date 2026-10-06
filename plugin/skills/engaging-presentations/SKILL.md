---
name: engaging-presentations
description: Explain complex topics through engaging Freyja HTML presentations, step-by-step interaction demos and adaptable branding. Use for presentation authoring and refinement, not generic websites or PowerPoint editing.
---

# Engaging presentations with Freyja

Make a complex topic understandable by demonstrating its interactions in manageable
steps. Freyja is a thin player; the story, visuals and behavior belong to source files.

## Choose what to demonstrate

Use the user's brief, audience, time budget and learning goal. Ask only for missing
information that changes the explanation. If the user wants an interview, work one
consequential decision at a time. Otherwise make a reasonable proposal and implement
it without forcing an interview or extra approval round.

Choose a concrete example before composing slides. A useful sequence is
**challenge → choice → interaction → consequence**. Introduce pieces before
assembling an architecture. Use this pattern where it helps, not as a fixed layout
for every slide. Separate actual behavior, illustrative scenarios and assumptions.

For new decks or substantial restructuring, read [storycraft](references/storycraft.md).

## Follow the deck's profile

A profile is a shared directory of brand, styles, components, a starter template
and written guidelines, for example an organization's presentation house style.
When the user names a profile or brand that has one, scaffold with
`create_presentation({profile: <directory>})`. When `inspect_presentation` returns
a `profile`, read every guideline it lists before writing or revising slides, and
follow them over the generic advice here where they conflict. Import shared
components from `@profile/...` instead of copying them into the deck. Propose
changes to the profile itself only when the user asks for them; it affects every deck.

## Author directly in source

Use `create_presentation` to scaffold, or `inspect_presentation` to locate existing
source and inspect order, steps, brand and dependencies. Read
[authoring](references/authoring.md) when writing a new slide or interaction.

Edit manifests, TSX, CSS and assets with normal file tools. MCP does not write source
or reorder slides. Keep the topic and brand in the deck. The runtime owns position,
navigation, scaling and theme application. SDK layouts and reveals are optional.
Build custom diagrams, maps, chat, charts and simulations as ordinary deck-owned
React; there are no prescribed scene types or behavior DSL.

Derive scripted state from `step` so reversing, jumping and reloading reproduce
the same interaction. Keep actual exploratory controls separate from the script.
Stable actors should stay in place; make the changed value, route or actor obvious.
Don't display arrows before their endpoints or reveal the payoff before its setup.

Use brand assets for named technologies when available and generic icons for
generic responsibilities. Preserve proportions; don't fabricate official logos.

## Review the explanation in context

Use `preview_presentation` and `open_presentation` to return URLs or navigate a
connected view. `get_presentation_state` reports its position. `render_slide`
captures an isolated step without moving the live presenter.

Review entry, intermediate and payoff states of custom interactions. Check that
each beat has a clear purpose and a visible change. Remove captions that merely
repeat the visual, cryptic slogans, duplicate slides and unnecessary labels.
Prefer a concrete interaction over a dense table when explaining a mechanism;
retain tables when they make a real comparison easier.

React to the specific feedback and preserve what works. "Too heavy" is not a
request to remove the technical argument. When converting static slides to HTML,
rethink composition and pacing rather than reproducing the original geometry.

Validate and build; compilation does not prove visual quality or the demonstrated
system's claims. Walk forward/back through changed interactions and check tabs,
slide jumps and deep-link reloads. Use `export_pdf` for a PDF handout: final rendered
slides by default, or `allSteps: true` to include every interaction state. Check the
PDF when requested; interactive scenes become static pages. Return the source and
preview locations.

The app only presents: no source editor, notes view or dashboard. Keep supporting
notes in separate documents when requested. Don't migrate an existing presentation,
publish it or install unrelated integrations unless asked.

When MCP is unavailable, use `node <FREYJA_ROOT>/scripts/cli.mjs`; the app defaults
to `~/repos/freyja`. See its README for commands. Report unavailable checks honestly.

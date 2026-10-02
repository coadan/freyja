# Freyja

Explain complex topics through presentations and step-by-step interaction demos.
Author ordinary TSX files; use MCP to preview, navigate, inspect and build them.

The local browser is the presentation: arrows, visible step tabs, a searchable
slide jump list, overview and fullscreen. No editor or presenter-notes dashboard.
Topic-specific behavior lives in deck source. The thin SDK supplies optional
layout/reveal helpers; the runtime owns navigation, scaling and themes.

## Start

Requires Node 24+.

```sh
npm ci
npx playwright install chromium
node scripts/cli.mjs create --id my-talk --title "My presentation"
node scripts/cli.mjs preview --id my-talk
```

The CLI starts a shared local app automatically. `npm run dev` runs it in the
foreground on port 4174. `node scripts/cli.mjs stop` stops the shared app.

Data defaults to `~/.local/share/freyja`; override with `FREYJA_DATA_DIR` or
`--data-dir`. `FREYJA_BROWSER` can point to an existing compatible Chromium/Chrome
executable instead of installing Playwright's browser.

Edit the returned directory: `deck.json`, `brand.json`, `slides/*.tsx` and assets.
Preview refreshes when files change. The scaffold contains illustrative placeholder
content: replace its argument and interactions for your topic.

```sh
node scripts/cli.mjs inspect --id my-talk
node scripts/cli.mjs open --id my-talk --slide recovery --step 2
node scripts/cli.mjs capture --id my-talk --slide recovery --step 2
node scripts/cli.mjs validate --id my-talk
node scripts/cli.mjs build --id my-talk
```

Build output is a static directory: serve it with any HTTP server. It needs no
Freyja backend. Imported assets are bundled; remote resources remain remote.
Use stable slide IDs; `#/slide-id/step` links survive reordering. G opens slide jump,
O opens overview, F toggles fullscreen, arrows and space move through steps.

## Codex plugin

The installable plugin is `plugin/`. Its `engaging-presentations` skill guides
the story and visual iteration. Its MCP launcher uses the checkout at `FREYJA_ROOT`
or `~/repos/freyja`. Run `npm ci` in that app checkout first. This lets a small
plugin snapshot operate the local app without vendoring its dependencies.

Add `plugin/` to a local Codex marketplace and install Freyja, then start a new
chat. Alternatively configure a local stdio MCP server with:

```json
{"command":"node","args":["/absolute/path/to/freyja/scripts/cli.mjs","mcp"]}
```

Example request: "Use Freyja to explain this repository's architecture through
concrete interactions, one step at a time, using its branding."

MCP tools: list, create, register, inspect, preview, open, state, render, validate
and build presentations. Creation scaffolds files; there is no source-editing tool.
Normal file edits control content, order and branding.

## Architecture and development

See [architecture](docs/architecture.md) and the skill's
[authoring reference](plugin/skills/engaging-presentations/references/authoring.md).

`npm run check` runs types, service/MCP tests and browser checks. SQLite stores
catalog and build metadata; source remains authoritative. Imported TSX is trusted
local code rendered by Vite. Freyja is not a sandbox for untrusted presentations.

# CLI and local data

Run `node scripts/cli.mjs --help` from the application checkout. Node.js 24+ and
`npm ci` are required. Commands return JSON except help, version and stop; local
server status goes to stderr.

| Command | Arguments / purpose |
| --- | --- |
| `create` | `--id my-talk --title "My talk" [--theme editorial\|midnight] [--directory /path/to/new-deck] [--profile /path/to/profile]` |
| `register` | `--directory /path/to/existing-deck` |
| `list` | List registered presentations |
| `inspect` | `--id my-talk`; source graph, brand, steps and revision |
| `preview` | `--id my-talk`; start preview and return its URL |
| `open` | `--id my-talk --slide recovery --step 2`; navigate connected views |
| `capture` | Same position arguments; capture a step without moving the presenter |
| `validate` | `--id my-talk`; check source syntax and bundling |
| `pdf` | `--id my-talk [--all-steps]`; export final slides or every step |
| `pptx` | `--id my-talk [--all-steps]`; PowerPoint with one 2× image per rendered slide |
| `build` | `--id my-talk`; produce a static export directory |
| `serve` | `[--port 4174]`; foreground loopback service |
| `mcp` | Run the stdio MCP interface |
| `stop` | Stop the shared app for this data directory |
| `--version` | Print application version |

## Process and storage

Operations start a shared app automatically on an available loopback port. `npm run
dev` starts a foreground service on port 4174. Use `--port 0` with `serve` to choose
an available port. A data directory has one shared service; its process and token
are recorded in `runtime.json`.

Default data directory: `~/.local/share/freyja`. Override it with `FREYJA_DATA_DIR`
or `--data-dir /absolute/path`. It holds the SQLite catalog, default presentation
sources, validation/build output and captures. Registered source directories can
live elsewhere. Back up presentation source separately; SQLite is metadata.

## Screenshots

```sh
npx playwright install chromium
node scripts/cli.mjs capture --id my-talk --slide recovery --step 3
```

Use `FREYJA_BROWSER=/absolute/path/to/chromium` for an existing compatible browser.
On Linux, browser checks may need `npx playwright install --with-deps chromium`.
Creating, authoring, previewing and building do not require a Playwright browser.

## Share a build

```sh
node scripts/cli.mjs build --id my-talk
```

Serve the returned output directory with any static HTTP server. No Freyja backend
is needed. Navigation and scripted steps work in the export. Imported assets are
bundled; externally hosted resources still need network access. The export is a
directory, not a single self-contained HTML file. Validation checks syntax and
bundling, not complete TypeScript semantics, visual quality or factual accuracy.

## PDF handouts

```sh
node scripts/cli.mjs pdf --id my-talk
node scripts/cli.mjs pdf --id my-talk --all-steps
```

The default is one page per slide at its final scripted step, including all
progressive reveals visible in that state. `--all-steps` includes every state in
slide order. If a scene replaces earlier content, only the final version appears
in the default handout; choose all steps to show its progression.

PDF export runs the actual deck in isolated Chromium pages, waits for fonts and
images, and prints 16:9 pages with backgrounds. Text stays selectable; SVG stays
vector, while canvas and raster media retain their own resolution. Playback,
animations and interactive controls become static states. The live preview's
position does not move. Files are stored under the data directory's `exports/`.

The live presenter has an **Export PDF** toolbar button for the default handout.
It is omitted from static HTML exports because those have no local app backend.
Use MCP `export_pdf` with `allSteps: true` for the expanded version. After upgrading
the application, stop the existing service with `node scripts/cli.mjs stop`,
then run preview again to load the updated backend.

## PowerPoint export

```sh
node scripts/cli.mjs pptx --id my-talk
node scripts/cli.mjs pptx --id my-talk --all-steps
```

The PPTX uses the same isolated rendering as the PDF. Each slide becomes a full-bleed PNG at
2× resolution on a 16:9 PowerPoint slide, with the slide title as the image's alt text. The
result looks exactly like the deck in PowerPoint, Keynote and Google Slides, but text and shapes
aren't editable there. Files are stored under the data directory's `exports/`. The live
presenter has an **Export PPTX** toolbar button; MCP `export_pptx` takes `allSteps: true`.

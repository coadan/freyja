# CLI and local data

Run `node scripts/cli.mjs --help` from the application checkout. Node.js 24+ and
`npm ci` are required. Commands return JSON except help, version and stop; local
server status goes to stderr.

| Command | Arguments / purpose |
| --- | --- |
| `create` | `--id my-talk --title "My talk" [--theme editorial\|midnight] [--directory /path/to/new-deck]` |
| `register` | `--directory /path/to/existing-deck` |
| `list` | List registered presentations |
| `inspect` | `--id my-talk`; source graph, brand, steps and revision |
| `preview` | `--id my-talk`; start preview and return its URL |
| `open` | `--id my-talk --slide recovery --step 2`; navigate connected views |
| `capture` | Same position arguments; capture a step without moving the presenter |
| `validate` | `--id my-talk`; check source syntax and bundling |
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

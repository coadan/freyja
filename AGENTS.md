# Freyja

Use local Workbench delivery. Publish commits or releases only when the user asks.
See [contribution guidance](CONTRIBUTING.md) and the [docs index](docs/README.md).

- Presentations are ordinary source directories. Agents edit TSX, manifests,
  themes and assets with file tools; MCP must not expose source-writing tools.
- The browser is the presentation interface, with slide navigation. No studio,
  source editor, notes view or presenter dashboard.
- SQLite stores catalog and inspection/build metadata, not authoritative slides.
- Keep topic and brand choices in deck or profile source, not the runtime.
- One `{slideId, step}` position drives keys, tabs, URLs and MCP navigation.
- Preserve the distinction between rendering a demonstration and proving its claims.
- `npm run check` verifies types, service/MCP behavior and real browser navigation.
- Codex and Claude Code share `plugin/skills/` and the MCP launcher. Keep client
  manifests and marketplace catalogs compatible with their respective formats.
- Installed plugins launch the app from `FREYJA_ROOT` or `~/repos/freyja`.
  Dependencies belong to that application checkout, not the plugin cache.

# Freyja

Local delivery through Workbench. No remote publication is configured.

- Presentations are ordinary source directories. Agents edit TSX, manifests,
  themes and assets with file tools; MCP must not expose source-writing tools.
- The browser is the presentation interface, with slide navigation. No studio,
  source editor, notes view or presenter dashboard.
- SQLite stores catalog and inspection/build metadata, not authoritative slides.
- Keep topic and brand choices in deck source, not the runtime.
- One `{slideId, step}` position drives keys, tabs, URLs and MCP navigation.
- Preserve the distinction between rendering a demonstration and proving its claims.
- `npm run check` verifies types, service/MCP behavior and real browser navigation.
- Installed plugins launch the app from `FREYJA_ROOT` or `~/repos/freyja`.
  Dependencies belong to that application checkout, not the plugin cache.

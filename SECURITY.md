# Security

Freyja is experimental software for trusted local presentations. Imported TSX
runs through Vite and executes JavaScript in the browser. It is not a sandbox for
untrusted presentations or a multi-user hosted service.

The app binds to loopback. Catalog and application operations require a local
runtime token; browser position updates use loopback and origin checks. MCP clients
operate with the permissions of the local user. Do not expose the app
through a public listener or reverse proxy. Presentation code can import assets
and load remote resources; review source before running someone else's deck.

Keep `~/.local/share/freyja` and custom data directories private. They contain
source locations, runtime tokens, captures and presentation files. Static exports
contain the presentation's bundled source assets; check them before sharing.

## Report a vulnerability

Use [GitHub's private vulnerability reporting](https://github.com/coadan/freyja/security/advisories/new)
to report security problems. Include the affected revision, a minimal reproduction
and the impact. Do not include real credentials or private presentation content in
public issues. Ordinary bugs can use the issue tracker.

Security fixes target the current `main` branch. There are no separately supported
release branches yet.

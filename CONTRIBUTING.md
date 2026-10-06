# Contributing

Keep changes focused and explain the problem, the resulting behavior and how you
checked it. Open an issue for a substantial runtime or interface change before
building it. Small fixes and documentation improvements can go straight to a PR.

Read [AGENTS.md](AGENTS.md) for source and runtime boundaries, and
[the architecture](docs/architecture.md) before changing them.

## Work locally

Requires Node.js 24+.

```sh
npm ci
npx playwright install chromium
npm run check
```

On Linux, `npx playwright install --with-deps chromium` installs browser system
dependencies too. `npm run typecheck`, `npm test` and `npm run test:browser` run
individual checks. The complete check is required before delivery.

Add regression coverage for meaningful runtime changes: position synchronization,
source authority, MCP contracts, path containment and static exports are useful
boundaries. Walk changed interactions forward and backward and inspect their entry
and payoff states. Rendering a demo does not prove the system it depicts.

The repository uses local Workbench delivery for agent tasks. Contributors can
use a normal branch and pull request; Workbench is not an application dependency.
Do not commit runtime catalogs, local decks, credentials, personal paths or
Workbench checkouts. Keep the shared plugin skill in one place and verify both
plugin formats when packaging changes.

## Review

Describe why the change is needed, include the relevant validation, and link any
issue it resolves. For presentation behavior, include a screenshot or short
sequence showing what changed. For new public commands, update the CLI guide and
quick start where appropriate.

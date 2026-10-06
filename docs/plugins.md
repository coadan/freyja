# Codex and Claude Code plugins

Freyja has one plugin source directory, `plugin/`, with client-specific manifests.
Both load the same skill and run the same stdio MCP launcher. Install the local
application first: clone this repo to `~/repos/freyja` and run `npm ci` there.
The cached plugin does not contain the application or its dependencies.

## Codex

From the repository root:

```sh
codex plugin marketplace add .
codex plugin add freyja@freyja-local
```

The catalog is `.agents/plugins/marketplace.json`. The client manifest is
`plugin/.codex-plugin/plugin.json`, and `plugin/.codex-plugin/mcp.json` resolves the launcher
with `${CODEX_PLUGIN_ROOT}`. Start a new chat to load the skill and tools.

## Claude Code

From the repository root:

```sh
claude plugin marketplace add .
claude plugin install freyja@freyja-local
```

The catalog is `.claude-plugin/marketplace.json`. The client manifest is
`plugin/.claude-plugin/plugin.json`; its inline MCP definition resolves the same
launcher with `${CLAUDE_PLUGIN_ROOT}`. The two client configurations stay separate. Start a new session and ask for a Freyja presentation, or
invoke `/freyja:engaging-presentations` explicitly.

For development without installing, run `claude --plugin-dir ./plugin`.
Validate the package with `claude plugin validate ./plugin` and the marketplace
with `claude plugin validate .` when Claude Code is available.

## Alternate checkout location

The launcher uses `FREYJA_ROOT` when set, otherwise an application checkout beside
the source plugin, otherwise `~/repos/freyja`. If you cloned elsewhere, set the
absolute `FREYJA_ROOT` in the environment that launches your agent. Launch desktop
clients from that environment, or use a direct MCP configuration with an explicit
path. Run `npm ci` in that checkout first.

A direct stdio MCP configuration for clients without plugin support is:

```json
{
  "mcpServers": {
    "freyja": {
      "command": "node",
      "args": ["/absolute/path/to/freyja/scripts/cli.mjs", "mcp"]
    }
  }
}
```

This connects tools only. To get the presentation workflow too, provide the
[shared skill](../plugin/skills/engaging-presentations/SKILL.md) and its references
to the agent using that client's skill mechanism.

## Tool boundaries

Tools list, create, register, inspect, preview, open, get state, render, validate
and build presentations. Source editing stays in the agent's normal file tools.
Preview and open return URLs; they do not automatically open an OS browser.
Captures use isolated browser pages so they do not move your live presentation.

No API keys or accounts are needed by Freyja itself. The agent client has its own
account requirements. Install only one Freyja package per client to avoid duplicate
tool registrations. Source, metadata and trust rules are described in
[the architecture](architecture.md) and [security guide](../SECURITY.md).

Packaging follows the official [Codex plugin documentation](https://developers.openai.com/plugins/build/plugins)
and [Claude Code manifest reference](https://code.claude.com/docs/en/plugins-reference).

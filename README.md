# claude-ltm-plugin

Long-Term Memory (LTM) plugin for Claude Code. Provides persistent semantic memory across sessions with FTS5 + vector search, automatic context injection, session learning, and a graph visualizer.

## Features

- **Semantic memory** — store and retrieve memories with FTS5 full-text search + embedding fallback
- **Context injection** — SessionStart hook injects relevant memories at the start of every session
- **Session learning** — EvaluateSession hook auto-extracts patterns, errors, and decisions from transcripts
- **Memory graph** — Next.js visualizer with cluster detection and relationship traversal
- **Secrets scrubber** — strips API keys and tokens before writing to DB

## Structure

```
src/              TypeScript source (MCP server + DB layer)
hooks/src/        Session lifecycle hooks (bun-native TypeScript)
hooks/hooks.json  Hook registrations for the plugin system
skills/           Claude Code skills (ContinuousLearning, LtmServer, Learned)
graph-app/        Next.js graph visualizer (port 7332)
data/ltm.db       SQLite database (user data, not committed)
migrations/       SQL schema migrations
```

## Installation

### As a local plugin

```bash
git clone https://github.com/RohiRIK/claude-ltm-plugin ~/Projects/claude-ltm-plugin
# Plugin registration depends on your Claude Code plugin manager
```

### Manual MCP registration

```bash
claude mcp add ltm bun -- run ~/Projects/claude-ltm-plugin/src/mcp-server.ts --scope user
```

Set `LTM_DB_PATH` env var to point to your database (default: `data/ltm.db` relative to plugin root).

## MCP Tools

| Tool | Description |
|------|-------------|
| `ltm_recall` | Search memories with FTS5 + semantic fallback |
| `ltm_learn` | Store a new memory |
| `ltm_relate` | Create a relationship between memories |
| `ltm_forget` | Delete a memory |
| `ltm_graph` | Traverse memory graph |
| `ltm_context` | Get per-project context items |

## Graph Visualizer

```bash
cd graph-app
bun dev --port 7332
# API server
LTM_DB_PATH=../data/ltm.db bun run ../src/graph-server.ts
```

## Configuration

Configure via `~/.claude/config.json`:

```json
{
  "ltm": {
    "dbPath": "~/Projects/claude-ltm-plugin/data/ltm.db",
    "decayEnabled": true,
    "injectTopN": 15,
    "semanticFallback": true,
    "graphReasoning": false,
    "evaluateSessionLlm": false
  }
}
```

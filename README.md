# claude-ltm-plugin

Long-Term Memory (LTM) plugin for Claude Code. Provides persistent semantic memory across sessions with FTS5 + vector search, automatic context injection, session learning, and a graph visualizer.

## Features

- **Semantic memory** — store and retrieve memories with FTS5 full-text search + embedding fallback
- **Context injection** — SessionStart hook injects relevant memories at the start of every session
- **Session learning** — EvaluateSession hook auto-extracts patterns, errors, and decisions from transcripts
- **Memory graph** — Next.js visualizer with cluster detection and relationship traversal
- **Secrets scrubber** — strips API keys and tokens before writing to DB

## Installation

### Marketplace (recommended)

```bash
claude plugin marketplace add https://github.com/RohiRIK/claude-ltm-plugin
claude plugin install ltm
```

Then restart Claude Code. The plugin auto-wires:
- `ltm` MCP server
- `SessionStart`, `Stop`, and `PreCompact` hooks
- LTM skills (`/ltm:ContinuousLearning` etc.)
- Database at `~/.claude/plugins/data/ltm/ltm.db` (persists across updates)

### Dev / git-clone flow

```bash
git clone https://github.com/RohiRIK/claude-ltm-plugin ~/Projects/claude-ltm-plugin
cd ~/Projects/claude-ltm-plugin && bash install.sh
```

Database lives at `~/.claude/memory/ltm.db` in this mode.

---

## Verifying it works

After install + restart:

### 1. MCP server is live
```
/doctor
```
Look for `ltm` in the MCP servers list with status ✔.

### 2. Recall works
```
/recall test
```
Should return memories (or "no results" if DB is empty — that's fine).

### 3. Learn works
```
/learn "LTM plugin installed successfully"
```
Should confirm the memory was stored.

### 4. Context injection fires at session start
Start a new Claude Code session. You should see a `## Restored Project Context` block and an `LTM:` section injected at the top.

### 5. Graph visualizer (optional)
```bash
cd ~/.claude/plugins/cache/ltm/ltm/*/graph-app
bun dev --port 7332
# In a second terminal:
bun run ../src/graph-server.ts
```
Open http://localhost:7332 to see your memory graph.

---

## Structure

```
src/              TypeScript source (MCP server + DB layer)
hooks/src/        Session lifecycle hooks (bun-native TypeScript)
hooks/hooks.json  Hook registrations (auto-wired on install)
scripts/          Install utilities
skills/           Claude Code skills
graph-app/        Next.js graph visualizer (port 7332)
migrations/       SQL schema migrations
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `ltm_recall` | Search memories with FTS5 + semantic fallback |
| `ltm_learn` | Store a new memory |
| `ltm_relate` | Create a relationship between memories |
| `ltm_forget` | Delete a memory |
| `ltm_graph` | Traverse memory graph |
| `ltm_context` | Get per-project context items |
| `ltm_context_items` | List context items by type |

## Configuration

Configure via `~/.claude/config.json`:

```json
{
  "ltm": {
    "decayEnabled": true,
    "injectTopN": 15,
    "semanticFallback": true,
    "graphReasoning": false,
    "evaluateSessionLlm": false
  }
}
```

**Database path priority:**
1. `LTM_DB_PATH` env var (explicit override)
2. `CLAUDE_PLUGIN_DATA/ltm.db` (marketplace install — set automatically)
3. `~/.claude/memory/ltm.db` (dev/install.sh fallback)

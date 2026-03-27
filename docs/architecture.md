# Architecture

## Overview

The plugin has four layers that communicate through a single SQLite database (`ltm.db`).

```
  Commands --+
  Skills   --+---->  ltm MCP server  ---->  ltm.db
  Hooks    --/          (bun)              (SQLite + FTS5)
```

## MCP Server (`src/mcp-server.ts`)

Runs as a stdio MCP server via `bun run`. Exposes 7 tools. All DB access from commands and skills goes through here.

Hooks bypass MCP and write to the DB directly via `bun:sqlite` — they run at session boundaries where the MCP server may not be live.

### Response Format

`ltm_recall` returns compact responses by default to minimize context window usage:
- Content truncated to 300 chars
- Relations reduced to `{id, type, dir}`
- Only essential fields: `id`, `content`, `category`, `importance`, `tags`, `project_scope`
- Pass `verbose: true` for full memory objects

## Database Schema

```sql
memories
  id, content, category, importance, confidence
  source, project_scope, dedup_key, status
  created_at, last_confirmed_at, last_used_at, confirm_count

memories_fts          -- FTS5 virtual table for full-text search
  content

context_items
  project, type (goal|decision|progress|gotcha), content, updated_at

memory_relations
  source_memory_id, target_memory_id, relationship_type

tags
  id, name

memory_tags
  memory_id, tag_id

settings
  key, value
```

## DB Path Resolution

```
Priority:
  1. LTM_DB_PATH env var            (explicit override -- always wins)
  2. $CLAUDE_PLUGIN_DATA/ltm.db     (marketplace install)
  3. ~/.claude/memory/ltm.db        (dev / git clone)

Code:
  hooks/lib/resolveProject.ts -> getDbPath()
  src/shared-db.ts            -> DB_PATH
```

## Hook Architecture

Hooks run as shell commands triggered by Claude Code lifecycle events. Each is a standalone bun TypeScript file. They receive `CLAUDE_PLUGIN_ROOT` and `LTM_DB_PATH` via env vars set in `hooks/hooks.json`.

| Hook | Event | Purpose |
|------|-------|---------|
| `SessionStart.ts` | Session opens | Inject context + top memories |
| `UpdateContext.ts` | Session stops | Save progress to `context_items` |
| `EvaluateSession.ts` | Session stops | Extract patterns from transcript |
| `PreCompact.ts` | Before compaction | Snapshot context to `context-summary.md` |
| `GitCommit.ts` | After git commit | Extract learnings from diffs (opt-in) |
| `NotifyLtmServer.ts` | After memory change | Push update to graph visualizer |

Shared utilities live in `hooks/lib/`:
- `resolveProject.ts` — project name resolution from registry
- `llmExtract.ts` — shared `extractAndLearn()` used by both `EvaluateSession` and `GitCommit`

## Plugin Wiring

The Claude Code plugin system processes these files on `claude plugin install`:

| File | What Gets Wired |
|------|----------------|
| `.claude-plugin/plugin.json` | MCP server, commands dir, skills dir |
| `hooks/hooks.json` | 6 lifecycle hooks |
| `CLAUDE.md` | Loaded into Claude's context |

Post-install, `scripts/install-wiring.ts` also:
- Patches `known_marketplaces.json` to use GitHub API for updates (self-healing)
- Migrates `ltm.db` from legacy path if needed
- Wires global git hooks for `GitCommit` hook

## Memory Decay

Memories have a relevance score computed from:

```
score = importance x confidence x decay_factor
decay_factor = 0.5 ^ (days_since_last_access / half_life)
```

| Importance | Half-Life |
|:----------:|:---------:|
| 5 | Infinity (never decays) |
| 4 | 180 days |
| 3 | 90 days |
| 2 | 30 days |
| 1 | 14 days |

Memories with score below 0.25 are soft-deprecated (not deleted, excluded from results).

## Graph Visualizer

`graph-app/` is a Next.js application that renders the memory graph:
- API server (`src/graph-server.ts`) on port 7331
- React UI on port 7332
- Uses `react-force-graph-2d` for force-directed visualization
- Includes Config Explorer and Health dashboard pages

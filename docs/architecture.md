# Architecture

## Overview

The plugin has four layers that talk through a single SQLite database (`ltm.db`).

```
  Commands ──┐
  Skills   ──┼──▶  ltm MCP server  ──▶  ltm.db
  Hooks    ──┘         (bun)            (SQLite)
```

## MCP Server (`src/mcp-server.ts`)

Runs as a stdio MCP server via `bun run`. Exposes 7 tools. All DB access goes through here for commands and skills.

Hooks bypass MCP and write to the DB directly via `bun:sqlite` — they run at session boundaries where the MCP server may not be live.

## Database schema

```
memories
  id, content, category, importance, confidence
  confirm_count, project_scope, tags
  created_at, last_accessed, status

context_items
  project, type (goal|decision|progress|gotcha), content, updated_at

memory_relations
  source_id, target_id, relationship_type

settings
  key, value
```

## DB path resolution

```
Priority:
  1. LTM_DB_PATH env var          (explicit override — always wins)
  2. $CLAUDE_PLUGIN_DATA/ltm.db   (marketplace install)
  3. ~/.claude/memory/ltm.db      (dev / git clone)

Code:
  hooks/lib/resolveProject.ts → getDbPath()
  src/config.ts               → DEFAULTS.ltm.dbPath
```

## Hook architecture

Hooks run as shell commands triggered by Claude Code lifecycle events. Each is a standalone bun TypeScript file. They receive `CLAUDE_PLUGIN_ROOT` and `LTM_DB_PATH` via env vars set in `hooks/hooks.json`.

```
SessionStart.ts   — inject context into session (reads DB, writes context-summary.md)
UpdateContext.ts  — save progress after stop (writes context_items)
EvaluateSession.ts — extract patterns from transcript (writes memories)
PreCompact.ts     — snapshot context before compaction (writes context-summary.md)
```

## Plugin wiring

The Claude Code plugin system processes these files on `claude plugin install`:

| File | What gets wired |
|------|----------------|
| `.claude-plugin/plugin.json` | MCP server, commands dir, skills dir |
| `hooks/hooks.json` | 4 lifecycle hooks |
| `CLAUDE.md` | Loaded into Claude's context |

## Memory decay

Memories have a relevance score computed from:
```
score = importance × confidence × recency_factor × (1 + confirm_count × 0.1)
recency_factor = e^(-age_days / 30)
```

High-importance memories (5) never decay. Lower-importance memories fade if not accessed.

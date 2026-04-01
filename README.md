<div align="center">

# claude-ltm-plugin

**Long-Term Memory for Claude Code**

[![Version](https://img.shields.io/badge/version-1.3.9-blue?style=flat-square)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Runtime](https://img.shields.io/badge/runtime-Bun-f472b6?style=flat-square&logo=bun)](https://bun.sh)
[![Database](https://img.shields.io/badge/database-SQLite-003B57?style=flat-square&logo=sqlite)](https://sqlite.org)
[![Claude Code](https://img.shields.io/badge/Claude_Code-plugin-cc785c?style=flat-square)](https://docs.anthropic.com/en/docs/claude-code)
[![MCP](https://img.shields.io/badge/MCP-compatible-8B5CF6?style=flat-square)](https://modelcontextprotocol.io)

Persistent semantic memory that survives every session, every update, every compaction.
FTS5 full-text search + vector embeddings, automatic context injection, session learning,
memory decay, graph relationships, and a visual explorer — zero config.

[Install](#install) | [How It Works](#how-it-works) | [Commands](#commands) | [MCP Tools](#mcp-tools) | [Config](#configuration) | [Docs](#docs)

</div>

---

## Why

Claude Code forgets everything between sessions. This plugin gives it a brain:

- **Recall** past decisions, patterns, and gotchas before starting work
- **Learn** from every session automatically — no manual note-taking
- **Inject** relevant context at session start so Claude picks up where it left off
- **Decay** stale memories naturally while preserving critical knowledge forever
- **Graph** relationships between memories for reasoning chains
- **Visualize** the entire memory network in a browser-based explorer

---

## Install

### Marketplace (recommended)

```bash
claude plugin marketplace add https://github.com/RohiRIK/claude-ltm-plugin
claude plugin install ltm
```

Restart Claude Code. That's it.

<details>
<summary><b>What happens on install</b></summary>

```
claude plugin install ltm
         |
         v
  +----------------------------------+
  |  Plugin system sets:             |
  |  CLAUDE_PLUGIN_ROOT -> code      |
  |  CLAUDE_PLUGIN_DATA -> your data |
  +----------------------------------+
         |
         +---> MCP server auto-wired     ok
         +---> 6 hooks auto-wired        ok
         +---> 13 commands loaded         ok
         +---> 5 skills loaded            ok
         +---> CLAUDE.md loaded           ok
         +---> ltm.db migrated/created    ok
                    |
              restart Claude Code
                    |
                    v
               ready to go
```

</details>

### Dev / git clone

```bash
git clone https://github.com/RohiRIK/claude-ltm-plugin ~/Projects/claude-ltm-plugin
cd ~/Projects/claude-ltm-plugin && bash install.sh
```

---

## How It Works

```
+---------------------------------------------------------------+
|                        Claude Code                             |
|                                                                |
|  +---------------+  +--------------+  +--------------------+  |
|  |  13 Commands  |  |   5 Skills   |  |     6 Hooks        |  |
|  |  /recall      |  |  Continuous  |  |  SessionStart      |  |
|  |  /learn       |  |  Learning    |  |  UpdateContext      |  |
|  |  /capture     |  |  LtmServer   |  |  EvaluateSession   |  |
|  |  /forget      |  |  GitLearn    |  |  PreCompact         |  |
|  |  + 9 more     |  |  Learned     |  |  GitCommit          |  |
|  +-------+-------+  +------+-------+  |  NotifyLtmServer   |  |
|          +------------------+----------+--------+            |  |
|                             |                                  |
|                    +--------v--------+                         |
|                    |   ltm MCP       |                         |
|                    |   server        |                         |
|                    +--------+--------+                         |
+-----------------------------|---------------------------------+
                              |
                   +----------v-----------+
                   |       ltm.db         |
                   |  +-----------------+ |
                   |  | memories        | |
                   |  | context_items   | |
                   |  | memory_relations| |
                   |  | tags            | |
                   |  | memories_fts    | |
                   |  +-----------------+ |
                   +----------------------+
```

### Session Lifecycle

| Phase | What Happens |
|-------|-------------|
| **Session Start** | `SessionStart` hook injects top memories (importance >= 3) + project context (goals, decisions, gotchas) |
| **During Work** | Use `/ltm:recall` before tasks, `/ltm:learn` after discoveries. MCP tools are called automatically by Claude. |
| **Session Stop** | `UpdateContext` saves progress. `EvaluateSession` extracts patterns from the transcript. |
| **Pre-Compact** | `PreCompact` snapshots context to `context-summary.md` so it survives compaction. |

### Memory Decay

Memories have half-lives based on importance:

| Importance | Half-Life | Behavior |
|:----------:|:---------:|----------|
| 5 | Forever | Never decays. Injected every session. |
| 4 | 180 days | Long-lived architectural decisions |
| 3 | 90 days | Standard patterns and workflows |
| 2 | 30 days | Short-lived context |
| 1 | 14 days | Ephemeral — fades fast if not accessed |

Score = `importance x confidence x decay_factor`. Below 0.25 = soft-deprecated.

---

## Commands

All available as `/ltm:<command>` after install.

### Memory

| Command | Description |
|---------|-------------|
| `/ltm:recall` | Search memories — FTS5 + semantic fallback |
| `/ltm:learn` | Store a memory or auto-extract from session |
| `/ltm:forget` | Delete a memory by ID (cascades to relations) |
| `/ltm:relate` | Link two memories with a typed relationship |
| `/ltm:capture` | Save context item + LTM memory in one shot |

### Context

| Command | Description |
|---------|-------------|
| `/ltm:init-context` | Seed a new project's initial goal |
| `/ltm:migrate-db` | Migrate ltm.db from legacy path to plugin data dir |

### Diagnostics

| Command | Description |
|---------|-------------|
| `/ltm:decay-report` | Score distribution + at-risk memories |
| `/ltm:health` | Project health scores dashboard |
| `/ltm:hook-doctor` | Hook health check (file existence + errors) |
| `/ltm:secrets-scan` | Scan memories for leaked secrets, redact in-place |
| `/ltm:migrate` | Schema migration control (status/up/down/reset) |

### Server

| Command | Description |
|---------|-------------|
| `/ltm:ltm-server` | Start/stop/status the graph visualization server |

---

## MCP Tools

These are called programmatically by Claude (or by hooks). You don't invoke them directly.

| Tool | Description |
|------|-------------|
| `ltm_recall` | Search memories. FTS5 first, semantic fallback if needed. Compact response by default. |
| `ltm_learn` | Store or reinforce a memory. Deduplicates automatically. |
| `ltm_forget` | Delete a memory by ID. Cascades to relations. |
| `ltm_relate` | Create a typed relationship between two memories. |
| `ltm_graph` | Traverse the memory graph from seed nodes. |
| `ltm_context` | Get merged context (globals + project-scoped) for a project. |
| `ltm_context_items` | List context items by type (goal/decision/progress/gotcha). |

---

## Hooks

Auto-wired on install. No manual setup required.

| Hook | Event | What It Does |
|------|-------|-------------|
| `SessionStart` | Session opens | Injects memories + context into the session |
| `UpdateContext` | Session stops | Saves session progress to `context_items` |
| `EvaluateSession` | Session stops | Extracts patterns from transcript into `memories` |
| `PreCompact` | Before compaction | Snapshots context to survive compaction |
| `GitCommit` | After git commit | Extracts learnings from diffs (opt-in) |
| `NotifyLtmServer` | After memory change | Pushes updates to the graph visualizer |

---

## Configuration

`~/.claude/config.json`:

```jsonc
{
  "ltm": {
    "decayEnabled": true,        // Enable memory relevance decay
    "injectTopN": 15,            // Max memories injected at SessionStart
    "semanticFallback": true,    // Embedding search when FTS5 returns nothing
    "autoRelate": true,          // Auto-link related memories
    "graphReasoning": false,     // Graph-based reasoning during recall
    "evaluateSessionLlm": false, // LLM-powered session evaluation (costs tokens)
    "gitLearnEnabled": false,    // Auto-learn from git commits
    "gitLearnMinDiffChars": 200  // Min diff size for git learning
  }
}
```

<details>
<summary><b>All config options</b></summary>

| Key | Default | Description |
|-----|---------|-------------|
| `dbPath` | auto-resolved | Override db location (prefer `LTM_DB_PATH` env var) |
| `decayEnabled` | `true` | Enable memory relevance decay over time |
| `injectTopN` | `15` | Max memories to inject at SessionStart |
| `autoRelate` | `true` | Automatically link related memories |
| `graphReasoning` | `false` | Enable graph-based reasoning during recall |
| `evaluateSessionLlm` | `false` | Use LLM to evaluate sessions (costs tokens) |
| `semanticFallback` | `true` | Fall back to embedding search when FTS returns no results |
| `gitLearnEnabled` | `false` | Auto-extract learnings from git commits |
| `gitLearnMinDiffChars` | `200` | Minimum diff size to trigger git learning |
| `gitLearnFileFilter` | `[]` | Only learn from these file patterns |
| `gitLearnIgnorePatterns` | `["*.lock", "dist/", ".min.js"]` | Skip these files |

</details>

### DB Path Resolution

```
Priority:
  1. LTM_DB_PATH env var          -> explicit override, always wins
  2. $CLAUDE_PLUGIN_DATA/ltm.db   -> marketplace install
  3. ~/.claude/memory/ltm.db      -> dev / git clone fallback
```

Your memories are stored outside the plugin code directory — they survive `claude plugin update`.

---

## Graph Visualizer

The plugin includes a Next.js app for exploring your memory graph visually.

```bash
/ltm:ltm-server start
```

Opens a browser at `localhost:7332` with:
- **Force-directed graph** of all memories and their relationships
- **Config Explorer** for browsing LTM configuration
- **Health dashboard** with per-project scores
- Search, filter, and inspect individual memories

---

## Project Structure

```
src/                  MCP server, DB layer, embeddings, graph traversal
hooks/src/            6 lifecycle hooks (SessionStart, Stop x2, PreCompact, GitCommit, Notify)
hooks/lib/            Shared hook utilities (resolveProject, llmExtract)
hooks/hooks.json      Hook registrations (auto-wired on install)
commands/             13 slash commands (/ltm:recall, /ltm:learn, etc.)
skills/               5 Claude Code skills
scripts/              install-wiring.ts, update-wiring.ts
graph-app/            Next.js memory graph visualizer (port 7332)
migrations/           SQL schema migrations
.claude-plugin/       Plugin manifest (plugin.json)
CLAUDE.md             Loaded by Claude — tool reference
CHANGELOG.md          Version history
```

---

## Docs

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | Technical deep-dive — layers, schema, hook architecture, decay formula |
| [Commands](docs/commands.md) | Full command reference with examples |
| [Configuration](docs/configuration.md) | All config options, DB path resolution, server settings |
| [Migration](docs/migration.md) | Upgrading from old `~/.claude/memory/` setup |
| [LLM Migration Guide](docs/llm-migration-guide.md) | Curl-injectable guide for LLMs to perform migration autonomously |
| [Changelog](CHANGELOG.md) | Version history |

---

## Migrating from Legacy Setup

If you previously used LTM via the `~/.claude/memory/` git-clone setup, [the migration guide](docs/migration.md) covers everything.

### One-command LLM migration

Paste this into any LLM coding session (Claude Code, Cursor, Windsurf, Copilot, etc.) and it will detect, migrate, and clean up automatically:

```
Follow these instructions exactly. Run every command. Ask before deleting files.

curl -sL https://raw.githubusercontent.com/RohiRIK/claude-ltm-plugin/main/docs/llm-migration-guide.md
```

The curl fetches an [LLM-optimized migration guide](docs/llm-migration-guide.md) — imperative steps, shell-ready commands, decision table, and a verification checklist. Written for AI assistants, not humans.

---

## Verify Install

```bash
/doctor              # ltm MCP shows as connected
/ltm:recall test     # returns results (or "no results" on fresh install)
/ltm:hook-doctor     # all hooks green
```

Start a new session — you should see `## Restored Project Context` injected at the top.

---

<div align="center">

**Built for [Claude Code](https://docs.anthropic.com/en/docs/claude-code)** | **[Report a Bug](https://github.com/RohiRIK/claude-ltm-plugin/issues)** | **[Changelog](CHANGELOG.md)**

MIT License - [RohiRIK](https://github.com/RohiRIK)

*Powered by caffeine and questionable life choices.*

</div>

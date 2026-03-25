```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🧠  claude-ltm-plugin  ·  v1.3.1                          ║
║                                                              ║
║   Long-Term Memory for Claude Code                          ║
║   Memories that survive every session, every update         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

Persistent semantic memory for Claude Code. FTS5 + vector search, automatic context injection, session learning, and a memory graph visualizer — all packaged as a zero-config plugin.

---

## How it works

```
┌─────────────────────────────────────────────────────────────┐
│                       Claude Code                           │
│                                                             │
│   ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│   │  12 Commands │  │   3 Skills   │  │   4 Hooks      │  │
│   │  /recall     │  │  Continuous  │  │  SessionStart  │  │
│   │  /learn      │  │  Learning    │  │  Stop ×2       │  │
│   │  /capture    │  │  LtmServer   │  │  PreCompact    │  │
│   │  /forget     │  │  Learned     │  │                │  │
│   │  + 8 more    │  │              │  │                │  │
│   └──────┬───────┘  └──────┬───────┘  └───────┬────────┘  │
│          └─────────────────┴──────────────────┘           │
│                             │                               │
│                    ┌────────▼────────┐                     │
│                    │   ltm MCP       │                     │
│                    │   server        │                     │
│                    └────────┬────────┘                     │
└─────────────────────────────┼───────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │      ltm.db         │
                    │  ┌───────────────┐  │
                    │  │   memories    │  │
                    │  │ context_items │  │
                    │  │  relations    │  │
                    │  └───────────────┘  │
                    └─────────────────────┘
```

---

## Install

### Marketplace (recommended)

```bash
claude plugin marketplace add https://github.com/RohiRIK/claude-ltm-plugin
claude plugin install ltm
```

Restart Claude Code. Done.

```
claude plugin install ltm
         │
         ▼
  ┌──────────────────────────────────┐
  │  Plugin system sets:             │
  │  CLAUDE_PLUGIN_ROOT → code       │
  │  CLAUDE_PLUGIN_DATA → your data  │
  └──────────┬───────────────────────┘
             │
             ├──▶ MCP server auto-wired    ✓
             ├──▶ 4 hooks auto-wired       ✓
             ├──▶ 12 commands loaded       ✓
             ├──▶ 3 skills loaded          ✓
             ├──▶ CLAUDE.md loaded         ✓
             └──▶ ltm.db migrated/created  ✓
                          │
                   restart Claude Code
                          │
                          ▼
                     ✅  ready
           /ltm:recall  ·  /ltm:learn  ·  /doctor
```

### Dev / git clone

```bash
git clone https://github.com/RohiRIK/claude-ltm-plugin ~/Projects/claude-ltm-plugin
cd ~/Projects/claude-ltm-plugin && bash install.sh
```

---

## Session lifecycle

```
  ┌─────────────────────────────────────────────────────────┐
  │  Session Start                                          │
  │    SessionStart hook fires                              │
  │      ├─ inject top memories (importance ≥ 3)           │
  │      ├─ inject context: goal, decisions, gotchas        │
  │      └─ Claude reads CLAUDE.md → knows available tools  │
  └─────────────────────┬───────────────────────────────────┘
                         │
                  ← work happens →
                         │
  ┌──────────────────────▼──────────────────────────────────┐
  │  Session Stop                                           │
  │    UpdateContext hook  → saves progress to context_items│
  │    EvaluateSession     → extracts patterns from         │
  │                          transcript → stores memories   │
  └─────────────────────────────────────────────────────────┘
                         │
              (context window fills)
                         │
  ┌──────────────────────▼──────────────────────────────────┐
  │  PreCompact                                             │
  │    Snapshots context_items → context-summary.md         │
  │    Injected at next SessionStart even after compaction  │
  └─────────────────────────────────────────────────────────┘
```

---

## Database

Your memories are stored outside the plugin code — they survive `claude plugin update`.

```
  getDbPath() resolution:
  ─────────────────────────────────────────────────────
  1. LTM_DB_PATH env var          → use it (override)
  2. CLAUDE_PLUGIN_DATA/ltm.db    → marketplace install
  3. ~/.claude/memory/ltm.db      → dev / git clone
  ─────────────────────────────────────────────────────

  On first marketplace install:
  ~/.claude/memory/ltm.db exists?
    yes → copied to CLAUDE_PLUGIN_DATA/ltm.db  ← memories preserved
    no  → fresh db created on first run
```

---

## Commands

Available as `/ltm:<command>` after install.

| Command | What it does |
|---------|-------------|
| `/ltm:recall` | Search memories (FTS5 + semantic fallback) |
| `/ltm:learn` | Store a memory or extract from session |
| `/ltm:forget` | Delete a memory by ID |
| `/ltm:relate` | Link two memories with a typed relationship |
| `/ltm:capture` | Save context item + LTM memory in one shot |
| `/ltm:init-context` | Seed a new project goal |
| `/ltm:decay-report` | Memory health + score distribution |
| `/ltm:migrate` | Schema migration control |
| `/ltm:hook-doctor` | Hook health diagnostic |
| `/ltm:secrets-scan` | Scan memories for secrets, redact in-place |
| `/ltm:ltm-server` | Start/stop memory graph visualizer |
| `/ltm:health` | Project health scores dashboard |

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `ltm_recall` | Search memories — FTS5 + semantic fallback |
| `ltm_learn` | Store or reinforce a memory |
| `ltm_forget` | Delete a memory (CASCADE removes relations) |
| `ltm_relate` | Create typed graph relationship |
| `ltm_graph` | Traverse memory graph |
| `ltm_context` | Get full project context |
| `ltm_context_items` | List context items by type |

---

## Hooks

Auto-wired on install. No manual setup.

| Hook | File | What it does |
|------|------|-------------|
| `SessionStart` | `hooks/src/SessionStart.ts` | Injects memories + context into session |
| `Stop` | `hooks/src/UpdateContext.ts` | Saves session progress |
| `Stop` | `hooks/src/EvaluateSession.ts` | Extracts patterns from transcript |
| `PreCompact` | `hooks/src/PreCompact.ts` | Snapshots context before compaction |

---

## Configuration

`~/.claude/config.json`:

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

---

## Verify install

```
/doctor         → ltm MCP shows ✔
/ltm:recall test → returns results (or "no results" — fine on fresh install)
```

Start a new session — you should see `## Restored Project Context` injected at the top.

---

## Docs

- [Architecture](docs/architecture.md) — technical deep-dive
- [Commands](docs/commands.md) — full command reference
- [Configuration](docs/configuration.md) — all config options
- [Migration](docs/migration.md) — upgrading from old `~/.claude/memory/` setup

---

## Structure

```
src/              MCP server + DB layer (bun-native TypeScript)
hooks/src/        Session lifecycle hooks
hooks/hooks.json  Hook registrations (auto-wired on install)
commands/         13 slash commands (/ltm:recall etc.)
skills/           3 Claude Code skills
scripts/          install-wiring.ts
graph-app/        Next.js memory graph visualizer (port 7332)
migrations/       SQL schema migrations
CLAUDE.md         Loaded by Claude — tool reference
```

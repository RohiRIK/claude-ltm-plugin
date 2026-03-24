# Commands Reference

All commands are available as `/ltm:<command>` after installing the plugin.

## Memory commands

### `/ltm:recall [query] [--category X] [--project X] [--limit N]`
Search memories. Uses FTS5 full-text search with semantic fallback.
- FTS5 supports `AND`, `OR`, `NOT`, phrase matching (`"bun sqlite"`)
- Results ranked: relevance → importance → confidence

### `/ltm:learn [insight] [--category X] [--importance N]`
Store a memory. If no args, reviews the session and extracts patterns automatically.
- Categories: `preference | architecture | gotcha | pattern | workflow | constraint`
- Importance: 1–5 (5 = inject every session, 1 = recall only)
- Safe to call twice — second call reinforces (`confirm_count++`), no duplicates

### `/ltm:forget <id>`
Delete a memory by ID. Shows what will be deleted, requires confirmation. Cascades to relations.

### `/ltm:relate <src-id> <tgt-id> <type>`
Link two memories. Types: `supports | contradicts | refines | depends_on | related_to | supersedes`

---

## Context commands

### `/ltm:capture <type> "<content>"`
Write to both context_items and memories in one shot.

| Type | Context | LTM category | Permanent? |
|------|---------|--------------|------------|
| `decision` | decision | architecture | ✅ |
| `gotcha` | gotcha | gotcha | ✅ |
| `progress` | progress | workflow | trimmed to 20 |
| `pattern` | decision | pattern | ✅ |
| `goal` | goal | workflow | replaces existing |

### `/ltm:init-context`
Seed a new project's initial goal into the DB. Run once per project.

---

## Diagnostic commands

### `/ltm:decay-report`
Score distribution of all active memories. Flags at-risk memories (score 0.25–0.5).

### `/ltm:health`
Project health scores from the LTM API server. Requires `/ltm:ltm-server start`.

Score formula:
| Metric | Weight |
|--------|--------|
| Memory freshness (accessed ≤30 days) | 35% |
| Avg confidence | 25% |
| Context coverage (goal/decision/gotcha/progress) | 20% |
| Session activity (any access ≤14 days) | 20% |

### `/ltm:hook-doctor`
Health check on all registered hooks. Shows file existence + error counts from last 24h.

### `/ltm:secrets-scan [--project X] [--dry-run]`
Scan memories for API keys, tokens, passwords. Redacts in-place. `--dry-run` is safe.

### `/ltm:migrate [status|up|down|reset]`
Schema migration control. Defaults to `status`. `reset` requires confirmation.

---

## Server commands

### `/ltm:ltm-server [start|stop|status]`
Start/stop the graph visualization server on port 7331. Opens browser automatically.

---
description: "Save context + learn in one shot. Use after any decision, gotcha, or progress."
argument-hint: "<decision|gotcha|progress|pattern|goal> \"<content>\""
---

| Type | Context type | LTM category | Importance | Permanent? |
|------|-------------|--------------|------------|------------|
| `decision` | `decision` | `architecture` | 3 | ✅ |
| `gotcha` / `warning` | `gotcha` | `gotcha` | 4 | ✅ |
| `progress` / `done` | `progress` | `workflow` | 2 | trimmed to 20 |
| `pattern` / `learn` | `decision` | `pattern` | 3 | ✅ |
| `goal` | `goal` | `workflow` | 3 | replaces existing |

If no type given, default to `progress` / `workflow`.

## Steps

**1 — Parse:** extract `<type>` and `<content>`. Map via table above.

**2 — Resolve project:**
```bash
cat ~/.claude/projects/registry.json
```
Match `cwd` → `<project>`. If not registered, say so and stop.

**3 — Write both stores in parallel:**

LTM memory (call `mcp__ltm__ltm_learn`):
```json
{ "content": "<content>", "category": "<ltm_category>", "importance": <N>, "project_scope": "<project>" }
```

Context item (bun:sqlite direct):
```bash
DB="${LTM_DB_PATH:-$CLAUDE_PLUGIN_DATA/ltm.db}"
bun --eval "
const { Database } = require('bun:sqlite');
const db = new Database('$DB');
db.run(\`INSERT INTO context_items (project, type, content, updated_at)
  VALUES (?, ?, ?, datetime('now'))
  ON CONFLICT(project, type) DO UPDATE SET content=excluded.content, updated_at=excluded.updated_at\`,
  ['<project>', '<context_type>', '<content>']);
console.log('ok');
"
```

**4 — Confirm:**
```
Captured for **<project>**:
  Context → <type>: "<content>"
  LTM     → <category> (★★★): "<content>"
```

Never ask clarifying questions. Write as-is.

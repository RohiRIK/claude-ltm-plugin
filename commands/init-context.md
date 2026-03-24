---
description: "Seed a new project goal into the LTM context system."
disable-model-invocation: true
---

**1 — Verify project is registered:**
```bash
cat ~/.claude/projects/registry.json
```
Match `cwd`. If missing, run `/register-project` first.

**2 — Check for existing goal:**
```bash
DB="${LTM_DB_PATH:-$HOME/.claude/memory/ltm.db}"
bun --eval "
const { Database } = require('bun:sqlite');
const db = new Database('$DB');
const row = db.query(\"SELECT content FROM context_items WHERE project=? AND type='goal' LIMIT 1\").get('<project>');
console.log(row ? row.content : '');
"
```
If a goal exists, show it and ask: "Replace it?"

**3 — Ask for the goal:**
> "What is the current goal for **\<project\>**? (1–3 bullets, max 100 chars each)"

**4 — Write:**
```bash
bun --eval "
const { Database } = require('bun:sqlite');
const db = new Database('$DB');
db.run(\`INSERT INTO context_items (project, type, content, updated_at)
  VALUES (?, 'goal', ?, datetime('now'))
  ON CONFLICT(project, type) DO UPDATE SET content=excluded.content, updated_at=excluded.updated_at\`,
  ['<project>', '<goal>']);
console.log('done');
"
```

**5 — Confirm:**
```
Project **<project>** seeded.
Goal: <goal>

Decisions, progress, and gotchas accumulate automatically via hooks.
```

Do NOT create context-goals.md or similar files. DB is the source of truth.

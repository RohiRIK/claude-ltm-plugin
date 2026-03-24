---
description: "USE WHEN discovering a new insight or pattern worth preserving."
argument-hint: "[insight] --category [preference|architecture|gotcha|pattern|workflow|constraint] --importance [1-5]"
---

Store a memory via `mcp__ltm__ltm_learn`. Parse args:

| Arg | Field | Default |
|-----|-------|---------|
| positional text | `content` | required |
| `--category X` | `category` | `pattern` |
| `--importance N` | `importance` | 3 |
| `--project X` | `project_scope` | current project |
| `--tags t1,t2` | `tags` | — |

If no args given, review the session for extractable insights (error patterns, debugging techniques, workarounds, architecture decisions, confirmed preferences). Extract each, classify, then call `ltm_learn` for each.

Report: `Memory [action]: [id] "[content]" (confirmed Nx)`

**Dedup:** calling with identical content reinforces (`action: reinforced`) — never creates duplicates.
**Importance guide:** 5 = inject every session · 4–3 = project sessions · 1–2 = recall only

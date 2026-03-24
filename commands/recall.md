---
description: "USE WHEN searching past decisions before starting a task."
argument-hint: "[search query] [--category gotcha|architecture|pattern|preference|workflow|constraint] [--project name] [--limit N]"
---

Search LTM memories. Call `mcp__ltm__ltm_recall` with parsed args:

| Arg | Field |
|-----|-------|
| positional text | `query` |
| `--category X` | `category` |
| `--project X` | `project` |
| `--limit N` | `limit` (default 10) |

Display each result: ID · content · category · importance ★ · confirmed count · tags · relations.

FTS5 supports `AND`, `OR`, `NOT`, phrase matching (`"bun sqlite"`). Results ranked: relevance → importance → confidence.

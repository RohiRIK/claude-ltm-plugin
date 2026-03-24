# LTM Plugin — Long-Term Memory for Claude Code

This plugin provides persistent semantic memory across sessions via a local SQLite database.

## Available MCP Tools

| Tool | When to use |
|------|-------------|
| `ltm_recall` | Before any non-trivial task — search past decisions, patterns, gotchas |
| `ltm_learn` | After discovering a non-obvious pattern or making an architectural decision |
| `ltm_forget` | Remove a stale or incorrect memory by ID |
| `ltm_relate` | Link two related memories |
| `ltm_context` | Get full project context (goal, decisions, progress, gotchas) |
| `ltm_context_items` | List context items by type |
| `ltm_graph` | Query the memory graph |

## Usage Pattern

1. Call `ltm_recall` with the task topic before starting work
2. Call `ltm_learn` after discovering non-obvious patterns or making key decisions
3. Use `ltm_context` at session start to restore project state

## Memory Categories

`preference` · `architecture` · `gotcha` · `pattern` · `workflow` · `constraint`

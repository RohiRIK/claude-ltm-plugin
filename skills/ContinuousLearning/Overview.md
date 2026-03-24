# Continuous Learning Context

This context defines the memory persistence and strategic compaction strategies for the assistant.

## Memory Persistence
- **Session Start**: Loads previous session context to maintain continuity.
- **Session End**: Persists the current session state, including open tasks and notes.
- **Pre-Compact**: Saves critical state before the context window is compressed (summarized).

## Strategic Compaction
Instead of relying solely on automated context clearing, we use "Strategic Compaction" to trigger cleanups at logical breakpoints:
- After a research phase is complete.
- Before starting a major implementation task.
- After ~50 tool calls when context might be getting stale.

## Session Evaluation
At the end of every session, we analyze the transcript to:
1. Identify common errors and their resolutions.
2. Track tool usage frequency.
3. List modified files to understand the session's scope.
This data is saved to `~/.claude/skills/learned/patterns/`.

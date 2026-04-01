# LTM Migration: Legacy to Plugin

You are migrating a user's LTM (Long-Term Memory) system from the legacy `~/.claude/memory/` git-clone setup to the marketplace plugin. Follow every step in order. Ask the user for confirmation before deleting files.

## Step 1 — Detect Current State

Run these three checks. Record the results as YES/NO.

```bash
# Check A: Plugin already active?
ls "$CLAUDE_PLUGIN_DATA/ltm.db" 2>/dev/null && echo "PLUGIN_DB=YES" || echo "PLUGIN_DB=NO"

# Check B: Legacy DB exists?
ls ~/.claude/memory/ltm.db 2>/dev/null && echo "LEGACY_DB=YES" || echo "LEGACY_DB=NO"

# Check C: Legacy JS modules present?
ls ~/.claude/memory/db.js 2>/dev/null && echo "LEGACY_JS=YES" || echo "LEGACY_JS=NO"
```

### Interpret results

| PLUGIN_DB | LEGACY_DB | Meaning | Action |
|-----------|-----------|---------|--------|
| YES | YES | Plugin installed, legacy leftover | Skip to Step 4 (cleanup) |
| YES | NO | Plugin installed, clean | Done. No migration needed. |
| NO | YES | Legacy install, needs migration | Continue to Step 2 |
| NO | NO | Fresh install, no data | Continue to Step 2 (no data to migrate) |

## Step 2 — Install the Plugin

Run these two commands:

```bash
claude plugin marketplace add https://github.com/RohiRIK/claude-ltm-plugin
claude plugin install ltm
```

The installer automatically copies `~/.claude/memory/ltm.db` to `$CLAUDE_PLUGIN_DATA/ltm.db` if the legacy DB exists. Zero data loss.

If `CLAUDE_PLUGIN_DATA` is not set after install, restart the Claude Code session — the plugin system sets this variable.

## Step 3 — Verify

Run this check:

```bash
claude plugin info ltm
```

Confirm:
1. Plugin is listed and version is shown
2. Restart the session
3. Run `/ltm:recall test` — it should return results (or "no results" on fresh install, which is expected)
4. Run `/ltm:hook-doctor` — all hooks should show green

If recall returns empty but `~/.claude/memory/ltm.db` has data, the DB copy failed. Run:

```bash
/ltm:migrate-db
```

This diagnoses the path and copies the DB if needed.

## Step 4 — Clean Up Legacy Artifacts

**Ask the user before deleting anything.**

### 4a. Remove legacy JS modules

These are replaced by the plugin's bundled MCP server:

```bash
rm -f ~/.claude/memory/db.js
rm -f ~/.claude/memory/context.js
rm -f ~/.claude/memory/shared-db.js
rm -f ~/.claude/memory/secretsScrubber.js
rm -f ~/.claude/memory/migrate.ts
rm -f ~/.claude/memory/mcp-server.ts
```

### 4b. Remove legacy slash commands

These are replaced by `/ltm:` prefixed versions:

```bash
rm -f ~/.claude/commands/recall.md
rm -f ~/.claude/commands/learn.md
rm -f ~/.claude/commands/forget.md
rm -f ~/.claude/commands/relate.md
rm -f ~/.claude/commands/capture.md
rm -f ~/.claude/commands/decay-report.md
rm -f ~/.claude/commands/migrate.md
```

### 4c. Remove stale MCP entry from ~/.claude.json

Check for a manual `ltm` entry:

```bash
cat ~/.claude.json | grep -A3 '"ltm"'
```

If it contains `"command": "bun"` pointing to `~/.claude/memory/mcp-server.ts`, remove the entire `ltm` key from `mcpServers`. The plugin system manages MCP registration now. The installer does this automatically, but verify.

### 4d. Remove stale hooks from settings.json

Search for hook commands referencing the old path:

```bash
grep '~/.claude/memory/' ~/.claude/settings.json
```

If any matches, remove those hook entries. The plugin's hooks use `CLAUDE_PLUGIN_ROOT` paths instead. Valid plugin hooks look like:

```
CLAUDE_PLUGIN_ROOT=/path/to/plugin bun run /path/to/plugin/hooks/src/SessionStart.ts
```

Any hook referencing `~/.claude/memory/` is stale.

### 4e. Keep legacy DB as backup (recommend)

```
~/.claude/memory/ltm.db  — keep until user confirms plugin is working across multiple sessions
```

Suggest deletion only after the user has used the plugin for at least one full session.

## Step 5 — Confirm Migration Complete

Run this final checklist:

```bash
# Plugin DB exists and has data
ls -la "$CLAUDE_PLUGIN_DATA/ltm.db"

# No legacy JS modules remain
ls ~/.claude/memory/*.js 2>/dev/null && echo "WARN: legacy JS files remain" || echo "OK: clean"

# No stale hooks
grep '~/.claude/memory/' ~/.claude/settings.json && echo "WARN: stale hooks" || echo "OK: clean"

# No stale MCP entry
grep '"ltm"' ~/.claude.json 2>/dev/null | grep 'memory' && echo "WARN: stale MCP" || echo "OK: clean"
```

Report results to the user. All four should show OK/clean.

## Quick Reference

| Aspect | Legacy | Plugin |
|--------|--------|--------|
| DB path | `~/.claude/memory/ltm.db` | `$CLAUDE_PLUGIN_DATA/ltm.db` |
| Commands | `/recall`, `/learn` | `/ltm:recall`, `/ltm:learn` |
| MCP | Manual in `~/.claude.json` | Automatic via `plugin.json` |
| Hooks | Hardcoded `~/.claude/memory/` | `CLAUDE_PLUGIN_ROOT` variable |
| Updates | `git pull` in `~/.claude/memory/` | `claude plugin update ltm` |
| Migrations | `bun run migrate.ts` | `/ltm:migrate` |

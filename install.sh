#!/usr/bin/env bash
# claude-ltm-plugin installer
# Safe to run multiple times — never overwrites existing ltm.db.
#
# Usage (fresh install):
#   git clone https://github.com/RohiRIK/claude-ltm-plugin ~/Projects/claude-ltm-plugin
#   cd ~/Projects/claude-ltm-plugin && bash install.sh
#
# Usage (reinstall / repair wiring):
#   cd ~/Projects/claude-ltm-plugin && bash install.sh
#   Your ltm.db is never touched if it already exists.

set -e

PLUGIN_ROOT="$(cd "$(dirname "$0")" && pwd)"
DB_PATH="$PLUGIN_ROOT/data/ltm.db"
CLAUDE_JSON="$HOME/.claude.json"
SETTINGS_JSON="$HOME/.claude/settings.json"

echo "claude-ltm-plugin installer"
echo "Plugin root: $PLUGIN_ROOT"
echo ""

# ── 1. Create data dir ───────────────────────────────────────────────────────
mkdir -p "$PLUGIN_ROOT/data"

# ── 2. Database — never overwrite existing ───────────────────────────────────
if [[ -f "$DB_PATH" ]]; then
  echo "  ✔ ltm.db already exists ($(du -h "$DB_PATH" | cut -f1)) — keeping it"
else
  # Migrate from old location if present
  OLD_DB="$HOME/.claude/memory/ltm.db"
  if [[ -f "$OLD_DB" ]]; then
    cp "$OLD_DB" "$DB_PATH"
    echo "  ✔ Migrated existing ltm.db from $OLD_DB"
  else
    echo "  ✔ Fresh install — ltm.db will be created on first run"
  fi
fi

# ── 3. Register MCP server in ~/.claude.json ────────────────────────────────
[[ ! -f "$CLAUDE_JSON" ]] && echo '{}' > "$CLAUDE_JSON"

python3 - <<PYEOF
import json, os
root = "$PLUGIN_ROOT"
db   = "$DB_PATH"
path = "$CLAUDE_JSON"
with open(path) as f:
    d = json.load(f)
d.setdefault("mcpServers", {})["ltm"] = {
    "type": "stdio",
    "command": "bun",
    "args": ["run", f"{root}/src/mcp-server.ts"],
    "env": {"LTM_DB_PATH": db}
}
with open(path, "w") as f:
    json.dump(d, f, indent=2)
print("  ✔ MCP server registered in ~/.claude.json")
PYEOF

# ── 4. Wire hooks into ~/.claude/settings.json ──────────────────────────────
python3 - <<PYEOF
import json, os
root     = "$PLUGIN_ROOT"
db       = "$DB_PATH"
settings = "$SETTINGS_JSON"
with open(settings) as f:
    d = json.load(f)
hooks = d.setdefault("hooks", {})
LTM_HOOKS = [
    ("SessionStart", "", f"LTM_DB_PATH={db} CLAUDE_PLUGIN_ROOT={root} bun run {root}/hooks/src/SessionStart.ts"),
    ("Stop",         "", f"LTM_DB_PATH={db} CLAUDE_PLUGIN_ROOT={root} bun run {root}/hooks/src/UpdateContext.ts"),
    ("Stop",         "", f"LTM_DB_PATH={db} CLAUDE_PLUGIN_ROOT={root} bun run {root}/hooks/src/EvaluateSession.ts"),
    ("PreCompact",   "", f"LTM_DB_PATH={db} CLAUDE_PLUGIN_ROOT={root} bun run {root}/hooks/src/PreCompact.ts"),
]
for event, matcher, command in LTM_HOOKS:
    entries = hooks.setdefault(event, [])
    already = any(command in h.get("command","") for e in entries for h in e.get("hooks",[]))
    if not already:
        entries.append({"matcher": matcher, "hooks": [{"type": "command", "command": command}]})
with open(settings, "w") as f:
    json.dump(d, f, indent=2)
print("  ✔ Hooks wired into ~/.claude/settings.json")
PYEOF

echo ""
echo "Done. Restart Claude Code to activate."
echo ""
echo "Verify:  /doctor  →  ltm MCP should show ✔"
echo "Your db: $DB_PATH"

#!/usr/bin/env bash
# claude-ltm-plugin installer (dev/git-clone flow)
# Safe to run multiple times.
# db lives at ~/.claude/memory/ltm.db — never touched by this script.
#
# Usage:
#   git clone https://github.com/RohiRIK/claude-ltm-plugin ~/Projects/claude-ltm-plugin
#   cd ~/Projects/claude-ltm-plugin && bash install.sh

set -e

PLUGIN_ROOT="$(cd "$(dirname "$0")" && pwd)"
DB_PATH="$HOME/.claude/memory/ltm.db"
CLAUDE_JSON="$HOME/.claude.json"
SETTINGS_JSON="$HOME/.claude/settings.json"

echo "claude-ltm-plugin installer"
echo "Plugin root: $PLUGIN_ROOT"
echo ""

# ── 1. Ensure ~/.claude/memory/ exists ──────────────────────────────────────
mkdir -p "$HOME/.claude/memory"
echo "  ✔ ~/.claude/memory/ ready — db at $DB_PATH"

# ── 2. Register MCP server in ~/.claude.json ────────────────────────────────
[[ ! -f "$CLAUDE_JSON" ]] && echo '{}' > "$CLAUDE_JSON"

python3 - <<PYEOF
import json
root = "$PLUGIN_ROOT"
path = "$CLAUDE_JSON"
with open(path) as f:
    d = json.load(f)
d.setdefault("mcpServers", {})["ltm"] = {
    "type": "stdio",
    "command": "bun",
    "args": ["run", f"{root}/src/mcp-server.ts"]
}
with open(path, "w") as f:
    json.dump(d, f, indent=2)
print("  ✔ MCP server registered in ~/.claude.json")
PYEOF

# ── 3. Wire hooks into ~/.claude/settings.json ──────────────────────────────
python3 - <<PYEOF
import json
root     = "$PLUGIN_ROOT"
settings = "$SETTINGS_JSON"
with open(settings) as f:
    d = json.load(f)
hooks = d.setdefault("hooks", {})
LTM_HOOKS = [
    ("SessionStart", "", f"CLAUDE_PLUGIN_ROOT={root} bun run {root}/hooks/src/SessionStart.ts"),
    ("Stop",         "", f"CLAUDE_PLUGIN_ROOT={root} bun run {root}/hooks/src/UpdateContext.ts"),
    ("Stop",         "", f"CLAUDE_PLUGIN_ROOT={root} bun run {root}/hooks/src/EvaluateSession.ts"),
    ("PreCompact",   "", f"CLAUDE_PLUGIN_ROOT={root} bun run {root}/hooks/src/PreCompact.ts"),
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

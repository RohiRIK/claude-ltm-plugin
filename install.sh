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

echo "claude-ltm-plugin installer"
echo "Plugin root: $PLUGIN_ROOT"
echo ""

# ── 1. Ensure ~/.claude/memory/ exists ──────────────────────────────────────
mkdir -p "$HOME/.claude/memory"
echo "  ✔ ~/.claude/memory/ ready — db at $DB_PATH"

# ── 2. Register MCP + wire hooks ────────────────────────────────────────────
bun run "$PLUGIN_ROOT/scripts/install-wiring.ts" "$PLUGIN_ROOT"

echo ""
echo "Done. Restart Claude Code to activate."
echo ""
echo "Verify:  /doctor  →  ltm MCP should show ✔"
echo "Your db: $DB_PATH"

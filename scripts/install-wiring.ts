#!/usr/bin/env bun
/**
 * Wires the LTM plugin into ~/.claude.json (MCP) and ~/.claude/settings.json (hooks).
 * Called by install.sh. Safe to run multiple times — skips already-wired entries.
 *
 * Usage: bun run scripts/install-wiring.ts <plugin-root>
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const root = process.argv[2];
if (!root) {
  console.error("Usage: bun run scripts/install-wiring.ts <plugin-root>");
  process.exit(1);
}

const CLAUDE_DIR = join(homedir(), ".claude");
const claudeJson = join(homedir(), ".claude.json");
const settingsJson = join(CLAUDE_DIR, "settings.json");

// ── MCP registration ─────────────────────────────────────────────────────────
if (!existsSync(claudeJson)) writeFileSync(claudeJson, "{}");
const claude = JSON.parse(readFileSync(claudeJson, "utf-8"));
claude.mcpServers ??= {};
claude.mcpServers.ltm = {
  type: "stdio",
  command: "bun",
  args: ["run", `${root}/src/mcp-server.ts`],
};
writeFileSync(claudeJson, JSON.stringify(claude, null, 2));
console.log("  ✔ MCP server registered in ~/.claude.json");

// ── Hooks wiring ─────────────────────────────────────────────────────────────
type HookEntry = { matcher: string; hooks: { type: string; command: string }[] };

const settings = JSON.parse(readFileSync(settingsJson, "utf-8"));
const hooks: Record<string, HookEntry[]> = settings.hooks ?? {};
settings.hooks = hooks;

const LTM_HOOKS: [string, string][] = [
  ["SessionStart", `CLAUDE_PLUGIN_ROOT=${root} bun run ${root}/hooks/src/SessionStart.ts`],
  ["Stop",         `CLAUDE_PLUGIN_ROOT=${root} bun run ${root}/hooks/src/UpdateContext.ts`],
  ["Stop",         `CLAUDE_PLUGIN_ROOT=${root} bun run ${root}/hooks/src/EvaluateSession.ts`],
  ["PreCompact",   `CLAUDE_PLUGIN_ROOT=${root} bun run ${root}/hooks/src/PreCompact.ts`],
];

for (const [event, command] of LTM_HOOKS) {
  hooks[event] ??= [];
  const already = hooks[event]!.some(e => e.hooks.some(h => h.command.includes(command)));
  if (!already) {
    hooks[event]!.push({ matcher: "", hooks: [{ type: "command", command }] });
  }
}

writeFileSync(settingsJson, JSON.stringify(settings, null, 2));
console.log("  ✔ Hooks wired into ~/.claude/settings.json");

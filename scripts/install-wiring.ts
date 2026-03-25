#!/usr/bin/env bun
/**
 * Wires the LTM plugin into ~/.claude.json (MCP) and ~/.claude/settings.json (hooks).
 * Called by install.sh. Safe to run multiple times — skips already-wired entries.
 *
 * Usage: bun run scripts/install-wiring.ts <plugin-root>
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, chmodSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execSync } from "child_process";

const root = process.argv[2];
if (!root) {
  console.error("Usage: bun run scripts/install-wiring.ts <plugin-root>");
  process.exit(1);
}

const CLAUDE_DIR = join(homedir(), ".claude");
const claudeJson = join(homedir(), ".claude.json");

const pluginData = process.env.CLAUDE_PLUGIN_DATA;

if (pluginData) {
  const targetDb  = join(pluginData, "ltm.db");
  const legacyDb  = join(CLAUDE_DIR, "memory", "ltm.db");
  const hasTarget = existsSync(targetDb);
  if (!hasTarget && existsSync(legacyDb)) {
    mkdirSync(pluginData, { recursive: true });
    copyFileSync(legacyDb, targetDb);
    console.log(`  ✔ Migrated ltm.db → ${targetDb}`);
  } else if (!hasTarget) {
    console.log("  ✔ Fresh install — ltm.db will be created on first run");
  } else {
    console.log(`  ✔ ltm.db ready at ${targetDb}`);
  }
}
const settingsJson = join(CLAUDE_DIR, "settings.json");

// ── MCP registration ─────────────────────────────────────────────────────────
// MCP is registered by the plugin system via plugin.json mcpServers field.
// We only clean up any legacy manual entry left from pre-plugin installs.
if (existsSync(claudeJson)) {
  const claude = JSON.parse(readFileSync(claudeJson, "utf-8"));
  if (claude.mcpServers?.ltm) {
    delete claude.mcpServers.ltm;
    writeFileSync(claudeJson, JSON.stringify(claude, null, 2));
    console.log("  ✔ Removed legacy ltm MCP entry from ~/.claude.json (now managed by plugin system)");
  }
}

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

// ── Global git post-commit hook ───────────────────────────────────────────────
const gitHooksDir = join(CLAUDE_DIR, "hooks", "git");
mkdirSync(gitHooksDir, { recursive: true });

const postCommitPath = join(gitHooksDir, "post-commit");
const postCommitScript = `#!/bin/sh\nCLAUDE_PLUGIN_ROOT=${root} bun run ${root}/hooks/src/GitCommit.ts "$@"\n`;

if (!existsSync(postCommitPath) || !readFileSync(postCommitPath, "utf-8").includes("GitCommit")) {
  writeFileSync(postCommitPath, postCommitScript);
  chmodSync(postCommitPath, 0o755);
}

try {
  execSync(`git config --global core.hooksPath ${gitHooksDir}`, { stdio: "ignore" });
  console.log("  ✔ Global git post-commit hook installed (~/.claude/hooks/git/)");
  console.log("  ℹ  Enable with: ltm.gitLearnEnabled=true in ~/.claude/config.json");
} catch {
  console.log("  ⚠  Could not set git core.hooksPath — set manually: git config --global core.hooksPath " + gitHooksDir);
}

// ── Patch known_marketplaces.json to use GitHub API source ───────────────────
// The plugin system defaults to "git" source (requires local git fetch).
// "github" source uses the GitHub API — no fetch needed for update checks.
const knownMarketplacesPath = join(CLAUDE_DIR, "plugins", "known_marketplaces.json");
if (existsSync(knownMarketplacesPath)) {
  const marketplaces = JSON.parse(readFileSync(knownMarketplacesPath, "utf-8"));
  const ltm = marketplaces.ltm;
  if (ltm?.source?.source === "git" && ltm.source.url?.includes("RohiRIK/claude-ltm-plugin")) {
    marketplaces.ltm.source = { source: "github", repo: "RohiRIK/claude-ltm-plugin" };
    writeFileSync(knownMarketplacesPath, JSON.stringify(marketplaces, null, 2));
    console.log("  ✔ Switched ltm marketplace source to github (enables API-based update checks)");
  }
}

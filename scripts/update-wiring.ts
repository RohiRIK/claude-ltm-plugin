#!/usr/bin/env bun
/**
 * update-wiring.ts — Re-wires LTM plugin after a marketplace update.
 *
 * Called automatically via package.json "postinstall" script, so it runs
 * whenever `bun install` is executed in the plugin directory (e.g. on
 * marketplace update). Safe to run multiple times — all operations are
 * idempotent.
 *
 * Usage: bun run scripts/update-wiring.ts [plugin-root]
 *   plugin-root defaults to the directory of this script's parent.
 */
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

// Resolve plugin root: explicit arg → env var → script location
const __dir = dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] ?? process.env.CLAUDE_PLUGIN_ROOT ?? resolve(__dir, "..");

const result = spawnSync(
  "bun",
  ["run", join(root, "scripts", "install-wiring.ts"), root],
  { stdio: "inherit", env: process.env },
);

process.exit(result.status ?? 0);

/**
 * hookLogger.ts
 * Structured JSONL logger for Claude Code hooks.
 * Writes to ~/.claude/logs/hooks.log — never throws (falls back to console.error).
 */

import { appendFileSync, readFileSync, mkdirSync, statSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  ts: string;
  hook: string;
  level: LogLevel;
  msg: string;
  detail?: string;
  durationMs?: number;
}

const LOG_PATH = join(homedir(), ".claude", "logs", "hooks.log");
const MAX_BYTES = 500_000;   // 500 KB — rotate above this
const KEEP_BYTES = 300_000;  // keep last 300 KB after rotation

// Cache dir-creation so it only runs once per process
let _dirEnsured = false;

function ensureDir(): void {
  if (_dirEnsured) return;
  mkdirSync(dirname(LOG_PATH), { recursive: true });
  _dirEnsured = true;
}

function rotate(): void {
  try {
    let size: number;
    try { size = statSync(LOG_PATH).size; } catch { return; } // file doesn't exist yet
    if (size <= MAX_BYTES) return;
    writeFileSync(LOG_PATH, readFileSync(LOG_PATH, "utf-8").slice(-KEEP_BYTES));
  } catch (_) {
    // rotation failure is non-fatal
  }
}

export function logHook(
  hook: string,
  level: LogLevel,
  msg: string,
  detail?: string,
  durationMs?: number,
): void {
  try {
    ensureDir();
    rotate();

    const entry: LogEntry = {
      ts: new Date().toISOString(),
      hook,
      level,
      msg,
      ...(detail !== undefined && { detail }),
      ...(durationMs !== undefined && { durationMs }),
    };

    appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n");
  } catch (fallbackErr) {
    // logger itself failed — never crash the hook
    console.error(`[hookLogger] Failed to write log: ${fallbackErr}`);
  }
}

/**
 * Convenience: wrap an async hook body with timing + error logging.
 * Always re-throws so the hook's exit code is preserved.
 */
export async function runWithLogging(
  hook: string,
  fn: () => Promise<void>,
): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    // only log info for hooks that complete — avoids noise on every run
  } catch (err) {
    const durationMs = Date.now() - start;
    const detail = err instanceof Error ? err.stack ?? err.message : String(err);
    logHook(hook, "error", "Unhandled exception", detail, durationMs);
    throw err;
  }
}

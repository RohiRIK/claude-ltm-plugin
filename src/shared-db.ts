/**
 * shared-db.ts — Single DB singleton shared by db.ts, context.ts, server.ts, and janitor.
 * Prevents dual write connections that break WAL.
 * Runs idempotent schema migrations on first access.
 */
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CLAUDE_DIR = join(homedir(), ".claude");
export const DB_PATH = join(CLAUDE_DIR, "memory", "ltm.db");
const SCHEMA_PATH = join(import.meta.dir, "schema.sql");

let _db: Database | null = null;

/** Check if a column exists on a table. */
function hasColumn(db: Database, table: string, column: string): boolean {
  const info = db.query<{ name: string }, []>(`PRAGMA table_info(${table})`).all();
  return info.some((c) => c.name === column);
}

/** Check if a table exists. */
function hasTable(db: Database, table: string): boolean {
  const row = db
    .query<{ cnt: number }, [string]>(
      "SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name=?",
    )
    .get(table);
  return (row?.cnt ?? 0) > 0;
}

/** Run Phase 2 schema migrations idempotently. */
function runMigrations(db: Database): void {
  // Skip migrations if core tables don't exist yet (fresh DB — schema.sql will create them)
  if (!hasTable(db, "memories")) return;

  // memories: add status, embedding, last_used_at
  if (!hasColumn(db, "memories", "status")) {
    db.exec(
      "ALTER TABLE memories ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','pending','deprecated','superseded'))",
    );
  }
  if (!hasColumn(db, "memories", "embedding")) {
    db.exec("ALTER TABLE memories ADD COLUMN embedding BLOB");
  }
  if (!hasColumn(db, "memories", "last_used_at")) {
    db.exec(
      "ALTER TABLE memories ADD COLUMN last_used_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00'",
    );
    // Backfill existing rows with actual current timestamp
    db.exec(
      "UPDATE memories SET last_used_at = datetime('now') WHERE last_used_at = '1970-01-01 00:00:00'",
    );
  }

  // context_items: add memory_id (Phase 1 migration), status
  if (!hasColumn(db, "context_items", "memory_id")) {
    db.exec(
      "ALTER TABLE context_items ADD COLUMN memory_id INTEGER REFERENCES memories(id) ON DELETE SET NULL",
    );
  }
  if (!hasColumn(db, "context_items", "status")) {
    db.exec(
      "ALTER TABLE context_items ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','pending_promotion','promoted'))",
    );
  }

  // settings table
  if (!hasTable(db, "settings")) {
    db.exec(`
      CREATE TABLE settings (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  // New indexes (CREATE INDEX IF NOT EXISTS is safe to re-run)
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_memories_status ON memories(status)",
  );
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_memories_last_used ON memories(last_used_at)",
  );
}

export function getDb(): Database {
  if (_db) return _db;
  const dir = join(CLAUDE_DIR, "memory");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  _db = new Database(DB_PATH, { create: true });
  _db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
  // Migrations first — adds columns to existing tables so schema.sql indexes succeed
  runMigrations(_db);
  _db.exec(readFileSync(SCHEMA_PATH, "utf-8"));
  return _db;
}

// --- Settings helpers (used by janitor + server routes) ---

export interface SettingRow {
  key: string;
  value: string;
  updated_at: string;
}

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db
    .query<SettingRow, [string]>("SELECT value FROM settings WHERE key=?")
    .get(key);
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
    [key, value],
  );
}

export function getAllSettings(): Record<string, string> {
  const db = getDb();
  const rows = db
    .query<SettingRow, []>("SELECT key, value FROM settings")
    .all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

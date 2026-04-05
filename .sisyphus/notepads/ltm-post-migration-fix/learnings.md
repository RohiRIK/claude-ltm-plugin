# Learnings

## [2026-04-05] Session Start
- Project uses Bun runtime — use `import.meta.dir` NOT `__dirname`
- `hooks/lib/resolveProject.ts:22-34` is the CANONICAL getDbPath pattern — replicate exactly for src/paths.ts
- DB_PATH export in shared-db.ts MUST remain same name/type (string) — consumed by db.ts, mcp-server.ts
- Three ltm.db files: plugin data (5.9MB), legacy (6.1MB most recent), dev (4.1MB stale)
- `~/.claude/config.json` correctly has `ltm.dbPath` pointing to plugin data — shared-db.ts ignores it
- `hooks/hooks.json` already correct with `${CLAUDE_PLUGIN_ROOT}` — DO NOT MODIFY
- Import paths in src/ use `.js` extension (e.g., `"./paths.js"`) even for TypeScript source files
- `src/schema.sql` must be a real file on disk (not an import) — read via readFileSync in shared-db.ts:95-100
- Task 6 excludes docs/migration.md and docs/llm-migration-guide.md from grep — they legitimately document legacy paths
- Task 7 is NO-commit — settings.json is outside the git repo
- getDbPath() signature: `getDbPath(configOverride?: { dbPath?: string }): string`

- Bundled schema.sql into src/ and switched SCHEMA_PATH to import.meta.dir for Bun-relative reads.

## [2026-04-05 00:00 UTC] Task: 2 - path-resolution test suite
- Added a Bun-only test suite for `getDbPath()` covering env precedence, config override, and legacy fallback.
- Kept the suite red-phase compatible by importing `../paths.js` without creating `src/paths.ts`.
- Used a regex assertion for the legacy path so the test stays platform-agnostic and avoids hardcoded user paths.

## [2026-04-05] Task: 3 - src/paths.ts
- Canonical path resolution now lives in src/paths.ts with explicit env, plugin-data auto-migration, config override/config.json, then legacy fallback ordering.
- Bun-relative file paths should use import.meta.dir for schema.sql and migrations lookups.
- Added a skipAutoMigrate seam so tests can avoid copyFileSync side effects while keeping production migration behavior intact.

## [2026-04-05 00:00 UTC] Task: fix path-resolution test 4
- Replaced the legacy fallback assertion with a deterministic `configOverride.dbPath` assertion because local `~/.claude/config.json` can short-circuit the fallback chain.
- Verified the suite with `bun test src/__tests__/path-resolution.test.ts` and confirmed 5 pass / 0 fail.
## [2026-04-05] Task: 6 - markdown path updates
- Updated: skills/session-context/SKILL.md (1), skills/ContinuousLearning/SKILL.md (1), skills/ContinuousLearning/MemoryReference.md (6), skills/ContinuousLearning/HookIntegration.md (1), skills/ContinuousLearning/ContextItems.md (2), commands/init-context.md (1), commands/secrets-scan.md (1), commands/decay-report.md (1), commands/migrate-db.md (4), commands/capture.md (1), docs/configuration.md (2), docs/architecture.md (1), skills/Learned/patterns/2026-03-24.md (10), 2026-03-25.md (3), 2026-03-26.md (1), 2026-03-27.md (10), 2026-03-29.md (5), 2026-04-01.md (6), 2026-04-02.md (11), 2026-04-03.md (2), 2026-04-04.md (5), 2026-04-05.md (1)
- docs/migration.md and docs/llm-migration-guide.md intentionally skipped

## [2026-04-05] Task: 5 - path fixes in 4 files
- graph-server.ts line 11 already had CLAUDE_DIR import from hooks/lib — kept as-is
- migrations.ts: CLAUDE_DIR not needed after fix (no other usage)
- config.ts: homedir kept for CONFIG_PATH
- migrate.ts: only comment changed, runtime legacy paths intentional

# Changelog

## [1.3.9] — 2026-04-01

### Added
- **LLM migration guide** (`docs/llm-migration-guide.md`) — prompt-engineered guide that LLMs can follow to migrate users from legacy `~/.claude/memory/` setup to the plugin system. Imperative steps, shell-ready commands, decision table, verification checklist.
- **Curl one-liner in README** — users paste a single curl command into any LLM coding session to trigger the full migration autonomously.

---

## [1.3.8] — 2026-03-27

### Fixed
- **Compact MCP responses** — `ltm_recall` now returns a compact format by default, reducing response size by ~70-80%. Strips verbose metadata fields, truncates content to 300 chars, and slims relations to `{id, type, dir}`. Pass `verbose: true` to get the full output.
- **Removed JSON pretty-printing** across all MCP tools and resources (`ltm_recall`, `ltm_context`, `ltm_context_items`, globals/recent/tags resources). Compact JSON halves whitespace overhead.

---

## [1.3.7] — 2026-03-26

### Added
- **Graph UI improvements** — nav active state, config polish, force-directed graph tuning, health auto-refresh.
- **Config Explorer page** in graph-app — browse LTM configuration visually.
- **`src/janitor/`** module for memory maintenance tasks.

### Changed
- **Graph visualization** migrated from custom D3 to `react-force-graph-2d`.
- **Config Explorer API** added to graph-server (`/api/config-explorer`).
- Removed old HTML route from graph-server.
- LtmServer skill updated to use `CLAUDE_PLUGIN_ROOT` instead of hardcoded `~/.claude/memory/`.

---

## [1.3.0–1.3.6] — 2026-03-25

### Added
- **`/migrate-db` command** — check and migrate `ltm.db` from legacy `~/.claude/memory/` to marketplace plugin data directory.
- **Auto git-fetch** on SessionStart — marketplace clone stays current without manual pulls.
- **Self-healing GitHub source** — `install-wiring.ts` patches `known_marketplaces.json` to `"source":"github"` on every postinstall, preventing the plugin system from reverting to `"git"` source.

### Fixed
- DB path migration fix — ensures `ltm.db` is always found at the correct marketplace data path.
- Duplicate MCP registration removed from `install-wiring.ts`.
- `patchMarketplaceSource` refactored — no mutation, no TOCTOU race, uses named constant.
- Version sync — both `package.json` and `.claude-plugin/plugin.json` are kept in lockstep.

---

## [1.2.0] — 2026-03-24

### Added
- **Git Commit Hooks** (`hooks/src/GitCommit.ts`) — global post-commit hook that auto-extracts learnings from diffs using LLM extraction. Fires on every commit across all projects, exits immediately (non-blocking). Controlled by `ltm.gitLearnEnabled` config flag (default: `false`).
- **Shared LLM extraction** (`hooks/lib/llmExtract.ts`) — `extractAndLearn()` shared by both `EvaluateSession` and `GitCommit` hooks.
- **`/git-learn` skill** (`skills/GitLearn/SKILL.md`) — retroactive extraction for past commits (`--commits N` / `--since <date>`).
- **`scripts/update-wiring.ts`** — re-wires MCP, hooks, and git hook after marketplace updates. Runs automatically via `postinstall` in `package.json`.
- **4 new config fields** in `ltm.*`:
  - `gitLearnEnabled` (boolean, default: `false`)
  - `gitLearnMinDiffChars` (number, default: `200`)
  - `gitLearnFileFilter` (string[], default: `[]`)
  - `gitLearnIgnorePatterns` (string[], default: `["package-lock.json","*.lock","dist/",".min.js"]`)
- **`.ltmignore` opt-out** — place a `.ltmignore` file in any repo root to skip git-learn extraction for that repo.

### Changed
- `EvaluateSession.ts` refactored to use shared `extractAndLearn()` from `hooks/lib/llmExtract.ts`.
- `scripts/install-wiring.ts` now wires global git hook dir (`~/.claude/hooks/git/post-commit`) and sets `git config --global core.hooksPath`.
- `bunfig.toml` — removed invalid `exclude` key; test exclusion handled via `--path-ignore-patterns` in `bun run test`.

---

## [1.1.0] — 2026-03-21

### Added
- ASCII architecture diagrams in README.
- 12 LTM slash commands added to plugin (`skills/`).
- `CLAUDE_PLUGIN_DATA` support for db path isolation per marketplace install.
- `scripts/install-wiring.ts` — replaces Python subprocess in `install.sh`.
- Migration: copies existing `ltm.db` from legacy path on marketplace install.

---

## [1.0.0] — 2026-03-15

### Added
- Initial release.
- SQLite LTM with FTS5 + semantic search via embeddings.
- MCP server (`src/mcp-server.ts`) with 7 tools: `ltm_recall`, `ltm_learn`, `ltm_forget`, `ltm_relate`, `ltm_context`, `ltm_context_items`, `ltm_graph`.
- Claude Code hooks: `SessionStart`, `Stop` (UpdateContext + EvaluateSession), `PreCompact`.
- Memory graph visualization server (`src/graph-server.ts`).
- `install.sh` — safe idempotent installer (never overwrites `ltm.db`).

---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Stability & Hardening
status: Defining requirements
stopped_at: Milestone v2.1 started
last_updated: "2026-04-05T00:00:00Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-29)

**Core value:** Ubuntu users can reliably see the current usage state of their AI providers from a Linux-native surface without depending on the macOS-specific CodexBar shell.
**Current focus:** Planning the next milestone

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-05 — Milestone v2.1 started

## Performance Metrics

**Velocity:**

- Total plans completed: 15
- Average duration: 24 min
- Total execution time: 6.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Backend Contract | 3 | 94 min | 31 min |
| 2. Linux Config & Secrets | 3 | 114 min | 38 min |
| 3. First-Wave Providers | 3 | 39 min | 13 min |
| 4. Ubuntu Desktop Surface | 3 | 43 min | 14 min |
| 6. Provider Reliability | 2 | -- | -- |
| 7. GNOME UI Redesign | 3 | -- | -- |

**Recent Trend:**

- Last 5 plans: 5/5 complete
- Trend: Improving

| Phase 08 P01 | 3min | 2 tasks | 11 files |
| Phase 08 P02 | 8min | 2 tasks | 3 files |
| Phase 08 P03 | 9min | 2 tasks | 4 files |
| Phase 09 P01 | 4min | 2 tasks | 8 files |
| Phase 09 P02 | 3min | 2 tasks | 2 files |
| Phase 09-lifecycle-commands P03 | 3min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2.0 init]: Migrate runtime from Node.js to Bun (matches agent-bar-omarchy patterns)
- [v2.0 init]: Remove Commander and Zod in favor of manual parsing and inline validation
- [v2.0 init]: TypeScript-based lifecycle commands replace bash installer
- [v2.0 roadmap]: Phase ordering follows dependency chain: runtime -> lifecycle -> CLI overhaul -> providers -> TUI
- [v2.0 roadmap]: CLI overhaul (Commander/Zod removal) comes AFTER lifecycle commands exist as test surface
- [v2.0 roadmap]: Provider independence and data infrastructure are co-delivered (cache/refresh/formatting support providers)
- [Phase 08]: Added bun-types as explicit devDep alongside @types/bun for workspace hoisting compatibility
- [Phase 08]: Tracked bun.lock in git (removed from .gitignore) as part of Bun migration
- [Phase 08]: Kept accessSync from node:fs for isExecutable -- Bun supports node:fs, avoids subprocess overhead for permission checks
- [Phase 08]: Migrated service-runtime.test.ts from vitest to bun:test since Bun.listen/connect require Bun runtime
- [Phase 08]: Removed server property from AgentBarServiceRuntime interface (net.Server type no longer applicable)
- [Phase 08]: Kept PtyUnavailableError as deprecated export -- providers and tests reference it for error-handling branches
- [Phase 09]: Used bun:test instead of vitest for settings tests (Bun.file/Bun.write APIs require Bun runtime)
- [Phase 09]: Settings spread order: { ...data, version: CURRENT_VERSION } ensures version override after migration
- [Phase 09]: Used writeFileSync with mode 0o755 for CLI wrapper -- atomic and simpler than separate chmod
- [Phase 09]: runGit helper returns {ok, output} instead of throwing -- matches omarchy pattern for lifecycle commands
- [Phase 09-lifecycle-commands]: initialValue:false for uninstall confirmation -- prevents accidental full data loss
- [Phase 09-lifecycle-commands]: remove.ts is thin wrapper: force:true, preserveSecrets:true, preserveSettings:true
- [Phase 10]: Shared-contract and backend config validation now use inline assertion helpers instead of Zod schemas
- [Phase 10]: CLI routing is manual switch/case dispatch with Levenshtein typo suggestions and boxed help output
- [Phase 10]: Biome is the active formatter/linter baseline for backend, shared-contract, and GNOME extension sources
- [Phase 10]: packages/shared-contract/package.json also had to drop Zod to fully align manifests and lockfiles with the refactor
- [Phase 11]: Provider contract now exposes `name`, `cacheKey`, `isAvailable()`, and `getQuota()` through a central built-in registry entrypoint
- [Phase 11]: `agent-bar providers` is the single source of truth for GNOME topbar provider order/visibility by persisting `config.providers[]`
- [Phase 11]: Snapshot caching is file-backed under XDG cache directories, deduplicated per provider/source key, and reused by both CLI and service flows
- [Phase 11]: Service startup hydrates the last persisted aggregate snapshot before the first background refresh completes
- [Phase 11]: CLI and GNOME user-facing timestamps now rely on locale-aware `Intl.RelativeTimeFormat` / `Intl.DateTimeFormat` helpers
- [Phase 12]: Running `agent-bar` with no arguments opens the interactive menu only in real TTY contexts; non-interactive callers still receive deterministic help text
- [Phase 12]: List All now renders ANSI provider cards with Unicode progress bars using a shared One Dark terminal palette
- [Phase 12]: Provider Login is a guided submenu that reuses the existing Copilot device/token auth backend and launches native Claude/Codex CLIs
- [Phase 12]: `agent-bar doctor` is TTY-aware and uses clack presentation while preserving JSON and plain-text fallback modes
- [Phase 12]: GitHub OAuth App client ID updated to `Ov23lisTTc3tiqjyvwL6` and validated on 2026-03-29 via `POST https://github.com/login/device/code`, which returned HTTP 200 plus a valid `device_code` / `user_code`

### Pending Todos

None yet.

### Blockers/Concerns

- Dev machine is NOT Ubuntu -- GNOME extension, systemd, and secret-tool flows still benefit from manual verification on a real desktop

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260327-glx | Restore GitHub Device Flow robustness and provider source/fallback contracts | 2026-03-27 | ea661b2 | [260327-glx-fix-regressions-after-install-ux-overhau](./quick/260327-glx-fix-regressions-after-install-ux-overhau/) |
| 260329-paa | Refresh provider rows with connected account, usage bar, and reset info | 2026-03-29 | -- | [260329-paa-refresh-provider-rows-with-connected-acc](./quick/260329-paa-refresh-provider-rows-with-connected-acc/) |

## Session Continuity

Last session: 2026-03-29T21:38:30Z
Stopped at: Quick task 260329-paa completed
Resume file: None

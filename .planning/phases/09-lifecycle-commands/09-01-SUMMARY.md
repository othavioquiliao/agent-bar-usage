---
phase: 09-lifecycle-commands
plan: 01
subsystem: lifecycle
tags: [clack-prompts, xdg, settings, atomic-write, dependency-check, bun]

# Dependency graph
requires:
  - phase: 08-bun-migration
    provides: Bun runtime, subprocess utilities (resolveCommandInPath)
provides:
  - "@clack/prompts dependency for interactive CLI flows"
  - "Centralized install path constants via getInstallPaths()"
  - "Pre-flight dependency detection via checkDependencies()"
  - "Versioned settings module with atomic writes and migration"
affects: [09-02, 09-03, 10-cli-overhaul]

# Tech tracking
tech-stack:
  added: ["@clack/prompts ^1.1.0"]
  patterns: ["XDG path resolution with env var fallbacks", "Atomic file writes (temp+rename)", "Versioned settings with migration hooks"]

key-files:
  created:
    - apps/backend/src/lifecycle/paths.ts
    - apps/backend/src/lifecycle/dependency-check.ts
    - apps/backend/src/settings/settings-schema.ts
    - apps/backend/src/settings/settings.ts
    - apps/backend/test/settings.test.ts
  modified:
    - apps/backend/package.json
    - pnpm-lock.yaml
    - apps/backend/vitest.config.ts

key-decisions:
  - "Used bun:test instead of vitest for settings tests (Bun.file/Bun.write APIs require Bun runtime)"
  - "Settings spread order: { ...data, version: CURRENT_VERSION } ensures version override after migration"

patterns-established:
  - "Lifecycle modules under src/lifecycle/ for install/update/remove infrastructure"
  - "Settings schema separated from settings logic (settings-schema.ts vs settings.ts)"
  - "Bun-native test files excluded from vitest.config.ts and run with bun test"

requirements-completed: [DATA-04]

# Metrics
duration: 4min
completed: 2026-03-29
---

# Phase 9 Plan 1: Lifecycle Foundation Summary

**@clack/prompts dependency, XDG-aware install paths, dependency detection, and versioned settings with atomic writes and migration support**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T00:18:41Z
- **Completed:** 2026-03-29T00:23:27Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Installed @clack/prompts as the interactive CLI framework for all lifecycle commands
- Created centralized install path constants matching the existing install-ubuntu.sh (CLI symlink, systemd, GNOME extension, settings, cache)
- Implemented pre-flight dependency detection for bun, secret-tool, and gnome-extensions with install hints
- Built versioned settings module with atomic writes (temp file + rename), load sync/async, and migration hooks

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @clack/prompts and create lifecycle paths + dependency check** - `9ef9567` (feat)
2. **Task 2: Versioned settings module (TDD RED)** - `eb47a3f` (test)
3. **Task 2: Versioned settings module (TDD GREEN)** - `7d9e6ad` (feat)

## Files Created/Modified
- `apps/backend/package.json` - Added @clack/prompts dependency
- `pnpm-lock.yaml` - Updated lockfile
- `apps/backend/src/lifecycle/paths.ts` - APP_NAME, GNOME_EXT_UUID, REPO_ROOT, EXT_ITEMS, ENV_VARS_TO_CAPTURE, getInstallPaths()
- `apps/backend/src/lifecycle/dependency-check.ts` - checkDependencies() with REQUIRED_DEPS for bun, secret-tool, gnome-extensions
- `apps/backend/src/settings/settings-schema.ts` - Settings interface, CURRENT_VERSION=1, DEFAULT_SETTINGS
- `apps/backend/src/settings/settings.ts` - loadSettings, loadSettingsSync, saveSettings, normalizeSettings, getSettingsPath
- `apps/backend/test/settings.test.ts` - 7 tests covering normalize, load, save, round-trip, and sync load
- `apps/backend/vitest.config.ts` - Excluded settings.test.ts (uses bun:test)

## Decisions Made
- Used bun:test instead of vitest for settings tests because settings.ts relies on Bun.file() and Bun.write() APIs which are unavailable in vitest's Node environment
- Settings normalization uses `{ ...data, version: CURRENT_VERSION }` spread order to ensure the version field is always set to current after migration

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed normalizeSettings spread order**
- **Found during:** Task 2 (TDD GREEN)
- **Issue:** Plan specified `{ version: CURRENT_VERSION, ...data }` which causes `data.version` to overwrite CURRENT_VERSION when migrating old settings
- **Fix:** Reversed spread order to `{ ...data, version: CURRENT_VERSION }` so version is always current
- **Files modified:** apps/backend/src/settings/settings.ts
- **Verification:** Test "calls migrateSettings and returns current version when version < CURRENT_VERSION" passes
- **Committed in:** 7d9e6ad

**2. [Rule 3 - Blocking] Converted tests from vitest to bun:test**
- **Found during:** Task 2 (TDD GREEN)
- **Issue:** settings.ts uses Bun.file() and Bun.write() which are not available in vitest's Node.js environment
- **Fix:** Rewrote tests using bun:test imports and mock.module(), excluded from vitest.config.ts
- **Files modified:** apps/backend/test/settings.test.ts, apps/backend/vitest.config.ts
- **Verification:** All 7 tests pass with `bun test`
- **Committed in:** 7d9e6ad

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correctness and test execution. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Lifecycle paths, dependency detection, and settings modules are ready for Phase 9 Plan 2 (setup/remove commands)
- @clack/prompts is available for interactive CLI flows in all lifecycle commands
- Settings migration hooks are extensible for future schema versions

## Self-Check: PASSED

All 6 created files exist. All 3 task commits verified (9ef9567, eb47a3f, 7d9e6ad). No stubs found.

---
*Phase: 09-lifecycle-commands*
*Completed: 2026-03-29*

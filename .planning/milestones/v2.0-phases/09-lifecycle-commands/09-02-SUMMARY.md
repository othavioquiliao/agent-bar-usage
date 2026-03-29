---
phase: 09-lifecycle-commands
plan: 02
subsystem: lifecycle
tags: [clack-prompts, systemd, gnome-extension, git, bun, interactive-cli]

# Dependency graph
requires:
  - phase: 09-lifecycle-commands/01
    provides: "paths.ts (getInstallPaths, REPO_ROOT, EXT_ITEMS, ENV_VARS_TO_CAPTURE), dependency-check.ts (checkDependencies)"
provides:
  - "runSetup() -- interactive setup command replacing bash installer"
  - "runUpdate() -- interactive update command with git fetch/pull/restart"
affects: [09-lifecycle-commands/03, cli-overhaul]

# Tech tracking
tech-stack:
  added: []
  patterns: ["@clack/prompts spinner+confirm+note flow for lifecycle commands", "Dependency injection interfaces for testability (SetupDependencies, UpdateDependencies)", "runGit helper wrapping runSubprocess with error-safe returns"]

key-files:
  created:
    - apps/backend/src/lifecycle/setup.ts
    - apps/backend/src/lifecycle/update.ts
  modified: []

key-decisions:
  - "Used writeFileSync with mode 0o755 for CLI wrapper instead of Bun.writeSync+chmod -- simpler and atomic"
  - "runGit helper returns {ok, output} instead of throwing -- matches omarchy pattern and simplifies control flow"
  - "env.conf generation iterates ENV_VARS_TO_CAPTURE from paths.ts -- single source of truth for captured vars"

patterns-established:
  - "Lifecycle command pattern: console.clear -> p.intro -> validation -> p.note (explain) -> p.confirm -> spinner steps -> p.outro"
  - "Git helper pattern: async runGit(args, run) returning {ok, output} for non-throwing git operations"

requirements-completed: [LIFE-01, LIFE-03]

# Metrics
duration: 3min
completed: 2026-03-29
---

# Phase 09 Plan 02: Setup & Update Commands Summary

**Interactive @clack/prompts setup and update lifecycle commands replacing bash installer with dependency check, systemd service management, GNOME extension copy, and git-based update flow**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-29T00:26:08Z
- **Completed:** 2026-03-29T00:29:57Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- setup.ts implements full install flow: dependency check (Bun critical gate), CLI wrapper, systemd service + env override, tmpfiles.d, systemctl management, GNOME extension copy + enable, PATH warning
- update.ts implements safe update: dirty state check (fail on local changes), git fetch, incoming commit preview, git pull --ff-only, bun install, service restart, GNOME extension re-copy
- Both commands use @clack/prompts consistently (intro, note, confirm, spinner, log, outro) with no process.exit() or sudo

## Task Commits

Each task was committed atomically:

1. **Task 1: Setup command** - `16bd02e` (feat)
2. **Task 2: Update command** - `c09a0af` (feat)

## Files Created/Modified
- `apps/backend/src/lifecycle/setup.ts` - Interactive setup command with full install flow (dependency check, CLI wrapper, systemd, tmpfiles, GNOME extension)
- `apps/backend/src/lifecycle/update.ts` - Interactive update command with git fetch/pull, bun install, service restart, extension re-copy

## Decisions Made
- Used `writeFileSync` with `{ mode: 0o755 }` for the CLI wrapper instead of separate chmod call -- atomic and simpler
- Created `runGit` helper that returns `{ok, output}` instead of throwing -- matches the omarchy update.ts pattern and simplifies conditional control flow
- env.conf generation reads `ENV_VARS_TO_CAPTURE` from paths.ts as single source of truth

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Known Stubs
None - both commands are fully wired to the infrastructure from Plan 01.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- setup.ts and update.ts are ready to be wired into the CLI router (Plan 03: remove command)
- Both export their main functions (runSetup, runUpdate) with dependency injection for future testing
- The remove command (Plan 03) can follow the same @clack/prompts pattern established here

---
*Phase: 09-lifecycle-commands*
*Completed: 2026-03-29*

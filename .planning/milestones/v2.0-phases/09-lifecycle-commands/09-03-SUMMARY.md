---
phase: 09-lifecycle-commands
plan: 03
subsystem: lifecycle
tags: [uninstall, remove, commander, cli, systemd, gnome-keyring, clack-prompts]

# Dependency graph
requires:
  - phase: 09-lifecycle-commands/01
    provides: "paths.ts with getInstallPaths(), APP_NAME, dependency-check.ts"
  - phase: 09-lifecycle-commands/02
    provides: "setup.ts (runSetup), update.ts (runUpdate)"
provides:
  - "runUninstall() with full cleanup (files + secrets + settings/cache)"
  - "runRemove() thin wrapper preserving secrets and settings"
  - "registerLifecycleCommands() wiring all four commands to Commander"
  - "CLI entry point updated with lifecycle command registration"
affects: [10-cli-overhaul]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Thin wrapper pattern (remove delegates to uninstall with options)", "Dependency injection for lifecycle commands (UninstallDependencies)"]

key-files:
  created:
    - apps/backend/src/lifecycle/uninstall.ts
    - apps/backend/src/lifecycle/remove.ts
    - apps/backend/src/commands/lifecycle-command.ts
  modified:
    - apps/backend/src/cli.ts

key-decisions:
  - "initialValue: false for uninstall confirmation (locked decision -- prevents accidental data loss)"
  - "remove.ts is a thin wrapper calling runUninstall with force:true, preserveSecrets:true, preserveSettings:true"
  - "KNOWN_SECRETS array with both service + account attributes to avoid deleting unrelated secrets"

patterns-established:
  - "Lifecycle command pattern: thin Commander registration in lifecycle-command.ts, logic in lifecycle/*.ts"
  - "Destructive operation confirmation: initialValue: false for dangerous operations"

requirements-completed: [LIFE-02, LIFE-04]

# Metrics
duration: 3min
completed: 2026-03-29
---

# Phase 09 Plan 03: Remove & Uninstall Commands + CLI Wiring Summary

**Remove and uninstall lifecycle commands with GNOME Keyring secret clearing, systemd cleanup, and Commander registration for all four lifecycle commands**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-29T00:27:03Z
- **Completed:** 2026-03-29T00:30:50Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Uninstall command with full cleanup: systemd stop/disable, file removal, GNOME Keyring secret clearing, settings/cache deletion, with initialValue:false confirmation
- Remove command as thin wrapper preserving secrets and settings for easy reinstall
- All four lifecycle commands (setup, update, remove, uninstall) registered in Commander and accessible via CLI
- CLI entry point wired with registerLifecycleCommands(program)

## Task Commits

Each task was committed atomically:

1. **Task 1: Uninstall + Remove commands** - `c09a0af` (feat)
2. **Task 2: Commander registration + CLI wiring** - `77745e3` (feat)

## Files Created/Modified
- `apps/backend/src/lifecycle/uninstall.ts` - Full uninstall with systemd cleanup, file removal, and GNOME Keyring secret clearing
- `apps/backend/src/lifecycle/remove.ts` - Thin wrapper calling runUninstall with preserveSecrets:true, preserveSettings:true
- `apps/backend/src/commands/lifecycle-command.ts` - Commander registration for setup, update, remove, uninstall
- `apps/backend/src/cli.ts` - Added import and call to registerLifecycleCommands(program)

## Decisions Made
- **initialValue: false for uninstall**: Locked decision from plan -- prevents accidental full data loss by defaulting confirmation to "No"
- **remove preserves secrets and settings**: Locked decision -- users can reinstall without losing GNOME Keyring tokens or settings.json
- **KNOWN_SECRETS always specifies both service AND account**: Prevents accidentally deleting unrelated secrets from GNOME Keyring
- **process.exitCode instead of process.exit()**: Matches existing convention from auth-command.ts, allows graceful cleanup

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all commands are fully wired to their implementation.

## Next Phase Readiness
- All four lifecycle commands accessible via `agent-bar setup|update|remove|uninstall`
- Phase 10 (CLI overhaul) can now replace Commander registration with manual parsing since the lifecycle surface exists as test target
- KNOWN_SECRETS array is extensible for future providers

---
*Phase: 09-lifecycle-commands*
*Completed: 2026-03-29*

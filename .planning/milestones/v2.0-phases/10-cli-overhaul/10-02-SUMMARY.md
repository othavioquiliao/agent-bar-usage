---
phase: 10-cli-overhaul
plan: 02
subsystem: cli
tags: [manual-parser, help-ui, commander-removal, levenshtein, direct-runners]

# Dependency graph
requires:
  - phase: 10-cli-overhaul/01
    provides: "Inline assertions used by the CLI command surface after Commander removal"
provides:
  - "Manual CLI parsing via switch/case dispatch"
  - "Box-drawing help output with readable column layout"
  - "Typo suggestions for unknown top-level commands"
  - "Direct callable command runners with no Commander registration layer"
affects: [10-03, 12-terminal-ui-code-quality]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct runner exports instead of framework registration helpers"
    - "Levenshtein suggestion for top-level command recovery"
    - "Small parse helpers for shared flag families (json/pretty, auth, config)"

key-files:
  created:
    - apps/backend/test/cli.test.ts
  modified:
    - apps/backend/src/cli.ts
    - apps/backend/src/commands/auth-command.ts
    - apps/backend/src/commands/config-command.ts
    - apps/backend/src/commands/diagnostics-command.ts
    - apps/backend/src/commands/service-command.ts
    - apps/backend/src/commands/lifecycle-command.ts

key-decisions:
  - "Manual parser mirrors the omarchy CLI shape instead of introducing a new abstraction"
  - "Help output uses widened fixed columns so compound commands remain readable in the box layout"
  - "Command modules expose direct run helpers and keep error formatting local to each command"

requirements-completed: [CLI-01, CLI-03]

# Metrics
duration: 1 session
completed: 2026-03-29
---

# Phase 10 Plan 02: Manual CLI Summary

**The backend CLI no longer depends on Commander; it dispatches manually, suggests near matches, and prints a structured help screen.**

## Accomplishments

- Rewrote `apps/backend/src/cli.ts` around manual argument parsing and direct command dispatch
- Removed Commander registration APIs from auth/config/diagnostics/service/lifecycle command modules
- Added typo recovery through `suggestCommand()` and verified `agent-bar stup` suggests `setup`
- Added a dedicated CLI regression suite covering help rendering, nested dispatch, and invalid-command suggestions
- Fixed a help-layout regression found during real CLI execution by widening the table columns

## Verification

- `cd apps/backend && bun run vitest run test/cli.test.ts`
- `cd apps/backend && bun run src/cli.ts --help`
- `cd apps/backend && bun run src/cli.ts stup`

## Deviations From Plan

- The first help-box width was too narrow for compound commands (`service ...`, `setup | update | ...`); the final implementation widened the layout after a real-command spot check

## Next Phase Readiness

- The CLI surface is now framework-free, which simplifies the Phase 11 provider-selection command and the Phase 12 TUI entrypoint

---
*Phase: 10-cli-overhaul*
*Completed: 2026-03-29*

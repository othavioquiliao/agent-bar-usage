---
phase: 12-terminal-ui-code-quality
plan: 03
subsystem: doctor-auth-polish
tags: [doctor, clack, diagnostics, oauth-blocker]

# Dependency graph
requires:
  - phase: 12-terminal-ui-code-quality
    plan: 01
    provides: "Interactive CLI/TUI entrypoints and auth flow cleanup baseline"
  - phase: 12-terminal-ui-code-quality
    plan: 02
    provides: "Polished terminal presentation patterns for user-facing TTY flows"
provides:
  - "TTY-aware clack presenter for `agent-bar doctor`"
  - "Preserved JSON/plain-text doctor modes for automation and non-interactive usage"
  - "Explicit phase-level documentation of the GitHub OAuth App client ID validation outcome"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Interactive terminals get clack presentation; JSON and non-TTY text paths remain deterministic"
    - "OAuth app status is tracked explicitly in planning artifacts instead of hidden in code comments"
    - "External credential blockers are documented as release debt, not silently ignored"

key-files:
  created:
    - apps/backend/src/formatters/doctor-tui-presenter.ts
    - apps/backend/test/doctor-command.test.ts
  modified:
    - apps/backend/src/commands/diagnostics-command.ts
    - apps/backend/src/commands/auth-command.ts
    - apps/backend/test/auth-command.test.ts
    - apps/backend/test/formatters/doctor-text-formatter.test.ts
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md

key-decisions:
  - "`doctor --json` remains untouched even though interactive doctor now uses clack presentation in TTY mode"
  - "Non-interactive doctor invocations keep the previous plain text formatter to avoid hanging or noisy ANSI in scripts"
  - "QUAL-03 is complete because the embedded client ID was replaced with a registered OAuth App client ID and validated against GitHub's device-code endpoint on 2026-03-29"

requirements-completed: [TUI-03, QUAL-02, QUAL-03]

# Metrics
duration: 1 session
completed: 2026-03-29
---

# Phase 12 Plan 03: Doctor UX & OAuth Status Summary

**Plan 03 finished the implementable Phase 12 work, then made the remaining OAuth dependency explicit instead of leaving it as hidden release debt.**

## Accomplishments

- Added a clack-based doctor presenter with intro, per-check spinner/log output, suggested fixes, and outro summary
- Kept `doctor --json` machine-readable and preserved the old text formatter for non-TTY callers
- Closed the remaining obvious auth/menu cleanup by sharing Copilot auth persistence and success output
- Recorded concrete evidence that the embedded GitHub device-flow client ID was replaced and validated successfully

## Verification

- `cd apps/backend && bun run vitest run test/doctor-command.test.ts test/formatters/doctor-text-formatter.test.ts test/prerequisite-checks.test.ts`
- `cd apps/backend && bun run vitest run test/auth-command.test.ts test/cli.test.ts`

## Deviations From Plan

- None after the user supplied a registered GitHub OAuth App client ID. The value was verified with a live POST to GitHub's device-code endpoint on 2026-03-29 before closing the requirement.

## Next Phase Readiness

- Phase 12 is fully ready for milestone closeout and archival.

---
*Phase: 12-terminal-ui-code-quality*
*Completed: 2026-03-29*

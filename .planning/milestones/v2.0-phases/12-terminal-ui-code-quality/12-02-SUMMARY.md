---
phase: 12-terminal-ui-code-quality
plan: 02
subsystem: terminal-display
tags: [formatter, ansi, progress-bars, one-dark]

# Dependency graph
requires:
  - phase: 12-terminal-ui-code-quality
    plan: 01
    provides: "Interactive menu shell and List All action hook"
  - phase: 11-provider-independence-data
    provides: "Stable SnapshotEnvelope shape and locale-aware time helpers"
provides:
  - "ANSI-styled provider quota cards with Unicode progress bars"
  - "One Dark color theme for terminal-facing snapshot output"
  - "Readable rendering for provider error/unavailable states"
affects: [12-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rich terminal output is a pure formatter over `SnapshotEnvelope`"
    - "Provider accents are data-driven by provider id with sane fallbacks"
    - "Locale-aware reset/updated text reuses shared time formatting helpers"

key-files:
  created:
    - apps/backend/src/formatters/terminal-theme.ts
    - apps/backend/src/formatters/terminal-snapshot-formatter.ts
    - apps/backend/test/terminal-snapshot-formatter.test.ts
  modified:
    - apps/backend/src/commands/menu-command.ts
    - apps/backend/test/menu-command.test.ts

key-decisions:
  - "The List All surface renders compact cards instead of a table so mixed provider states remain readable"
  - "Progress bars clamp percent values and fall back to commented placeholders when quota data is missing"
  - "Terminal visuals stay backend-local and do not alter JSON/service payload contracts"

requirements-completed: [TUI-02]

# Metrics
duration: 1 session
completed: 2026-03-29
---

# Phase 12 Plan 02: Rich Terminal Formatter Summary

**Plan 02 delivered the visual payoff of the new TUI by replacing plain quota text with provider cards, ANSI accents, and Unicode progress bars.**

## Accomplishments

- Added a shared One Dark terminal theme with provider accent colors
- Implemented `formatSnapshotAsTerminal()` over `SnapshotEnvelope`
- Rendered usage, status, source, updated/reset timing, errors, and diagnostics inside compact provider cards
- Wired the menu's List All action to the new formatter
- Added formatter regression tests covering progress bars, ANSI color output, and error cards

## Verification

- `cd apps/backend && bun run vitest run test/terminal-snapshot-formatter.test.ts`
- `cd apps/backend && bun run vitest run test/menu-command.test.ts test/terminal-snapshot-formatter.test.ts`

## Deviations From Plan

- None. The formatter remained generic to the shared snapshot contract and did not require provider-specific DTO changes.

## Next Phase Readiness

- Doctor presentation in Plan 03 can now match the same interactive quality bar without changing machine-readable paths.

---
*Phase: 12-terminal-ui-code-quality*
*Completed: 2026-03-29*

---
phase: 04-ubuntu-desktop-surface
plan: "01"
subsystem: ui
tags: [gnome, gjs, shell-extension, vitest, state, scaffold]
requires:
  - phase: 03-first-wave-providers
    provides: backend snapshot contract, provider isolation, CLI bridge
provides:
  - GNOME Shell extension workspace scaffold for Ubuntu 24.04.4 LTS
  - Minimal indicator lifecycle with clean enable/disable boundaries
  - Pure-JS extension state and JSON parsing seam for test coverage
affects: [gnome-extension, desktop-surface, ui]
tech-stack:
  added: [GJS, GNOME Shell 46 metadata, PanelMenu, St, Vitest]
  patterns: [shell-only UI boundary, pure state reducer seam, extension lifecycle ownership]
key-files:
  created:
    - apps/gnome-extension/metadata.json
    - apps/gnome-extension/extension.js
    - apps/gnome-extension/panel/indicator.js
    - apps/gnome-extension/state/extension-state.js
    - apps/gnome-extension/utils/json.js
    - apps/gnome-extension/test/extension-state.test.js
  modified:
    - apps/gnome-extension/package.json
    - apps/gnome-extension/vitest.config.ts
key-decisions:
  - "Keep all non-shell state logic in pure JS modules so Vitest can exercise it without GNOME Shell imports."
  - "Own the indicator instance in the extension lifecycle and destroy it explicitly on disable."
patterns-established:
  - "Pure state helpers remain free of GNOME Shell imports."
  - "The extension entrypoint only owns lifecycle and dependency wiring."
requirements-completed: [UI-01]
duration: 14min
completed: 2026-03-25
---

# Phase 4 Plan 01 Summary

**GNOME Shell extension workspace scaffold with a minimal indicator lifecycle and a pure-JS state seam.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-25T16:13:00Z
- **Completed:** 2026-03-25T16:27:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Added a first-class `apps/gnome-extension` workspace with GNOME metadata and a test command.
- Wired `extension.js` to create and destroy the indicator cleanly through `enable()` and `disable()`.
- Established a pure-state seam with strict JSON parsing and baseline coverage outside GNOME Shell imports.

## Task Commits

- Not recorded as separate git commits in this session; the plan landed as a validated working-tree snapshot.

## Files Created/Modified
- `apps/gnome-extension/metadata.json` - GNOME Shell 46 extension metadata and identity.
- `apps/gnome-extension/extension.js` - Extension lifecycle entrypoint and indicator ownership.
- `apps/gnome-extension/panel/indicator.js` - Minimal top-bar indicator shell.
- `apps/gnome-extension/state/extension-state.js` - Pure state transitions for loading, success, and error.
- `apps/gnome-extension/utils/json.js` - Strict backend JSON parser with clear failure messages.
- `apps/gnome-extension/test/extension-state.test.js` - Baseline coverage for state transitions and JSON parsing.

## Decisions Made
- Keep shell-facing code thin and push testable logic into pure modules.
- Target GNOME Shell 46 for the Ubuntu 24.04.4 LTS surface.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The extension scaffold is in place, so the backend bridge and refresh orchestration can build on the pure state seam.

---
*Phase: 04-ubuntu-desktop-surface*
*Completed: 2026-03-25*

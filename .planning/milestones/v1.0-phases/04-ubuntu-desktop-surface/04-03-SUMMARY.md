---
phase: 04-ubuntu-desktop-surface
plan: "03"
subsystem: ui
tags: [gnome, ui, popup-menu, view-model, refresh, accessibility]
requires:
  - phase: 04-02
    provides: backend bridge, polling service, snapshot state transitions
provides:
  - Provider row view models for usage, reset, update time, source, and error text
  - GNOME popup menu composition with summary, provider, details, and refresh sections
  - Visible indicator summary states for loading, healthy, warning, and error conditions
affects: [gnome-extension, menu, top-bar-ui]
tech-stack:
  added: [PopupMenu primitives, GNOME Shell summary labels, pure snapshot-to-view-model mapping]
  patterns: [normalized snapshot -> view model -> UI, refresh action gating while loading, multi-line provider detail rows]
key-files:
  created:
    - apps/gnome-extension/panel/provider-row.js
    - apps/gnome-extension/panel/menu-builder.js
    - apps/gnome-extension/utils/view-model.js
    - apps/gnome-extension/test/view-model.test.js
  modified:
    - apps/gnome-extension/panel/indicator.js
    - apps/gnome-extension/extension.js
    - apps/gnome-extension/services/polling-service.js
key-decisions:
  - "Render UI from normalized snapshot view models instead of letting popup code reach into subprocess or backend concerns."
  - "Keep provider failures visible in the row output and add a manual refresh action that is disabled while loading."
  - "Show last-updated and backend-error details in a dedicated footer section so the top bar stays readable."
patterns-established:
  - "Indicator summary and provider rows are derived from the latest snapshot envelope."
  - "Menu sections are rebuilt from state changes rather than mutated in place."
requirements-completed: [UI-01, UI-02, UI-03]
duration: 12min
completed: 2026-03-25
---

# Phase 4 Plan 03 Summary

**A readable GNOME top-bar surface with provider detail rows, manual refresh, and explicit backend failure visibility.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-25T16:44:00Z
- **Completed:** 2026-03-25T16:56:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Added pure view-model mapping for provider state, including usage, reset windows, update times, and errors.
- Built the GNOME popup menu layout with summary, provider rows, refresh action, and footer details.
- Upgraded the indicator summary state so loading, healthy, warning, and error conditions are visible at a glance.

## Task Commits

- Not recorded as separate git commits in this session; the plan landed as a validated working-tree snapshot.

## Files Created/Modified
- `apps/gnome-extension/panel/provider-row.js` - Multi-line provider row rendering.
- `apps/gnome-extension/panel/menu-builder.js` - Popup menu composition for summary, providers, and actions.
- `apps/gnome-extension/utils/view-model.js` - Snapshot-to-view-model mapping for indicator and provider rows.
- `apps/gnome-extension/test/view-model.test.js` - Healthy, error, unavailable, and empty-envelope coverage.
- `apps/gnome-extension/panel/indicator.js` - Summary icon/label rendering and menu rebuild wiring.
- `apps/gnome-extension/extension.js` - Refresh handler hookup and lifecycle teardown wiring.

## Decisions Made
- Keep the UI free of direct backend calls and make it consume normalized state only.
- Gate `Refresh Now` while a refresh is in progress so repeated clicks do not pile up requests.
- Surface last-updated metadata and backend errors in a footer area rather than in the summary line.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The Ubuntu desktop surface is now usable, so the remaining phase can focus on diagnostics, packaging, installation, and release hardening.

---
*Phase: 04-ubuntu-desktop-surface*
*Completed: 2026-03-25*

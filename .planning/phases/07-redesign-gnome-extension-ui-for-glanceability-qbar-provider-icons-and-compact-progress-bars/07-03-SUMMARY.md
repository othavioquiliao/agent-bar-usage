---
phase: 07-redesign-gnome-extension-ui-for-glanceability-qbar-provider-icons-and-compact-progress-bars
plan: "03"
subsystem: ui
tags: [gnome-extension, gjs, view-model, vitest]
requires:
  - phase: 07-01
    provides: packaged stylesheet and provider icon assets for the installed GNOME extension
  - phase: 07-02
    provides: compact indicator and provider-row view-model contract for the redesigned UI
provides:
  - structured GNOME provider rows with icons, quota-first copy, and compact progress bars
  - concise summary, details, and refresh menu hierarchy with aggregate-only top-bar copy
  - approved live GNOME Shell verification for the Phase 7 redesign
affects: [07-VALIDATION.md, apps/gnome-extension/panel/indicator.js, apps/gnome-extension/panel/menu-builder.js, apps/gnome-extension/panel/provider-row.js]
tech-stack:
  added: []
  patterns: [pure provider-row layout seam, aggregate-only indicator copy, details-only actionable commands]
key-files:
  created: [apps/gnome-extension/panel/provider-row-model.js, apps/gnome-extension/panel/progress-bar.js]
  modified: [apps/gnome-extension/panel/provider-row.js, apps/gnome-extension/panel/menu-builder.js, apps/gnome-extension/panel/indicator.js, apps/gnome-extension/test/provider-row.test.js, apps/gnome-extension/services/polling-service.js]
key-decisions:
  - "Keep each provider row to identity, status, quota/progress, and one short secondary line while moving actionable command text to Details."
  - "Keep the panel indicator aggregate-only with one icon and one short label instead of adding per-provider strips."
  - "Treat the resumed human checkpoint response `approved` as the required live GNOME Shell sign-off for Task 3."
patterns-established:
  - "Provider row layout decisions stay in pure JS so Vitest can cover GNOME presentation rules without importing GJS modules."
  - "The refresh action remains the last menu item and stays disabled while loading."
requirements-completed: []
duration: 10 min
completed: 2026-03-26
---

# Phase 07 Plan 03: Compact GNOME Rendering Summary

**Structured GNOME provider rows with packaged icons, compact quota progress bars, terse details, and an approved aggregate-only panel indicator**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-26T13:25:46-03:00
- **Completed:** 2026-03-26T13:36:11-03:00
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Replaced prose-heavy popup rows with structured GNOME widgets driven by a pure provider-row layout seam and a reusable compact progress-bar actor.
- Rebuilt the menu into a scan-first hierarchy with one concise summary row, compact provider rows, a secondary details footer, and a preserved single-flight refresh action.
- Kept the top-bar indicator aggregate-only and completed the live GNOME Shell verification checkpoint with an explicit `approved` result.

## Task Commits

Each code task was committed atomically:

1. **Task 1: Replace multiline provider rows with structured St widget composition** - `292e575` (feat)
2. **Task 2: Update the top-bar indicator to the aggregate-only Phase 7 summary contract** - `68cf5f3` (feat)
3. **Task 3: Verify the redesigned menu in a real GNOME Shell 46 session** - Approved checkpoint, no code commit

## Files Created/Modified

- `apps/gnome-extension/panel/provider-row-model.js` - Pure JS layout helper that decides row copy, progress visibility, and secondary-line priority.
- `apps/gnome-extension/panel/progress-bar.js` - Compact reusable GNOME progress-bar actor for 4px quota tracks.
- `apps/gnome-extension/panel/provider-row.js` - Structured provider-row rendering using GNOME widgets, identity icons, and the compact progress bar.
- `apps/gnome-extension/panel/menu-builder.js` - Concise summary/details/refresh menu composition that removes multiline prose blocks.
- `apps/gnome-extension/panel/indicator.js` - Aggregate-only single-line indicator label behavior for the top bar.
- `apps/gnome-extension/test/provider-row.test.js` - Node-side regression coverage for row layout priorities and progress visibility.
- `apps/gnome-extension/services/polling-service.js` - Async refresh error propagation fix needed by the regression suite.

## Decisions Made

- Kept the provider-row layout logic in a pure JS seam and left GJS actor creation as a thin rendering layer.
- Preserved the existing aggregate summary and menu rebuild path instead of introducing provider-specific panel chrome.
- Accepted the resumed checkpoint's `approved` response as the live GNOME verification gate for this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rethrow async refresh failures after snapshot error updates**
- **Found during:** Task 1 (Replace multiline provider rows with structured St widget composition)
- **Issue:** The polling service updated error state but swallowed the rejected refresh promise, which weakened regression coverage around single-flight refresh failures while verifying the redesigned menu.
- **Fix:** Rethrew the original error after `applySnapshotError(...)` so callers and tests can observe refresh failures without losing the emitted error snapshot.
- **Files modified:** `apps/gnome-extension/services/polling-service.js`
- **Verification:** `pnpm --filter gnome-extension exec vitest run test/provider-row.test.js test/polling-service.test.js --config vitest.config.ts`
- **Committed in:** `292e575`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The deviation was required for correct async error propagation and regression coverage. The UI scope stayed unchanged.

## Issues Encountered

- The planned GNOME verification checkpoint resumed cleanly and the user approved it without reporting defects.
- `roadmap update-plan-progress` and `state advance-plan` updated the machine-readable status, but left stale human-readable Phase 07 progress text in `ROADMAP.md` and `STATE.md`; corrected those rows manually before the final docs commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 7 is fully closed from packaging through live GNOME verification, with the compact indicator and popup menu contract now implemented and approved.
- Follow-on UI or reliability work can reuse the new row-layout seam, packaged provider icons, and aggregate indicator copy without revisiting the Phase 7 rendering baseline.

## Self-Check

PASSED

- Found summary file on disk.
- Verified task commits `292e575` and `68cf5f3` in git history.

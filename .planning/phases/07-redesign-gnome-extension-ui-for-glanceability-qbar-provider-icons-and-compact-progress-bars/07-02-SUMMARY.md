---
phase: 07-redesign-gnome-extension-ui-for-glanceability-qbar-provider-icons-and-compact-progress-bars
plan: "02"
subsystem: ui
tags: [gnome-extension, view-model, vitest]
requires:
  - phase: 04-ubuntu-desktop-surface
    provides: normalized GNOME extension snapshot and polling state seam
provides:
  - compact aggregate indicator labels with healthy and issue counts
  - provider row view models with icon, quota, progress, and details-only diagnostics fields
  - targeted GNOME extension test runner forwarding for file-specific Vitest verification
affects: [07-03-PLAN.md, apps/gnome-extension/panel/indicator.js, apps/gnome-extension/panel/provider-row.js]
tech-stack:
  added: []
  patterns: [compact snapshot-to-view-model mapping, details-only diagnostics fields, targeted vitest wrapper]
key-files:
  created: [apps/gnome-extension/scripts/run-vitest.mjs]
  modified: [apps/gnome-extension/test/view-model.test.js, apps/gnome-extension/utils/view-model.js, apps/gnome-extension/package.json]
key-decisions:
  - "Keep the normalized snapshot seam intact while adding the Phase 7 compact row and indicator fields."
  - "Preserve legacy row aliases during the contract transition so Phase 7 rendering can swap presentation without a second data-shape rewrite."
  - "Strip pnpm's literal -- separator in the GNOME extension test script so plan verification can target a single Vitest file."
patterns-established:
  - "Indicator copy is aggregate-only: Refreshing, Service, No data, X/Y ok, and N issue(s)."
  - "Provider rows separate scan-path fields from details-only diagnostics and command text."
requirements-completed: []
duration: 2 min
completed: 2026-03-26
---

# Phase 07 Plan 02: Compact View-Model Contract Summary

**Compact GNOME indicator and provider-row view models with aggregate health copy, quota-first row fields, and targeted Vitest verification**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-26T13:14:14-03:00
- **Completed:** 2026-03-26T13:16:21-03:00
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Rewrote the GNOME extension view-model tests to lock the Phase 7 compact indicator and provider-row contract in executable assertions.
- Implemented aggregate indicator counts plus compact row fields for icons, quota text, progress state, secondary metadata, and details-only diagnostics.
- Fixed the GNOME extension test script so the plan's exact `pnpm --filter gnome-extension test -- test/view-model.test.js` verification command targets only the requested file.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing view-model tests for the compact indicator and row contract** - `352ab0e` (test)
2. **Task 2: Implement the compact view-model contract and make the tests pass** - `17ffde8` (feat)

## Files Created/Modified

- `apps/gnome-extension/test/view-model.test.js` - Locks the compact indicator copy and provider-row contract with RED/GREEN assertions.
- `apps/gnome-extension/utils/view-model.js` - Exposes aggregate counts and compact provider-row fields for the Phase 7 rendering swap.
- `apps/gnome-extension/package.json` - Routes the GNOME extension test script through a wrapper that forwards file targets correctly.
- `apps/gnome-extension/scripts/run-vitest.mjs` - Strips pnpm's literal `--` separator and invokes Vitest with the intended single-file target.

## Decisions Made

- Kept the normalized snapshot seam intact and expanded the contract instead of rewriting menu logic in the view layer.
- Preserved legacy row aliases like `usageText`, `sourceText`, and `suggestedCommandText` so downstream rendering work can migrate incrementally.
- Treated broken targeted test forwarding as a blocking verification issue and fixed it in the package-level runner instead of broadening scope into unrelated test files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed GNOME extension test forwarding for single-file verification**
- **Found during:** Task 2 (Implement the compact view-model contract and make the tests pass)
- **Issue:** The plan's required `pnpm --filter gnome-extension test -- test/view-model.test.js` command passed a literal `--` to the package script, so Vitest ran the wider suite and picked up an unrelated existing `polling-service` failure.
- **Fix:** Added `apps/gnome-extension/scripts/run-vitest.mjs` and updated the package script to strip the separator before invoking Vitest with the requested file target.
- **Files modified:** `apps/gnome-extension/package.json`, `apps/gnome-extension/scripts/run-vitest.mjs`
- **Verification:** `npx --yes pnpm@10.17.1 --filter gnome-extension test -- test/view-model.test.js`
- **Committed in:** `17ffde8`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The deviation was required to make the plan's exact verification command meaningful. No feature scope changed.

## Issues Encountered

- `pnpm` was not installed in the local environment. Installed workspace dependencies with `npx --yes pnpm@10.17.1 install --frozen-lockfile` so the GNOME extension tests could run.
- `roadmap update-plan-progress` checked off `07-02-PLAN.md` but left the aggregate Phase 7 progress row at `1/3`; corrected the stale row manually so `ROADMAP.md` matches the on-disk summaries.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The indicator and provider-row data contract is ready for Phase 7 rendering work in `07-03-PLAN.md`.
- Provider rows now expose compact scan-path fields and keep verbose diagnostics in details-only fields, reducing the amount of menu text Phase 7 UI code needs to interpret.

## Self-Check

PASSED

- Found summary file on disk.
- Verified task commits `352ab0e` and `17ffde8` in git history.

---
*Phase: 07-redesign-gnome-extension-ui-for-glanceability-qbar-provider-icons-and-compact-progress-bars*
*Completed: 2026-03-26*

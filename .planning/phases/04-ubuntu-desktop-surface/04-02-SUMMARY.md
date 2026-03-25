---
phase: 04-ubuntu-desktop-surface
plan: "02"
subsystem: integration
tags: [gnome, gjs, subprocess, polling, backend, tests]
requires:
  - phase: 04-01
    provides: GNOME extension scaffold, lifecycle boundaries, pure state seam
provides:
  - Deterministic backend command resolution with installed and dev fallback modes
  - Gio subprocess-backed backend client with structured error propagation
  - Single-flight polling and refresh orchestration over extension state
affects: [gnome-extension, backend-bridge, refresh-flow]
tech-stack:
  added: [Gio.SubprocessLauncher, tsx, strict JSON parsing, relative-time formatting]
  patterns: [argv-first subprocess execution, single-flight refresh guard, generation-based stale-result protection]
key-files:
  created:
    - apps/gnome-extension/utils/backend-command.js
    - apps/gnome-extension/services/backend-client.js
    - apps/gnome-extension/test/backend-client.test.js
    - apps/gnome-extension/services/polling-service.js
    - apps/gnome-extension/utils/time.js
    - apps/gnome-extension/test/polling-service.test.js
  modified:
    - apps/gnome-extension/state/extension-state.js
    - apps/gnome-extension/extension.js
    - apps/gnome-extension/utils/json.js
key-decisions:
  - "Prefer an installed `agent-bar` binary from PATH first, then fall back to `node --import tsx apps/backend/src/cli.ts` for workspace development."
  - "Normalize backend failures into a dedicated extension error type so state can surface them cleanly."
  - "Treat refreshes as single-flight operations so manual refresh and polling do not overlap."
patterns-established:
  - "Backend invocation is argv-based and deterministic."
  - "Polling uses one in-flight promise and ignores stale results after stop."
requirements-completed: [UI-01, UI-03]
duration: 17min
completed: 2026-03-25
---

# Phase 4 Plan 02 Summary

**Backend bridge and refresh polling with structured error handling and overlap-safe refresh orchestration.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-03-25T16:27:00Z
- **Completed:** 2026-03-25T16:44:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Resolved the backend command path with an installed-binary preference and a dev-time `tsx` fallback.
- Added a subprocess-backed backend client that captures stdout/stderr and converts failures into structured errors.
- Implemented polling and manual refresh flow on top of the shared state seam, including loading and error transitions.

## Task Commits

- Not recorded as separate git commits in this session; the plan landed as a validated working-tree snapshot.

## Files Created/Modified
- `apps/gnome-extension/utils/backend-command.js` - Backend argv resolution and fallback selection.
- `apps/gnome-extension/services/backend-client.js` - Gio subprocess client and strict snapshot parsing.
- `apps/gnome-extension/test/backend-client.test.js` - Backend invocation, parsing, and error propagation coverage.
- `apps/gnome-extension/services/polling-service.js` - Start/stop/refresh orchestration with single-flight guard.
- `apps/gnome-extension/utils/time.js` - Display-safe relative/absolute timestamp formatting.
- `apps/gnome-extension/test/polling-service.test.js` - Polling lifecycle and error-state coverage.

## Decisions Made
- Keep the bridge layer deterministic and argv-driven instead of shell-string based.
- Surface backend failures in extension state rather than letting them disappear as silent subprocess failures.
- Preserve the previous snapshot during refresh failures so the UI can still show context.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The workspace fallback path initially double-prefixed `apps/backend`; it was corrected to resolve from the repo root.
- `refreshNow()` initially returned distinct promises on repeated calls; it was adjusted so the in-flight promise is shared and backend work starts synchronously.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The extension can now talk to the backend reliably, so the remaining work can focus on making the top-bar surface readable and useful.

---
*Phase: 04-ubuntu-desktop-surface*
*Completed: 2026-03-25*

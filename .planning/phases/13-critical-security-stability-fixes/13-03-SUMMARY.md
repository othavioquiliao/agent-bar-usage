---
phase: 13-critical-security-stability-fixes
plan: 03
subsystem: gnome-extension
tags: [gnome-shell, gjs, clutter, gio, glib, memory-leak, timeout, subprocess]

# Dependency graph
requires:
  - phase: 12-interactive-tui-terminal-ux
    provides: GNOME extension indicator and backend-client infrastructure
provides:
  - Memory-safe Clutter actor lifecycle in indicator _render()
  - 15-second timeout for backend-client subprocess via GLib + Gio.Cancellable
affects: [gnome-extension, indicator, backend-client]

# Tech tracking
tech-stack:
  added: [GLib timeout_add_seconds, Gio.Cancellable]
  patterns: [Clutter actor destroy-on-remove, GJS subprocess timeout via Cancellable+force_exit]

key-files:
  created: []
  modified:
    - apps/gnome-extension/panel/indicator.js
    - apps/gnome-extension/services/backend-client.js

key-decisions:
  - "GIcon cache preserved across re-renders (D-10) - only cleared on final destroy()"
  - "force_exit() kills subprocess on timeout, not just async cancellation (Pitfall 3)"
  - "finally block ensures timeout and cancellable cleanup in all code paths"

patterns-established:
  - "Clutter actor lifecycle: always call child.destroy() after remove_child() in GJS"
  - "GJS subprocess timeout: Gio.Cancellable + GLib.timeout_add_seconds + force_exit() pattern"

requirements-completed: [STAB-01, STAB-04]

# Metrics
duration: 1min
completed: 2026-04-05
---

# Phase 13 Plan 03: GNOME Extension Stability Fixes Summary

**Clutter actor memory leak fix via destroy() on re-render, plus 15s subprocess timeout via GLib.timeout_add_seconds + Gio.Cancellable + force_exit()**

## Performance

- **Duration:** 1 min
- **Started:** 2026-04-05T19:59:48Z
- **Completed:** 2026-04-05T20:01:08Z
- **Tasks:** 2/3 (Task 3 is human-verify checkpoint)
- **Files modified:** 2

## Accomplishments
- Fixed Clutter actor memory leak: every actor removed from _box in _render() is now properly destroyed via child.destroy(), preventing unbounded actor count growth in GNOME Shell
- Added 15-second timeout to backend-client subprocess: uses GLib.timeout_add_seconds + Gio.Cancellable + subprocess.force_exit() to prevent indefinite hangs when backend is unresponsive
- GIcon cache preserved across re-renders for efficiency (only cleared on final destroy)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix Clutter actor memory leak in indicator _render()** - `6a572c6` (fix)
2. **Task 2: Add 15s timeout to backend-client subprocess via GLib + Cancellable** - `bf2778e` (fix)
3. **Task 3: Verify GNOME extension changes on Ubuntu** - checkpoint:human-verify (pending)

## Files Created/Modified
- `apps/gnome-extension/panel/indicator.js` - Added child.destroy() after remove_child() in _render() loop to fix Clutter actor memory leak
- `apps/gnome-extension/services/backend-client.js` - Added GLib import, BACKEND_TIMEOUT_SECONDS constant, and full timeout mechanism with Gio.Cancellable + force_exit()

## Decisions Made
- GIcon cache (_providerIcons Map) is NOT cleared on re-render - GIcons are lightweight and reusable, only cleared in final destroy() (D-10)
- Menu rebuild path left unchanged - PopupMenu.removeAll() already calls destroy() internally (D-11)
- force_exit() connected to Cancellable signal ensures subprocess is actually killed, not just the async operation cancelled (addresses Pitfall 3 from RESEARCH.md)
- finally block ensures GLib.Source.remove(timeoutId) and cancellable.disconnect(cancelId) run in all code paths (success, timeout, error)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- GNOME extension changes ready for human verification on Ubuntu 24.04 desktop
- Task 3 checkpoint requires real GNOME Shell session to validate actor lifecycle and timeout behavior
- After human verification, STAB-01 and STAB-04 are fully resolved

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 13-critical-security-stability-fixes*
*Completed: 2026-04-05*

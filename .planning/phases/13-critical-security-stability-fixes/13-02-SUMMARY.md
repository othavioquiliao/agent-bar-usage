---
phase: 13-critical-security-stability-fixes
plan: 02
subsystem: backend
tags: [process-lifecycle, error-handling, timeout, graceful-shutdown, systemd]

requires:
  - phase: 13-01
    provides: atomicWriteFileSync utility integrated in service-server.ts and snapshot-cache.ts

provides:
  - Global uncaughtException and unhandledRejection handlers on service process
  - Graceful shutdown with socket cleanup and snapshot flush
  - Per-provider 15s timeout via Promise.race in backend coordinator
  - Codex appserver timeout aligned to 15s

affects: [systemd-hardening, provider-reliability, service-lifecycle]

tech-stack:
  added: []
  patterns: [Promise.race for per-provider timeout, process signal handlers for graceful shutdown]

key-files:
  created:
    - apps/backend/test/coordinator-timeout.test.ts
  modified:
    - apps/backend/src/commands/service-command.ts
    - apps/backend/src/service/service-server.ts
    - apps/backend/src/core/backend-coordinator.ts
    - apps/backend/src/providers/codex/codex-appserver-fetcher.ts

key-decisions:
  - "Fatal error handlers use sync console.error + process.exit(1) only — no async I/O in crash handlers"
  - "Socket unlink and snapshot flush are best-effort with try/catch on shutdown"
  - "PROVIDER_TIMEOUT_MS = 15_000 matches Codex appserver REQUEST_TIMEOUT_MS for consistency"

patterns-established:
  - "Process lifecycle: register uncaughtException/unhandledRejection before runtime.start()"
  - "Graceful shutdown order: clearTimer -> stop server -> flush state -> cleanup socket"
  - "Provider timeout: Promise.race wrapping adapter.getQuota() producing error snapshot on timeout"

requirements-completed: [STAB-03, STAB-05, STAB-06]

duration: 3min
completed: 2026-04-05
---

# Phase 13 Plan 02: Global Error Handlers, Graceful Shutdown & Provider Timeout Summary

**Global error handlers (uncaughtException/unhandledRejection), graceful shutdown with socket cleanup and snapshot flush, and per-provider 15s Promise.race timeout in backend coordinator**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-05T20:08:58Z
- **Completed:** 2026-04-05T20:11:58Z
- **Tasks:** 2
- **Files modified:** 4 (+ 1 created)

## Accomplishments

- Service process registers `uncaughtException` and `unhandledRejection` handlers that log to stderr and exit(1) — service never dies silently
- Graceful shutdown on SIGTERM/SIGINT: clears refresh timer, stops server, flushes last snapshot to disk, deletes socket file
- Backend coordinator wraps each provider's `getQuota()` call in a 15s `Promise.race` timeout — hanging providers produce error snapshots without blocking others
- Codex appserver subprocess timeout aligned from 10s to 15s for consistency

## Task Commits

Each task was committed atomically:

1. **Task 1: Add global error handlers, graceful shutdown, and socket cleanup** - `328a336` (feat)
2. **Task 2: Add per-provider timeout in coordinator and align Codex timeout** - `3c8fd56` (feat)

## Files Created/Modified

- `apps/backend/src/commands/service-command.ts` - Global error handlers + shutdown signal registration
- `apps/backend/src/service/service-server.ts` - Expanded stop() with socket cleanup and snapshot flush
- `apps/backend/src/core/backend-coordinator.ts` - Per-provider 15s timeout via Promise.race
- `apps/backend/src/providers/codex/codex-appserver-fetcher.ts` - REQUEST_TIMEOUT_MS aligned to 15_000
- `apps/backend/test/coordinator-timeout.test.ts` - 3 vitest tests for timeout behavior

## Decisions Made

- Fatal error handlers use sync `console.error` + `process.exit(1)` only — no async I/O in crash handlers (per RESEARCH.md Pitfall 4)
- Socket unlink and snapshot flush are best-effort with try/catch on shutdown — shutdown must always complete
- `PROVIDER_TIMEOUT_MS` set to 15_000 to match Codex appserver `REQUEST_TIMEOUT_MS` for consistency across the timeout chain
- Used `vi.useFakeTimers()` in coordinator timeout tests to avoid real 15s waits

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Worktree did not have `node_modules` installed or `shared-contract` built — resolved by running `pnpm install` and `bun run build:shared` before running tests

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Service lifecycle is now production-grade: never dies silently, cleans up on shutdown, and enforces provider timeouts
- Ready for systemd hardening (Phase 14) which depends on these process lifecycle guarantees
- All 147 vitest tests + 2 bun:test service runtime tests pass

---
*Phase: 13-critical-security-stability-fixes*
*Completed: 2026-04-05*

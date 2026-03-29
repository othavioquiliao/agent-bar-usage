---
phase: 08-bun-runtime-migration
plan: 03
subsystem: infra
tags: [bun, unix-socket, ipc, bun-listen, bun-connect]

# Dependency graph
requires:
  - phase: 08-01
    provides: Bun runtime setup, @types/bun, tsconfig for Bun
provides:
  - Unix socket server using Bun.listen({ unix }) instead of net.createServer
  - Unix socket client using Bun.connect({ unix }) instead of net.createConnection
  - Service IPC layer fully Bun-native (zero node:net imports)
affects: [service-daemon, cli-commands, systemd]

# Tech tracking
tech-stack:
  added: []
  patterns: [Bun.listen for Unix socket servers, Bun.connect for Unix socket clients, bun:test for Bun-native test files]

key-files:
  modified:
    - apps/backend/src/service/service-server.ts
    - apps/backend/src/service/service-client.ts
    - apps/backend/test/service-runtime.test.ts
    - apps/backend/vitest.config.ts

key-decisions:
  - "Migrated service-runtime.test.ts from vitest to bun:test since Bun.listen/connect require the Bun runtime"
  - "Removed server property from AgentBarServiceRuntime interface (net.Server type no longer applicable)"

patterns-established:
  - "Bun socket server pattern: Bun.listen<TData>({ unix, socket: { open, data, close, error } })"
  - "Bun socket client pattern: Bun.connect<void>({ unix, socket: { open, data, close, error, connectError } })"
  - "Tests using Bun-native APIs run with bun:test and are excluded from vitest config"

requirements-completed: [RUNTIME-03]

# Metrics
duration: 9min
completed: 2026-03-28
---

# Phase 08 Plan 03: Unix Socket IPC Migration Summary

**Service daemon and client IPC layer migrated from Node.js net module to Bun.listen/Bun.connect with same newline-delimited JSON protocol**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-28T22:24:09Z
- **Completed:** 2026-03-28T22:33:18Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- service-server.ts uses Bun.listen<{ buffer: string }>({ unix }) for the socket server, replacing net.createServer
- service-client.ts uses Bun.connect<void>({ unix }) for socket connections, replacing net.createConnection
- Integration test passes under bun test with the new Bun-native socket APIs
- Zero node:net imports remain in the service layer
- All exported function signatures and types preserved (same public API)

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate service-server.ts to Bun.listen({ unix })** - `03904ab` (feat)
2. **Task 2: Migrate service-client.ts to Bun.connect({ unix }) and fix test** - `b4db173` (feat)

## Files Created/Modified
- `apps/backend/src/service/service-server.ts` - Unix socket server using Bun.listen, removed net.Server dependency
- `apps/backend/src/service/service-client.ts` - Unix socket client using Bun.connect, added connectError handler
- `apps/backend/test/service-runtime.test.ts` - Migrated from vitest to bun:test (Bun runtime required)
- `apps/backend/vitest.config.ts` - Excluded service-runtime.test.ts (runs with bun test instead)

## Decisions Made
- **Migrated service-runtime.test.ts to bun:test:** vitest runs tests under Node.js worker threads, where the Bun global is undefined. Since service-server.ts and service-client.ts now use Bun.listen/Bun.connect, the integration test must run under the Bun runtime. Migrated the single test file to bun:test and excluded it from vitest config. All other tests remain on vitest.
- **Removed `server` property from AgentBarServiceRuntime interface:** The property was typed as `net.Server` which no longer applies. No external code accessed `runtime.server` (verified via grep). Consumers only use `start()`, `stop()`, `status()`, and `socketPath`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migrated test from vitest to bun:test**
- **Found during:** Task 2 (service-client migration and test)
- **Issue:** vitest runs tests under Node.js where `Bun` global is undefined. The test failed with "Bun is not defined" since the code under test now uses Bun.listen/Bun.connect.
- **Fix:** Changed test imports from `vitest` to `bun:test`, excluded the test from vitest config, run with `bun test` instead
- **Files modified:** apps/backend/test/service-runtime.test.ts, apps/backend/vitest.config.ts
- **Verification:** `bun test test/service-runtime.test.ts` passes (1 pass, 0 fail)
- **Committed in:** b4db173 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Test infrastructure change was necessary since Bun-native APIs require the Bun runtime. No scope creep.

## Issues Encountered
None beyond the test migration documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Service IPC layer is fully Bun-native
- socket-path.ts unchanged (uses node:os, node:path which Bun supports natively)
- All exported types and function signatures preserved -- downstream consumers (service-command.ts) require no changes
- The service daemon can now run entirely under Bun without any Node.js net module dependency

## Self-Check: PASSED

All created/modified files verified present. All commit hashes verified in git log.

---
*Phase: 08-bun-runtime-migration*
*Completed: 2026-03-28*

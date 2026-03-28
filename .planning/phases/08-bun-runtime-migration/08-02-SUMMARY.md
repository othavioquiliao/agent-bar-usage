---
phase: 08-bun-runtime-migration
plan: 02
subsystem: infra
tags: [bun, subprocess, pty, bun-spawn, bun-terminal, node-pty-removal]

# Dependency graph
requires:
  - phase: 08-bun-runtime-migration (plan 01)
    provides: Bun runtime, tsconfig, workspace config, @types/bun
provides:
  - Bun.spawn-based non-PTY subprocess wrapper (subprocess.ts)
  - Bun.spawn with terminal option for PTY allocation (interactive-command.ts)
  - Bun.spawn-based Codex app-server JSON-RPC communication (codex-appserver-fetcher.ts)
  - Zero child_process.spawn or node-pty imports in plan-scoped files
affects: [providers, service-daemon, cli, prerequisite-checks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bun.spawn([cmd, ...args], { stdin, stdout, stderr }) for non-PTY subprocess"
    - "Bun.spawn([cmd, ...args], { terminal: { cols, rows, data } }) for PTY allocation"
    - "ReadableStream reader for async stdout chunk processing"
    - "proc.stdin.flush() after every stdin write (Bun FileSink buffers)"
    - "await proc.exited for process exit (replaces EventEmitter on-close)"

key-files:
  created: []
  modified:
    - apps/backend/src/utils/subprocess.ts
    - apps/backend/src/providers/shared/interactive-command.ts
    - apps/backend/src/providers/codex/codex-appserver-fetcher.ts

key-decisions:
  - "Kept accessSync from node:fs for isExecutable -- Bun fully supports node:fs and avoids spawning subprocess just for file permission check"
  - "Kept PtyUnavailableError as deprecated export -- provider fetchers and tests reference it for error-handling branches"
  - "Preserved timeout behavior with SubprocessError throw -- original code threw on timeout, plan suggestion silently returned"

patterns-established:
  - "Bun.spawn with ReadableStream reader pattern for streaming stdout (codex-appserver-fetcher)"
  - "data.toString() in Bun terminal callback to avoid garbled Buffer concatenation (Pitfall 3)"
  - "proc.stdin.flush() after every write to Bun process stdin (Pitfall 4)"

requirements-completed: [RUNTIME-02]

# Metrics
duration: 8min
completed: 2026-03-28
---

# Phase 08 Plan 02: Subprocess Migration Summary

**All subprocess APIs (child_process.spawn, node-pty) replaced with Bun.spawn across subprocess.ts, interactive-command.ts, and codex-appserver-fetcher.ts**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-28T22:25:04Z
- **Completed:** 2026-03-28T22:33:07Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- subprocess.ts uses Bun.spawn for non-PTY subprocess execution with full timeout and error handling
- interactive-command.ts uses Bun.spawn with terminal option replacing node-pty for PTY allocation
- codex-appserver-fetcher.ts uses Bun.spawn with piped stdin/stdout for JSON-RPC communication
- Zero child_process.spawn or node-pty imports remain in the three plan-scoped files
- All exported function signatures preserved (SubprocessResult, runSubprocess, runInteractiveCommand, etc.)

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate subprocess.ts and interactive-command.ts to Bun.spawn** - `40317ec` (feat)
2. **Task 2: Migrate codex-appserver-fetcher.ts to Bun.spawn** - `b4a9cec` (feat)

## Files Created/Modified
- `apps/backend/src/utils/subprocess.ts` - Non-PTY subprocess wrapper using Bun.spawn
- `apps/backend/src/providers/shared/interactive-command.ts` - PTY wrapper using Bun.spawn terminal option
- `apps/backend/src/providers/codex/codex-appserver-fetcher.ts` - Codex app-server fetcher using Bun.spawn with piped I/O

## Decisions Made
- Kept `accessSync` from `node:fs` for the `isExecutable` helper -- Bun fully supports node:fs and spawning a subprocess just to check file permissions would be unnecessarily heavy
- Kept `PtyUnavailableError` as a deprecated export -- `codex-cli-fetcher.ts`, `claude-cli-fetcher.ts`, and multiple tests reference it for error-handling branches; removing it would break untouched files
- Preserved timeout behavior with `SubprocessError` throw -- the original code threw on timeout in both `runSubprocess` and `runInteractiveCommand`; the plan's suggested Bun code silently ate timeouts, so the original semantics were preserved

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved timeout error semantics in runSubprocess**
- **Found during:** Task 1 (subprocess.ts migration)
- **Issue:** Plan's suggested Bun.spawn code did not throw on timeout -- original code threw SubprocessError
- **Fix:** Added `timedOut` flag and throw SubprocessError when timeout fires, matching original behavior
- **Files modified:** apps/backend/src/utils/subprocess.ts
- **Verification:** TypeScript compiles, behavior matches original contract
- **Committed in:** 40317ec (Task 1 commit)

**2. [Rule 1 - Bug] Preserved timeout error semantics in runInteractiveCommand**
- **Found during:** Task 1 (interactive-command.ts migration)
- **Issue:** Plan's suggested code silently returned on timeout; original code rejected the promise with SubprocessError
- **Fix:** Added `settled` flag and throw SubprocessError when timeout fires
- **Files modified:** apps/backend/src/providers/shared/interactive-command.ts
- **Verification:** TypeScript compiles, behavior matches original contract
- **Committed in:** 40317ec (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bug fixes)
**Impact on plan:** Both fixes preserve existing error-handling contracts. No scope creep.

## Issues Encountered
- `prerequisite-checks.test.ts` fails because `src/core/prerequisite-checks.ts:177` still dynamically imports `node-pty` for its prerequisite check. This is out of scope (the test was passing before only because node-pty was importable). Logged to `deferred-items.md`.

## Known Stubs
None -- all implementations are fully wired.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Subprocess layer is fully Bun-native, ready for plan 03 (service daemon IPC migration)
- The one remaining `child_process` reference is in `auth-command.ts` (uses `exec`, not `spawn`) -- separate concern
- Deferred: `prerequisite-checks.ts` node-pty import needs cleanup (logged in deferred-items.md)

---
*Phase: 08-bun-runtime-migration*
*Completed: 2026-03-28*

## Self-Check: PASSED
- All 4 files verified present
- Both task commits (40317ec, b4a9cec) verified in git log

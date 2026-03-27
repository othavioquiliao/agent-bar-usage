---
phase: 06-provider-reliability
plan: "01"
subsystem: providers
tags: [node-pty, pty, interactive-command, codex, claude, systemd]

# Dependency graph
requires:
  - phase: 03-first-wave-providers
    provides: codex-cli-fetcher and claude-cli-fetcher using script -qec wrapper
provides:
  - node-pty PTY infrastructure replacing script -qec for subprocess spawning
  - PtyUnavailableError with clear install instructions for graceful degradation
  - runInteractiveCommand using pty.spawn() that works from systemd services
  - codex_pty_unavailable and claude_pty_unavailable error codes in provider snapshots
affects:
  - 06-02
  - any provider that spawns interactive CLIs

# Tech tracking
tech-stack:
  added: [node-pty ^1.0.0]
  patterns:
    - Dynamic import of native addon with graceful PtyUnavailableError fallback
    - 200ms input delay to let CLI render its prompt before writing input
    - Settled guard pattern to prevent double-resolve from timeout + onExit race
    - PTY merges stdout+stderr; stderr field always empty string

key-files:
  created: []
  modified:
    - apps/backend/package.json
    - pnpm-workspace.yaml
    - pnpm-lock.yaml
    - apps/backend/src/providers/shared/interactive-command.ts
    - apps/backend/src/providers/codex/codex-cli-fetcher.ts
    - apps/backend/src/providers/claude/claude-cli-fetcher.ts
    - apps/backend/test/codex-provider.test.ts
    - apps/backend/test/claude-provider.test.ts

key-decisions:
  - "Use node-pty instead of script -qec: node-pty calls forkpty() directly, creating a real PTY that works from systemd with no controlling terminal"
  - "Dynamic import of node-pty: catches native addon compilation failures and surfaces PtyUnavailableError with clear build instructions"
  - "200ms input delay: interactive CLIs (codex, claude) need time to render their prompt before accepting keyboard input"
  - "PTY output is combined stdout+stderr: stderr field is always empty string; callers use stdout only"
  - "PtyUnavailableError is non-retryable: user must install build-essential and rebuild; retrying will always fail"

patterns-established:
  - "PTY spawning: use pty.spawn(command, args, {cols:120, rows:30}) for any interactive CLI"
  - "Graceful degradation: dynamic import of native addons, catch import errors, throw domain-specific error"
  - "Provider error isolation: every new error path gets its own error code (codex_pty_unavailable, claude_pty_unavailable)"

requirements-completed: []

# Metrics
duration: 10min
completed: 2026-03-25
---

# Phase 06 Plan 01: node-pty PTY Infrastructure Summary

**Replaced broken `script -qec` wrapper with `node-pty` so Codex and Claude providers spawn real kernel PTYs that work from systemd services with no controlling terminal**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-25T22:31:09Z
- **Completed:** 2026-03-25T22:33:53Z
- **Tasks:** 4 implementation + 1 test fix
- **Files modified:** 8

## Accomplishments

- node-pty 1.1.0 installed and compiled via node-gyp on Linux x64 (no prebuilds needed)
- `interactive-command.ts` rewritten to use `pty.spawn()` with settled guard, 200ms input delay, and graceful `PtyUnavailableError` on import failure
- `codex-cli-fetcher.ts` refactored: removed `runCodexInteractive`/`buildScriptCommand`/`shellQuote`, now calls `runInteractiveCommand` directly with PTY-based input
- `claude-cli-fetcher.ts` updated with `PtyUnavailableError` catch returning `claude_pty_unavailable` error
- All 44 backend tests passing after updating codex test mocks to mock `runInteractiveCommand` instead of `context.runSubprocess`

## Task Commits

Each task was committed atomically:

1. **Step 1.1: Add node-pty dependency** - `7f74ca0` (chore)
2. **Step 1.2: Rewrite interactive-command.ts** - `a91472c` (feat)
3. **Step 1.3: Refactor codex-cli-fetcher** - `65a07bb` (feat)
4. **Step 1.4: Add PtyUnavailableError to claude-cli-fetcher** - `9cef661` (feat)
5. **Test fix: Update provider tests** - `040a511` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/backend/package.json` - Added node-pty ^1.0.0 dependency
- `pnpm-workspace.yaml` - Added node-pty to onlyBuiltDependencies for native compilation
- `pnpm-lock.yaml` - Updated lockfile after pnpm install
- `apps/backend/src/providers/shared/interactive-command.ts` - Rewritten to use node-pty; added PtyUnavailableError
- `apps/backend/src/providers/codex/codex-cli-fetcher.ts` - Uses runInteractiveCommand; removed script helpers; added PtyUnavailableError catch
- `apps/backend/src/providers/claude/claude-cli-fetcher.ts` - Added PtyUnavailableError import and catch branch
- `apps/backend/test/codex-provider.test.ts` - Switched to mock runInteractiveCommand; added PtyUnavailableError test
- `apps/backend/test/claude-provider.test.ts` - Added PtyUnavailableError test case

## Decisions Made

- Used node-pty instead of alternatives (expect, socat, direct API): it is the only approach that creates a real kernel PTY device via `forkpty()`, making `isatty(0)` return true inside the spawned process regardless of whether the caller has a controlling terminal
- Used dynamic import (`await import("node-pty")`) so compilation failures are caught at runtime with a meaningful error message pointing users to `sudo apt install build-essential python3 && pnpm install`
- 200ms input delay is hardcoded (not configurable per the plan) — this is adequate for both Codex and Claude CLIs
- PTY stderr is always empty string (PTY merges stdout+stderr into a single stream) — callers that previously concatenated `stdout + stderr` now only use `stdout`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated codex-provider.test.ts to mock runInteractiveCommand**
- **Found during:** Verification after Task 3
- **Issue:** Old codex tests mocked `context.runSubprocess` which is no longer called — the refactored fetcher now calls module-level `runInteractiveCommand` directly. Tests would fail or try to spawn a real PTY.
- **Fix:** Added `vi.mock("../src/providers/shared/interactive-command.js")` to mock `runInteractiveCommand`, removed `runSubprocess` from `createContext`, updated `createRunResult` command label from "script" to "codex"
- **Files modified:** `apps/backend/test/codex-provider.test.ts`
- **Verification:** All 44 tests pass
- **Committed in:** `040a511`

**2. [Rule 2 - Missing Critical] Added PtyUnavailableError test to both provider test files**
- **Found during:** Task 5 (test fix)
- **Issue:** New error code paths `codex_pty_unavailable` and `claude_pty_unavailable` had no test coverage
- **Fix:** Added one test per provider asserting the error code and non-retryable status when PtyUnavailableError is thrown
- **Files modified:** `apps/backend/test/codex-provider.test.ts`, `apps/backend/test/claude-provider.test.ts`
- **Verification:** New tests pass (5 codex tests, 4 claude tests)
- **Committed in:** `040a511`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical test coverage)
**Impact on plan:** Both auto-fixes necessary for test correctness and error path coverage. No scope creep.

## Issues Encountered

- node-pty 1.1.0 was resolved (semver-compatible with ^1.0.0) and compiled successfully without any missing system dependencies on this machine.

## User Setup Required

None — no external service configuration required. If `node-pty` fails to compile on another machine (missing `build-essential`), the backend will surface a clear `PtyUnavailableError` with instructions.

## Next Phase Readiness

- PTY infrastructure is ready for Etapa 2: auth command and doctor check
- Both Codex and Claude providers now correctly propagate `PtyUnavailableError` as structured non-retryable errors
- All 44 backend tests pass with the new PTY-based implementation

---
*Phase: 06-provider-reliability*
*Completed: 2026-03-25*

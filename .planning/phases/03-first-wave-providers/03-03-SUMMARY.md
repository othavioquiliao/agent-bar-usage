---
phase: 03-first-wave-providers
plan: "03"
subsystem: claude
tags: [linux, claude, cli, isolation, tests, coordinator]
requires:
  - phase: 03-02
    provides: Codex provider and shared runtime wiring
provides:
  - Claude CLI parse/fetch path and normalized snapshot mapping
  - Provider-level isolation hardening for availability and fetch failures
  - Deterministic Claude and isolation tests
affects: [backend, provider-runtime, diagnostics]
tech-stack:
  added: [none]
  patterns: [shared interactive command helper, provider-level failure isolation, secret-safe snapshots]
key-files:
  created:
    - apps/backend/src/providers/claude/claude-cli-parser.ts
    - apps/backend/src/providers/claude/claude-cli-fetcher.ts
    - apps/backend/src/providers/claude/claude-cli-adapter.ts
    - apps/backend/src/providers/shared/interactive-command.ts
    - apps/backend/test/claude-provider.test.ts
    - apps/backend/test/provider-isolation.test.ts
  modified:
    - apps/backend/src/core/backend-coordinator.ts
requirements-completed: [CLD-01]
duration: 17min
completed: 2026-03-25
---

# Phase 03 Plan 03 Summary

**Claude provider flow implemented and runtime isolation hardened so one provider failure does not collapse the full envelope.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-03-25T15:38:00Z
- **Completed:** 2026-03-25T15:53:28Z
- **Files modified:** 7

## Accomplishments

- Added a shared interactive-command helper for CLI-backed providers that need PTY/script execution.
- Implemented Claude CLI parsing and fetch mapping for session and weekly usage output.
- Registered Claude in the shared provider registry factory and runtime flow.
- Hardened `BackendCoordinator` so availability and fetch exceptions degrade to provider-level snapshots.
- Added deterministic tests for Claude behavior and mixed-success provider isolation.
- Verified that serialized snapshots do not leak secret values.

## Task Commits

1. **Grouped phase commit:** `44ceaeb` (`feat(03-03): add claude provider and isolation hardening`)
2. **Supporting test commit:** `bd0fc08` (`test(03): stabilize contract and parity fixtures`)

## Files Created/Modified

- `apps/backend/src/providers/claude/claude-cli-parser.ts` - Claude usage parser and reset-window normalization.
- `apps/backend/src/providers/claude/claude-cli-fetcher.ts` - CLI execution and structured failure mapping.
- `apps/backend/src/providers/claude/claude-cli-adapter.ts` - provider adapter implementation.
- `apps/backend/src/providers/shared/interactive-command.ts` - PTY/script wrapper shared by CLI-backed providers.
- `apps/backend/src/core/backend-coordinator.ts` - availability/fetch error isolation hardening.
- `apps/backend/test/claude-provider.test.ts` - deterministic Claude behavior coverage.
- `apps/backend/test/provider-isolation.test.ts` - mixed success/failure isolation coverage and secret leakage guard.

## Decisions Made

- Claude is CLI-backed for v1 Ubuntu support.
- Provider-level failures should never abort the full snapshot envelope.
- Secret material is injected into runtime context only and must not appear in serialized output.

## Deviations from Plan

- The plan itself was delivered in a single grouped commit, and the contract/parity test stabilization landed in a small supporting commit.

## Issues Encountered

- None.

## User Setup Required

- None for the backend tests and smoke verification.

## Next Phase Readiness

The first-wave provider set is complete; Phase 4 can now focus on the GNOME Shell extension surface.

---
*Phase: 03-first-wave-providers*
*Completed: 2026-03-25*

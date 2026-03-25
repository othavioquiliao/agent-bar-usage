---
phase: 01-backend-contract
plan: "03"
subsystem: testing
tags: [cli, formatter, serializer, diagnostics, tests]
requires:
  - phase: 01-01
    provides: backend CLI scaffold and shared contract
  - phase: 01-02
    provides: coordinator and cache runtime
provides:
  - JSON/text output over the same normalized model
  - Diagnostics gating through serializer options
  - Contract, parity, and snapshot-mapping tests
affects: [backend, gnome-extension, diagnostics]
tech-stack:
  added: [none]
  patterns: [serializer-based diagnostics gating, formatter-over-contract-model]
key-files:
  created:
    - apps/backend/src/serializers/snapshot-serializer.ts
    - apps/backend/src/formatters/text-formatter.ts
    - apps/backend/test/output-parity.test.ts
    - apps/backend/test/snapshot-mapping.test.ts
  modified:
    - apps/backend/src/cli.ts
    - apps/backend/test/contract.test.ts
    - packages/shared-contract/src/request.ts
    - packages/shared-contract/src/snapshot.ts
key-decisions:
  - "Diagnostics are omitted by default and only included through explicit flags."
  - "Text output is generated from the same normalized envelope used by JSON output."
patterns-established:
  - "Serializer controls payload shaping for machine consumers."
  - "Text formatter consumes normalized snapshots only."
requirements-completed: [BACK-01, BACK-03]
duration: 31min
completed: 2026-03-25
---

# Phase 01 Plan 03 Summary

**CLI output finalized with JSON/text parity and opt-in diagnostics over the normalized backend contract.**

## Performance

- **Duration:** 31 min
- **Started:** 2026-03-25T15:07:00Z
- **Completed:** 2026-03-25T15:38:00Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments
- Wired `runUsageCommand` to the runtime coordinator and serializer.
- Added text formatter with source/status/updated/error fields and optional diagnostics block.
- Added parity and mapping tests to cover contract behavior and structured error mapping.

## Task Commits

1. **Task 1: Wire coordinator and JSON behavior** - `bcddef3` (feat)
2. **Task 2: Implement text formatter** - `bcddef3` (feat)
3. **Task 3: Add parity and mapping tests** - `bcddef3` (feat)

## Files Created/Modified
- `apps/backend/src/serializers/snapshot-serializer.ts` - controls diagnostics inclusion for JSON payloads.
- `apps/backend/src/formatters/text-formatter.ts` - human-readable rendering from normalized snapshots.
- `apps/backend/test/output-parity.test.ts` - checks text/JSON parity and diagnostics gating.
- `apps/backend/test/snapshot-mapping.test.ts` - validates source/updated/error normalization paths.

## Decisions Made
- Serializer is the contract guardrail for optional diagnostics behavior.
- CLI exports a reusable command function (`runUsageCommand`) to support testability.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Initial pnpm install failed under sandbox DNS restrictions, resolved by running install outside sandbox; final backend suite passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 01 backend contract is ready for phase-level verification and transition to config/secrets work.

---
*Phase: 01-backend-contract*
*Completed: 2026-03-25*

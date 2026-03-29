---
phase: 10-cli-overhaul
plan: 01
subsystem: contracts
tags: [inline-guards, shared-contract, config-validation, zod-removal, bun]

# Dependency graph
requires:
  - phase: 09-lifecycle-commands
    provides: "Existing CLI/service/config surface to preserve while removing Zod"
provides:
  - "Inline runtime assertions for request, snapshot, and diagnostics payloads"
  - "Backend config validation without Zod while preserving ConfigLoadError semantics"
  - "Service/client/config callers updated to use assertion helpers instead of schema.parse"
affects: [10-02, 10-03, 11-provider-independence-data]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Literal-array enums plus assertX/isX helpers instead of schema objects"
    - "Strict object validation with explicit unknown-field rejection"
    - "Config parsing that preserves existing error codes without ZodError branches"

key-files:
  created: []
  modified:
    - packages/shared-contract/src/request.ts
    - packages/shared-contract/src/snapshot.ts
    - packages/shared-contract/src/diagnostics.ts
    - apps/backend/src/config/config-schema.ts
    - apps/backend/src/config/config-loader.ts
    - apps/backend/src/config/backend-request.ts
    - apps/backend/src/core/backend-coordinator.ts
    - apps/backend/src/serializers/snapshot-serializer.ts
    - apps/backend/src/service/service-client.ts
    - apps/backend/src/commands/diagnostics-command.ts
    - apps/backend/src/lifecycle/paths.ts
    - apps/backend/src/core/prerequisite-checks.ts

key-decisions:
  - "Shared contract now exports assertions/guards instead of runtime schema objects"
  - "ConfigLoadError codes remain stable after Zod removal to avoid user-facing regression"
  - "REPO_ROOT resolution in lifecycle/paths.ts uses fileURLToPath(new URL(...)) to avoid import.meta.dir crashes under Bun"
  - "Prerequisite checks report Bun-native terminal support directly instead of probing node-pty"

requirements-completed: [CLI-02]

# Metrics
duration: 1 session
completed: 2026-03-29
---

# Phase 10 Plan 01: Inline Validation Summary

**Zod was removed from shared-contract and backend config/runtime validation without changing the externally observable validation semantics.**

## Accomplishments

- Replaced request, snapshot, and diagnostics schemas with inline guards and assertion helpers in `shared-contract`
- Migrated backend config loading, request parsing, snapshot serialization, diagnostics, and service client validation to the new assertion surface
- Preserved duplicate-provider detection and `ConfigLoadError` codes/messages while removing `ZodError` handling
- Fixed two regressions uncovered during verification: `import.meta.dir` usage in `lifecycle/paths.ts` and stale node-pty probing in prerequisite checks

## Verification

- `cd apps/backend && bun run vitest run test/config-loader.test.ts test/contract.test.ts test/output-parity.test.ts test/prerequisite-checks.test.ts`
- `cd apps/backend && bun test test/service-runtime.test.ts`
- `cd apps/backend && bun run typecheck`

## Deviations From Plan

- `lifecycle/paths.ts` needed a Bun-safe repo-root resolution fix even though it originated in Phase 9; the failure surfaced while exercising Phase 10 test paths
- `prerequisite-checks.ts` was updated to match the Bun PTY reality from Phase 8 so diagnostics no longer reported a false failure

## Next Phase Readiness

- All runtime payload validation now lives in repo-owned helpers, which unblocks the manual CLI rewrite and later provider/data refactors without a schema-library dependency

---
*Phase: 10-cli-overhaul*
*Completed: 2026-03-29*

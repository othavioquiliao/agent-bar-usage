---
phase: 11-provider-independence-data
plan: 02
subsystem: data
tags: [file-cache, xdg-cache, dedup, service-refresh, startup-hydration]

# Dependency graph
requires:
  - phase: 11-provider-independence-data/01
    provides: "Stable provider metadata and cache keys for persistent snapshot storage"
provides:
  - "File-backed provider snapshot cache under XDG cache directories"
  - "In-flight deduplication for concurrent fetches of the same provider/source key"
  - "Service runtime startup hydration and backend-owned periodic refresh"
affects: [11-03, 12-terminal-ui-code-quality]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Snapshot cache keys are derived from adapter `cacheKey` plus source mode"
    - "Cache entries persist JSON payload + TTL metadata on disk and repopulate the in-memory map on read"
    - "Service refresh work is serialized behind one guarded refresh path and reused by warmup, interval ticks, and manual refresh requests"

key-files:
  created:
    - apps/backend/src/cache/cache-path.ts
    - apps/backend/test/file-snapshot-cache.test.ts
  modified:
    - apps/backend/src/cache/snapshot-cache.ts
    - apps/backend/src/core/usage-snapshot.ts
    - apps/backend/src/core/backend-coordinator.ts
    - apps/backend/src/service/service-server.ts
    - apps/backend/test/cache-refresh.test.ts
    - apps/backend/test/service-runtime.test.ts

key-decisions:
  - "Persistent cache stores provider snapshots keyed by `cacheKey__sourceMode` so CLI and service reuse the same primitives"
  - "The service persists the latest aggregate snapshot separately from per-provider cache entries so restart hydration can answer immediately"
  - "Unit tests that instantiate the default cache now use temporary cache directories to avoid cross-test leakage from the new persistent behavior"

requirements-completed: [DATA-01, DATA-02]

# Metrics
duration: 1 session
completed: 2026-03-29
---

# Phase 11 Plan 02: Persistent Cache & Service Refresh Summary

**The backend now owns restart-safe cached provider data and periodic refresh behavior instead of treating snapshots as process-local state.**

## Accomplishments

- Reworked `SnapshotCache` to persist TTL-scoped provider snapshots under `XDG_CACHE_HOME/agent-bar`
- Added in-flight fetch deduplication so concurrent misses for the same provider/source key collapse behind one fetch promise
- Threaded the persistent cache through `BackendCoordinator` and `createUsageSnapshot()` so CLI and service calls share behavior
- Taught the service runtime to hydrate its last aggregate snapshot from disk on startup and refresh on a background interval
- Added file-cache persistence tests and a service-runtime regression test that proves cached startup hydration works before the first refresh completes

## Verification

- `cd apps/backend && bun run vitest run test/cache-refresh.test.ts test/file-snapshot-cache.test.ts`
- `cd apps/backend && bun test test/service-runtime.test.ts`
- `cd apps/backend && bun run typecheck`

## Deviations From Plan

- Because the cache is now persistent by default, backend unit tests that construct raw coordinators needed explicit temporary cache directories to keep suites isolated and deterministic

## Next Phase Readiness

- With persistent cache, startup hydration, and background refresh in place, Plan 03 could focus on the remaining user-visible integration: locale-aware formatting and dynamic GNOME indicator rendering

---
*Phase: 11-provider-independence-data*
*Completed: 2026-03-29*

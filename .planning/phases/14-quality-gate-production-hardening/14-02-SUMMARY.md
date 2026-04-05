---
phase: 14-quality-gate-production-hardening
plan: 02
subsystem: infra
tags: [systemd, cgroup-v2, resource-limits, cache-versioning, snapshot-cache]

# Dependency graph
requires:
  - phase: 13-critical-security-stability-fixes
    provides: atomicWriteFileSync utility used by snapshot cache set()
provides:
  - Hardened systemd user service with resource limits, restart policy, timeouts
  - Schema-versioned snapshot cache with graceful reset on format mismatch
affects: [packaging, deployment, cache-format]

# Tech tracking
tech-stack:
  added: []
  patterns: [systemd-two-tier-memory-defense, cache-schema-versioning]

key-files:
  created:
    - apps/backend/test/snapshot-cache.test.ts
  modified:
    - packaging/systemd/user/agent-bar.service
    - apps/backend/src/cache/snapshot-cache.ts

key-decisions:
  - "StartLimitBurst/StartLimitIntervalSec placed in [Unit] per systemd 230+ spec (silently ignored in [Service])"
  - "CACHE_SCHEMA_VERSION independent from shared-contract snapshotSchemaVersion -- different evolution timelines"
  - "No cache migration logic needed -- 30s TTL means a cache miss costs one extra sub-second API poll"

patterns-established:
  - "systemd hardening: two-tier memory defense (MemoryHigh soft throttle + MemoryMax hard OOM kill)"
  - "Cache schema versioning: fail-fast version check before data assertion, null return on mismatch"

requirements-completed: [HARD-01, HARD-04]

# Metrics
duration: 3min
completed: 2026-04-05
---

# Phase 14 Plan 02: systemd Hardening + Cache Schema Versioning Summary

**Hardened systemd user service with two-tier memory defense, task limits, restart policy and timeouts; added CACHE_SCHEMA_VERSION=1 with fail-fast version check returning null on mismatch**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-05T21:27:39Z
- **Completed:** 2026-04-05T21:31:05Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- systemd service hardened with MemoryHigh=256M/MemoryMax=512M two-tier defense, TasksMax=50, StartLimitBurst=5 in [Unit], Nice=10, timeouts, and journal logging
- Snapshot cache entries now carry cacheSchemaVersion field; get() fails-fast on mismatch returning null for graceful reset
- 4 new tests covering version match, version mismatch, old format (no version), and expired TTL behavior
- All 151 existing tests pass with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Harden systemd user service** - `b5e214d` (feat)
2. **Task 2: Add schema versioning to snapshot cache**
   - RED: `4c7a9bc` (test) - failing tests for version mismatch and old format
   - GREEN: `82876e1` (feat) - CACHE_SCHEMA_VERSION constant, interface field, get() check, set() inclusion

**Plan metadata:** (pending final docs commit)

## Files Created/Modified
- `packaging/systemd/user/agent-bar.service` - Hardened systemd user service with resource limits, restart policy, timeouts, scheduling priority, and journal logging
- `apps/backend/src/cache/snapshot-cache.ts` - Added CACHE_SCHEMA_VERSION=1 constant, cacheSchemaVersion field in SnapshotCacheEntry, fail-fast version check in get(), version inclusion in set() and memory cache
- `apps/backend/test/snapshot-cache.test.ts` - 4 tests for schema versioning: current version loads, mismatched version returns null, old format returns null, expired TTL returns null

## Decisions Made
- StartLimitBurst and StartLimitIntervalSec placed in [Unit] section per systemd 230+ specification -- placing them in [Service] causes silent ignore (verified by research document citing Ubuntu Noble man pages)
- CACHE_SCHEMA_VERSION kept as separate constant from shared-contract's snapshotSchemaVersion because cache wrapping format and API snapshot schema evolve independently (D-20)
- No cache migration logic implemented -- cache TTL is 30 seconds, auto-repopulates on next poll; version mismatch costs one extra sub-second API poll (D-22)
- Skipped Documentation= directive in systemd service file -- the repo URL will change, creating maintenance burden for zero practical benefit in a user service context

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- shared-contract workspace package needed `bun run build` before vitest could resolve the import -- standard workspace setup step, resolved in seconds

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- systemd service hardening complete, ready for deployment testing on Ubuntu 24.04
- Cache schema versioning in place, future cache format changes only need incrementing CACHE_SCHEMA_VERSION
- Phase 14 Plan 03 (CSS theme awareness / Object.freeze config) can proceed independently

## Self-Check: PASSED

- All 3 created/modified files exist on disk
- All 3 commits (b5e214d, 4c7a9bc, 82876e1) found in git history
- 151/151 tests pass (30 test files)

---
*Phase: 14-quality-gate-production-hardening*
*Completed: 2026-04-05*

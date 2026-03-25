---
phase: 03-first-wave-providers
plan: "01"
subsystem: copilot
tags: [linux, copilot, api, token, auth, tests]
requires:
  - phase: 02-03
    provides: runtime context, config, and secret resolution
provides:
  - Copilot API/token path and normalized snapshot mapping
  - Registry-factory wiring for Copilot
  - Deterministic Copilot provider tests
affects: [backend, provider-runtime, diagnostics]
tech-stack:
  added: [none]
  patterns: [env-first token resolution, provider registry factory, structured provider errors]
key-files:
  created:
    - apps/backend/src/providers/copilot/copilot-token-resolver.ts
    - apps/backend/src/providers/copilot/copilot-usage-fetcher.ts
    - apps/backend/src/providers/copilot/copilot-adapter.ts
    - apps/backend/test/copilot-provider.test.ts
  modified:
    - apps/backend/src/cli.ts
    - apps/backend/src/core/provider-registry-factory.ts
requirements-completed: [COP-01]
duration: 13min
completed: 2026-03-25
---

# Phase 03 Plan 01 Summary

**Copilot provider flow implemented with Linux-friendly token resolution, GitHub API mapping, and deterministic tests.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-25T15:14:00Z
- **Completed:** 2026-03-25T15:27:00Z
- **Files modified:** 6

## Accomplishments

- Added an env-first Copilot token resolver with secret-store fallback.
- Implemented Copilot usage fetch mapping against `https://api.github.com/copilot_internal/user`.
- Normalized Copilot API payloads into the shared quota snapshot contract.
- Centralized provider wiring through `provider-registry-factory`.
- Added deterministic tests for missing-token, auth-error, and success mapping behavior.

## Task Commits

1. **Grouped phase commit:** `f4cf02f` (`feat(03-01): add copilot provider flow`)

## Files Created/Modified

- `apps/backend/src/providers/copilot/copilot-token-resolver.ts` - env-first token resolution with secret fallback.
- `apps/backend/src/providers/copilot/copilot-usage-fetcher.ts` - GitHub Copilot API fetcher and snapshot mapping.
- `apps/backend/src/providers/copilot/copilot-adapter.ts` - provider adapter implementation.
- `apps/backend/src/core/provider-registry-factory.ts` - central registry wiring for runtime adapters.
- `apps/backend/src/cli.ts` - registry factory integration for the CLI usage path.
- `apps/backend/test/copilot-provider.test.ts` - deterministic provider behavior coverage.

## Decisions Made

- Copilot on Ubuntu is treated as an API/token flow, not browser-cookie parity.
- Structured provider errors are preferred over process-level crashes for missing or rejected tokens.
- Registry construction is centralized so provider wiring stays consistent across CLI and tests.

## Deviations from Plan

- The three task steps were executed as one grouped commit rather than one commit per task. Behavior and verification still matched the plan.

## Issues Encountered

- None.

## User Setup Required

- None for the backend tests and smoke verification.

## Next Phase Readiness

Plan 03-02 can build the Codex CLI path on the same backend/runtime contract.

---
*Phase: 03-first-wave-providers*
*Completed: 2026-03-25*

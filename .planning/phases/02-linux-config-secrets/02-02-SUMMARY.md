---
phase: 02-linux-config-secrets
plan: "02"
subsystem: secrets
tags: [linux, secrets, libsecret, secret-tool, env-fallback, tests]
requires:
  - phase: 02-01
    provides: validated config schema and secret reference fields
provides:
  - Secret reference model with typed store variants
  - Secret store abstraction and resolver with structured errors
  - `secret-tool` and env-backed store implementations
affects: [backend, provider-runtime]
tech-stack:
  added: [none]
  patterns: [secret resolver abstraction, structured secret errors]
key-files:
  created:
    - apps/backend/src/secrets/secret-reference.ts
    - apps/backend/src/secrets/secret-store.ts
    - apps/backend/src/secrets/secret-tool-store.ts
    - apps/backend/src/secrets/env-secret-store.ts
    - apps/backend/test/secret-store.test.ts
  modified:
    - apps/backend/src/utils/subprocess.ts
key-decisions:
  - "`secret-tool` is treated as the primary persistent store boundary on Linux."
  - "Env fallback remains explicit via `EnvSecretStore` and is not silently used for secret-tool references."
  - "All secret resolution failures use structured error codes."
patterns-established:
  - "Provider-facing runtime code resolves secrets via `SecretResolver` rather than direct shell/env access."
  - "Secret resolution tests use injected subprocess/path functions and avoid live keyring dependencies."
requirements-completed: [SECR-01]
duration: 31min
completed: 2026-03-25
---

# Phase 02 Plan 02 Summary

**Secret management abstraction implemented with `secret-tool` primary path, env fallback, and deterministic error handling.**

## Performance

- **Duration:** 31 min
- **Started:** 2026-03-25T12:34:00Z
- **Completed:** 2026-03-25T13:05:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added typed secret references for `secret-tool` and `env` stores.
- Added `SecretStore` interface and `SecretResolver` orchestration boundary.
- Implemented `SecretToolStore` using the shared subprocess utility and PATH resolution.
- Implemented `EnvSecretStore` with injected env support and `process.env` fallback.
- Added deterministic tests for:
  - env success/missing-secret behavior
  - secret-tool command formation
  - missing binary handling
  - structured missing-secret error mapping from subprocess exit code

## Task Commits

1. **Task 1: Secret reference model and resolver interface** - `7a83efd` (feat)
2. **Task 2: secret-tool and env stores** - `b44ae0a` (feat)
3. **Task 3: Secret-store tests** - `dfbfd7e` (test)

## Files Created/Modified

- `apps/backend/src/secrets/secret-reference.ts` - typed secret reference model and conversion guards.
- `apps/backend/src/secrets/secret-store.ts` - store interface, resolver, and structured error model.
- `apps/backend/src/secrets/secret-tool-store.ts` - libsecret-compatible CLI integration via `secret-tool`.
- `apps/backend/src/secrets/env-secret-store.ts` - explicit env fallback store.
- `apps/backend/src/utils/subprocess.ts` - subprocess error description helper.
- `apps/backend/test/secret-store.test.ts` - deterministic secret handling coverage.

## Decisions Made

- Secret stores are runtime services, not provider adapter concerns.
- `secret-tool` lookup uses fixed attributes (`service`, `account`) for predictable references.
- Unsupported stores and missing secrets are represented with stable error codes.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - tests run with injected stubs and do not require a real desktop keyring.

## Next Phase Readiness

Plan 02-03 can now integrate config ordering/source preferences and resolved secret material into provider execution contexts.

---
*Phase: 02-linux-config-secrets*
*Completed: 2026-03-25*

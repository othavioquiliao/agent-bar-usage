---
phase: 02-linux-config-secrets
plan: "01"
subsystem: config
tags: [linux, xdg, json, config, cli, validation]
requires:
  - phase: 01-03
    provides: backend CLI boundary and normalized output model
provides:
  - XDG-aware config path and JSON schema
  - Config loader with defaults and validation errors
  - `config validate` and `config dump` CLI commands with sanitized output
affects: [backend, provider-runtime, diagnostics]
tech-stack:
  added: [zod]
  patterns: [xdg config path resolution, sanitized config introspection]
key-files:
  created:
    - apps/backend/src/config/config-schema.ts
    - apps/backend/src/config/config-path.ts
    - apps/backend/src/config/default-config.ts
    - apps/backend/src/config/config-loader.ts
    - apps/backend/src/commands/config-command.ts
    - apps/backend/test/config-loader.test.ts
  modified:
    - apps/backend/src/cli.ts
    - apps/backend/package.json
    - pnpm-lock.yaml
key-decisions:
  - "Config path resolves to `${XDG_CONFIG_HOME:-~/.config}/agent-bar/config.json`."
  - "Provider configuration uses ordered entries (`id`, `enabled`, `sourceMode`) to preserve user-defined order."
  - "CLI config dump emits sanitized metadata only and never raw secret values."
patterns-established:
  - "Config loading and validation centralized in `config-loader`."
  - "Read-only config commands reuse the same loader used by runtime execution."
requirements-completed: [CONF-01, CONF-02]
duration: 44min
completed: 2026-03-25
---

# Phase 02 Plan 01 Summary

**Linux config model implemented with XDG persistence, schema validation, and inspectable CLI commands.**

## Performance

- **Duration:** 44 min
- **Started:** 2026-03-25T11:50:00Z
- **Completed:** 2026-03-25T12:34:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added a validated JSON config schema that persists provider order, enablement, and `sourceMode`.
- Implemented XDG-based config path resolution and default config behavior when no file exists.
- Added backend config CLI commands:
  - `agent-bar config validate`
  - `agent-bar config dump`
- Added deterministic tests for path policy, fallback defaults, parse errors, and schema validation.

## Task Commits

1. **Task 1: Config schema and XDG path policy** - `38f6b49` (feat)
2. **Task 2: Config loader and CLI commands** - `dd69757` (feat)
3. **Task 3: Config loader tests** - `d15e5f8` (test)
4. **Post-task fix: zod version alignment** - `c2ea056` (fix)

## Files Created/Modified

- `apps/backend/src/config/config-schema.ts` - config schema plus sanitized dump mapping.
- `apps/backend/src/config/config-path.ts` - XDG/Linux config path resolution.
- `apps/backend/src/config/config-loader.ts` - config file load, parse, validation, and defaults.
- `apps/backend/src/commands/config-command.ts` - `validate` and `dump` command handlers.
- `apps/backend/src/cli.ts` - command registration for `config`.
- `apps/backend/test/config-loader.test.ts` - path and loader behavior tests.

## Decisions Made

- Preserve provider ordering as array order in config rather than map/object order.
- Treat missing config file as a first-class scenario with explicit defaults.
- Keep config output safe by exposing only redacted/sanitized secret metadata.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Mixed `zod` major versions caused runtime schema failures**
- **Found during:** Task 3 verification (`pnpm --filter backend test -- config-loader`)
- **Issue:** Backend loaded `zod` v4 while `shared-contract` exports schemas built with `zod` v3, causing runtime errors (`Invalid element at key "id"`).
- **Fix:** Align backend `zod` dependency with `shared-contract` version.
- **Files modified:** `apps/backend/package.json`, `pnpm-lock.yaml`
- **Verification:** `pnpm --filter backend test -- config-loader` passes after alignment.
- **Committed in:** `c2ea056`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope change; unblocked schema validation and command runtime.

## Issues Encountered

- Zod major-version mismatch between backend and shared contract was caught by tests and fixed.

## User Setup Required

None - no manual setup required for config validation/dump using defaults.

## Next Phase Readiness

Plan 02-02 can now build the Linux secret-store abstraction and hook into config secret references.

---
*Phase: 02-linux-config-secrets*
*Completed: 2026-03-25*

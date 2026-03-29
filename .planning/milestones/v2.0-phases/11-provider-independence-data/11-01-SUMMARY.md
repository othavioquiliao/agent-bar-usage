---
phase: 11-provider-independence-data
plan: 01
subsystem: providers
tags: [provider-modules, registry-metadata, providers-command, config-order]

# Dependency graph
requires:
  - phase: 10-cli-overhaul
    provides: "Manual CLI dispatch and inline validation baseline used by the new providers command"
provides:
  - "Explicit provider metadata (`id`, `name`, `cacheKey`) on the shared provider contract"
  - "Registry wiring through `apps/backend/src/providers/index.ts` instead of ad hoc imports in callers"
  - "`agent-bar providers` as the single config-backed visibility/order surface for GNOME topbar selection"
affects: [11-02, 11-03, 12-terminal-ui-code-quality]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Provider modules expose metadata plus `isAvailable()` and `getQuota()`"
    - "Provider order/visibility is persisted by reordering `config.providers[]` and toggling `enabled`"
    - "CLI command modules stay directly callable for tests and manual dispatch"

key-files:
  created:
    - apps/backend/src/providers/provider-module.ts
    - apps/backend/src/providers/provider-registry.ts
    - apps/backend/src/providers/index.ts
    - apps/backend/src/commands/providers-command.ts
    - apps/backend/test/providers-command.test.ts
    - apps/backend/test/provider-registry.test.ts
  modified:
    - apps/backend/src/core/provider-adapter.ts
    - apps/backend/src/core/provider-registry-factory.ts
    - apps/backend/src/core/backend-coordinator.ts
    - apps/backend/src/providers/claude/claude-cli-adapter.ts
    - apps/backend/src/providers/codex/codex-cli-adapter.ts
    - apps/backend/src/providers/copilot/copilot-adapter.ts
    - apps/backend/src/config/config-loader.ts
    - apps/backend/src/cli.ts
    - apps/backend/test/cli.test.ts

key-decisions:
  - "Provider metadata lives on the runtime adapter contract (`name`, `cacheKey`) instead of a second provider descriptor type"
  - "The built-in provider list is centralized in `apps/backend/src/providers/index.ts` so adding/removing providers does not require cross-provider edits"
  - "`agent-bar providers` preserves existing `sourceMode` and `secretRef` values while only changing order and `enabled` flags"

requirements-completed: [PROV-01, PROV-02, PROV-03]

# Metrics
duration: 1 session
completed: 2026-03-29
---

# Phase 11 Plan 01: Provider Modules & Selection Summary

**Phase 11 started by collapsing provider wiring to an explicit minimal contract and exposing provider order/visibility through a config-backed CLI flow.**

## Accomplishments

- Extended the provider contract to carry `name`, `cacheKey`, and `getQuota()` alongside `isAvailable()`
- Added `apps/backend/src/providers/index.ts` as the built-in provider registry entrypoint and removed direct caller dependence on concrete provider imports
- Implemented `agent-bar providers` with interactive multiselect/order handling via `@clack/prompts`
- Persisted provider order and visibility by rewriting `config.providers[]` instead of inventing a second preferences store
- Added regression coverage for provider registry metadata, the new CLI command, and top-level CLI dispatch/help wiring

## Verification

- `cd apps/backend && bun run vitest run test/providers-command.test.ts test/provider-registry.test.ts test/cli.test.ts`
- `cd apps/backend && bun run typecheck`

## Deviations From Plan

- The existing concrete provider adapters (`claude-cli-adapter.ts`, `codex-cli-adapter.ts`, `copilot-adapter.ts`) were updated in place instead of introducing extra `*-provider.ts` wrappers because the adapters already matched the phase boundary once metadata was added

## Next Phase Readiness

- Provider cache keys and config-backed order are now stable inputs for the persistent cache/service work in Plan 02 and the GNOME rendering changes in Plan 03

---
*Phase: 11-provider-independence-data*
*Completed: 2026-03-29*

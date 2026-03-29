---
phase: 10-cli-overhaul
plan: 03
subsystem: quality
tags: [biome, formatting, dependency-cleanup, lockfiles, lint]

# Dependency graph
requires:
  - phase: 10-cli-overhaul/01
    provides: "No-Zod runtime validation in shared-contract/backend"
  - phase: 10-cli-overhaul/02
    provides: "No-Commander CLI/command surface"
provides:
  - "Biome repo configuration and scripts"
  - "Workspace manifests/lockfiles aligned with Commander/Zod removal"
  - "Repo-wide formatting and lint baseline for backend, shared-contract, and GNOME extension files"
affects: [11-provider-independence-data, 12-terminal-ui-code-quality]

# Tech tracking
tech-stack:
  added:
    - "@biomejs/biome ^2.4.9"
  patterns:
    - "Biome as single formatter/linter entrypoint"
    - "Workspace-level dependency cleanup synchronized across bun and pnpm lockfiles"
    - "Local lint suppression only for regex-rule conflict with ANSI escape detection"

key-files:
  created:
    - biome.json
  modified:
    - package.json
    - apps/backend/package.json
    - packages/shared-contract/package.json
    - bun.lock
    - pnpm-lock.yaml

key-decisions:
  - "Biome is the authoritative formatting/linting tool for the tracked repo sources"
  - "Unused manifest dependencies must be removed from the owning package, not only from the backend"
  - "The ANSI-strip regex keeps a narrowly scoped Biome ignore because `useRegexLiterals` conflicts with `noControlCharactersInRegex` on this pattern"

requirements-completed: [QUAL-01]

# Metrics
duration: 1 session
completed: 2026-03-29
---

# Phase 10 Plan 03: Biome & Dependency Cleanup Summary

**Biome is now the active quality baseline, and the workspace manifests/lockfiles fully reflect the Commander and Zod removal.**

## Accomplishments

- Added root Biome configuration and repo scripts for `biome check`, `biome fix`, `format`, and `lint`
- Auto-formatted and lint-fixed the tracked codebase, then manually resolved the remaining lint issues
- Removed `commander` and `zod` from active workspace manifests, including the previously missed `packages/shared-contract/package.json`
- Refreshed both `bun.lock` and `pnpm-lock.yaml` so the dependency graph matches the codebase
- Verified the full backend Vitest suite, Bun-only tests, typecheck, and `bun x biome check .`

## Verification

- `bun x biome check .`
- `cd apps/backend && bun run vitest run`
- `cd apps/backend && bun test test/settings.test.ts test/service-runtime.test.ts`
- `cd apps/backend && bun run typecheck`
- `rg -n 'commander|zod' --glob 'package.json' apps/backend packages/shared-contract`
- `rg -n 'commander|zod' bun.lock pnpm-lock.yaml`

## Deviations From Plan

- `packages/shared-contract/package.json` still declared `zod` after the code migration; Phase 10 closed that manifest-level inconsistency and regenerated the workspace lockfiles

## Next Phase Readiness

- Phase 11 starts from a clean lint baseline and a dependency graph that no longer carries the libraries intentionally removed by the v2.0 roadmap

---
*Phase: 10-cli-overhaul*
*Completed: 2026-03-29*

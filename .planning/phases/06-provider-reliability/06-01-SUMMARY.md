---
phase: 06-provider-reliability
plan: "01"
subsystem: infra
tags: [node-pty, codex, claude, cli, systemd]
requires:
  - phase: v1.0
    provides: backend provider adapters, systemd service runtime, and CLI-backed Codex/Claude fetchers
provides:
  - shared PTY-backed interactive command execution for service-mode CLI providers
  - Codex CLI fetching routed through the shared PTY runner with structured PTY failure handling
  - Claude CLI PTY-unavailable error mapping and regression coverage for both CLI providers
affects: [06-02-PLAN.md, apps/backend/src/providers/shared/interactive-command.ts, apps/backend/src/providers/codex/codex-cli-fetcher.ts, apps/backend/src/providers/claude/claude-cli-fetcher.ts]
tech-stack:
  added: [node-pty]
  patterns: [shared PTY runner for CLI providers, structured PTY-unavailable provider errors, provider-level runner contract assertions]
key-files:
  created: []
  modified: [apps/backend/package.json, pnpm-workspace.yaml, pnpm-lock.yaml, apps/backend/src/providers/shared/interactive-command.ts, apps/backend/src/providers/codex/codex-cli-fetcher.ts, apps/backend/src/providers/claude/claude-cli-fetcher.ts, apps/backend/test/codex-provider.test.ts, apps/backend/test/claude-provider.test.ts]
key-decisions:
  - "Use node-pty as the single PTY execution path for service-mode Codex and Claude fetchers."
  - "Keep the shared PTY runner aligned with SubprocessError semantics so existing provider error mapping continues to work."
patterns-established:
  - "CLI-backed providers should share one PTY execution helper instead of embedding per-provider shell wrappers."
  - "Provider fetcher tests assert the interactive runner call contract and PTY-unavailable error mapping explicitly."
requirements-completed: []
duration: 6 min
completed: 2026-03-26
---

# Phase 06 Plan 01: node-pty PTY Infrastructure Summary

**Shared node-pty execution for Codex and Claude CLI fetchers with structured PTY failure mapping and regression coverage**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-26T16:48:30Z
- **Completed:** 2026-03-26T16:54:06Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Replaced the shared `script -qec` wrapper with a `node-pty` runner that works from the installed systemd service path and keeps timeout/nonzero-exit behavior structured.
- Removed the Codex-specific shell-wrapper path so Codex now uses the same PTY runner as Claude and reports a dedicated `codex_pty_unavailable` error when the addon is missing.
- Added Claude-side `claude_pty_unavailable` mapping plus runner-contract regression tests for both CLI providers.

## Task Commits

Each code task was committed atomically:

1. **Task 1: Add node-pty dependency and rewrite the shared interactive runner** - `62f7b07` (feat)
2. **Task 2: Refactor Codex fetching to use the shared PTY runner** - `9907f89` (feat)
3. **Task 3: Add Claude PTY failure handling and verify the backend suite** - `1761887` (feat)

## Files Created/Modified

- `apps/backend/package.json` - Added the `node-pty` runtime dependency for backend PTY execution.
- `pnpm-workspace.yaml` - Allowed `node-pty` native builds through the workspace install policy.
- `pnpm-lock.yaml` - Recorded the resolved `node-pty` and `node-addon-api` dependency graph.
- `apps/backend/src/providers/shared/interactive-command.ts` - Replaced the `script` wrapper with dynamic `node-pty` loading, PTY execution, timeout handling, and `PtyUnavailableError`.
- `apps/backend/src/providers/codex/codex-cli-fetcher.ts` - Routed Codex through the shared PTY runner and mapped PTY addon failures to provider-level errors.
- `apps/backend/src/providers/claude/claude-cli-fetcher.ts` - Added provider-level PTY-unavailable handling for Claude fetches.
- `apps/backend/test/codex-provider.test.ts` - Updated Codex mocks for the shared runner and added PTY failure coverage.
- `apps/backend/test/claude-provider.test.ts` - Added Claude PTY failure coverage and asserted the shared runner call contract.

## Decisions Made

- Kept `node-pty` behind a dynamic import so missing native builds fail with an actionable install message instead of a generic module load error.
- Preserved `SubprocessError`-style rejection semantics in the PTY runner so existing provider error parsing still works for nonzero exits and spawn failures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Preserve structured failure semantics in the shared PTY runner**
- **Found during:** Task 1 (Add node-pty dependency and rewrite the shared interactive runner)
- **Issue:** The plan sketch resolved PTY exits unconditionally, which would have broken existing provider error handling that depends on rejected nonzero subprocess exits.
- **Fix:** Rejected nonzero PTY exits with `SubprocessError` and added synchronous spawn-failure handling in the shared runner.
- **Files modified:** `apps/backend/src/providers/shared/interactive-command.ts`
- **Verification:** `npx pnpm --filter backend build`, `npx pnpm test:backend`
- **Committed in:** `62f7b07`

**2. [Rule 3 - Blocking] Use `npx pnpm` because the execution shell lacked `pnpm` and `corepack`**
- **Found during:** Task 1 (Add node-pty dependency and rewrite the shared interactive runner)
- **Issue:** The plan verification commands assumed `pnpm` was directly available on `PATH`, but this shell only exposed `npm`/`npx`.
- **Fix:** Ran install, build, and test commands through `npx pnpm` without changing repository files.
- **Files modified:** None
- **Verification:** `npx pnpm install`, `npx pnpm test:backend`, `npx pnpm build:backend`
- **Committed in:** Not applicable (execution-environment workaround only)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both deviations were necessary to keep verification truthful and preserve existing provider error behavior. The implementation scope stayed within the planned PTY refactor.

## Issues Encountered

- The initial PTY runner build failed on a TypeScript narrowing issue around delayed input writes; fixed inline before Task 1 was committed.
- Root-level `node -e "import('node-pty')"` could not resolve the backend dependency because `node-pty` is installed in the workspace package, so runtime verification was rerun from `apps/backend/` and against the built backend output instead.
- `agent-bar service snapshot --json` returned an empty provider list in this local environment after the service restart, so live service health was verified but provider fetch output was not observable from that command alone.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase `06-02` can build on one shared PTY execution seam instead of maintaining separate Codex and Claude shell-wrapper logic.
- The installed service now has a PTY-capable execution path plus explicit `*_pty_unavailable` errors, which gives the follow-on doctor/auth work a clearer runtime surface to diagnose.

## Self-Check

PASSED

- Found summary file on disk.
- Verified task commits `62f7b07`, `9907f89`, and `1761887` in git history.

---
phase: 12-terminal-ui-code-quality
plan: 01
subsystem: terminal-menu
tags: [tui, clack, menu, auth-login]

# Dependency graph
requires:
  - phase: 11-provider-independence-data
    provides: "Provider ordering/config and shared snapshot/auth infrastructure reused by the new TUI entrypoints"
provides:
  - "`agent-bar` no-args interactive menu routing in TTY contexts"
  - "Guided provider login submenu for Copilot, Claude, and Codex"
  - "Shared Copilot auth persistence/success path reused across token and device-flow branches"
affects: [12-02, 12-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TTY-only interactive routing preserves deterministic non-interactive help output"
    - "Menu and login flows are dependency-injected for tests"
    - "Provider-native auth backends are reused instead of reimplemented inside the TUI"

key-files:
  created:
    - apps/backend/src/commands/menu-command.ts
    - apps/backend/src/commands/login-command.ts
    - apps/backend/test/menu-command.test.ts
    - apps/backend/test/login-command.test.ts
  modified:
    - apps/backend/src/cli.ts
    - apps/backend/src/commands/auth-command.ts
    - apps/backend/test/cli.test.ts
    - apps/backend/test/auth-command.test.ts

key-decisions:
  - "Running `agent-bar` with no args enters menu mode only when stdin/stdout are real TTYs"
  - "The TUI shell delegates to existing command modules (`providers`, `doctor`, provider auth) instead of introducing a second command stack"
  - "Claude and Codex login use their native CLIs with inherited stdio, then immediately run the existing auth verification command"

requirements-completed: [TUI-01, TUI-04]

# Metrics
duration: 1 session
completed: 2026-03-29
---

# Phase 12 Plan 01: Interactive Menu & Login Summary

**Phase 12 started by turning the CLI into a real interactive entrypoint instead of a help-only shell.**

## Accomplishments

- Added `agent-bar menu` and TTY-aware no-args routing so `agent-bar` opens a clack-based action menu in interactive terminals
- Implemented the four required menu actions: List All, Configure Providers, Provider Login, and Doctor
- Added a guided provider login submenu for Copilot, Claude, and Codex
- Kept Copilot token/device-flow auth on the existing backend path while removing duplicated success persistence/output logic
- Added regression coverage for menu routing, login branching, and top-level CLI behavior

## Verification

- `cd apps/backend && bun run vitest run test/cli.test.ts test/menu-command.test.ts`
- `cd apps/backend && bun run vitest run test/login-command.test.ts test/auth-command.test.ts`

## Deviations From Plan

- None that changed behavior. The auth cleanup stayed inside `auth-command.ts` instead of extracting another helper module because the duplication was localized and small.

## Next Phase Readiness

- The menu shell now provides a stable place to render the richer quota formatter in Plan 02 and the polished doctor presenter in Plan 03.

---
*Phase: 12-terminal-ui-code-quality*
*Completed: 2026-03-29*

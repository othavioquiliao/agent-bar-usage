---
phase: 06-provider-reliability
plan: 02
subsystem: auth
tags: [github-device-flow, secret-tool, systemd, diagnostics]
requires:
  - phase: 06-provider-reliability
    provides: node-pty-backed service execution for Codex and Claude from 06-01
provides:
  - Copilot device-flow authentication stored in GNOME Keyring
  - install-time systemd environment capture for PATH, tokens, and DBus
  - doctor diagnostics with actionable remediation commands
affects: [install, diagnostics, copilot, service-runtime]
tech-stack:
  added: [GitHub Device Flow, secret-tool write path]
  patterns: [dependency-injected CLI side effects, actionable prerequisite diagnostics]
key-files:
  created:
    - apps/backend/src/auth/github-device-flow.ts
    - apps/backend/src/auth/secret-tool-writer.ts
    - apps/backend/src/auth/config-writer.ts
    - apps/backend/src/commands/auth-command.ts
    - apps/backend/test/auth-command.test.ts
  modified:
    - apps/backend/src/cli.ts
    - scripts/install-ubuntu.sh
    - packages/shared-contract/src/diagnostics.ts
    - apps/backend/src/core/prerequisite-checks.ts
    - apps/backend/test/prerequisite-checks.test.ts
key-decisions:
  - "Copilot auth resolves its GitHub OAuth client id from --client-id or AGENT_BAR_GITHUB_CLIENT_ID so the flow is testable before a production app id is registered."
  - "Doctor treats node-pty and the systemd env drop-in as first-class runtime prerequisites and suggests direct fix commands instead of verification commands."
patterns-established:
  - "CLI auth commands should inject browser, prompt, secret-store, and restart side effects for deterministic tests."
  - "Diagnostics checks should report the actual fix path a user should run next."
requirements-completed: []
duration: 2 min
completed: 2026-03-26
---

# Phase 06 Plan 02: Auth Command + Install Env Capture + Doctor Improvements Summary

**GitHub device-flow Copilot auth, systemd env propagation, and actionable runtime diagnostics for Ubuntu installs**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-26T16:55:17Z
- **Completed:** 2026-03-26T16:57:39Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Added `agent-bar auth copilot` with GitHub Device Flow, GNOME Keyring storage, config auto-write, and best-effort service restart.
- Updated the Ubuntu installer to persist PATH, token, and DBus environment into a systemd user drop-in for the installed service.
- Expanded doctor diagnostics to cover `node-pty`, the systemd env override, and direct fix commands for common failures.

## Task Commits

Each task was committed atomically:

1. **Task 1: Copilot auth flow and CLI wiring** - `d5f414a` (feat)
2. **Task 2: Install-time systemd env capture** - `244210f` (feat)
3. **Task 3: Actionable doctor diagnostics** - `9d90ba0` (fix)

## Files Created/Modified
- `apps/backend/src/auth/github-device-flow.ts` - GitHub Device Flow request and polling helpers.
- `apps/backend/src/auth/secret-tool-writer.ts` - Writes Copilot tokens into GNOME Keyring with `secret-tool`.
- `apps/backend/src/auth/config-writer.ts` - Creates or updates backend config with the Copilot secret reference.
- `apps/backend/src/commands/auth-command.ts` - Implements `agent-bar auth copilot`.
- `scripts/install-ubuntu.sh` - Captures the interactive shell environment into `agent-bar.service.d/env.conf`.
- `packages/shared-contract/src/diagnostics.ts` - Extends the diagnostics contract with `node-pty` and `systemd-env`.
- `apps/backend/src/core/prerequisite-checks.ts` - Adds actionable doctor checks and aligns Copilot env detection with the real resolver.

## Decisions Made
- The Copilot auth command accepts `--client-id` and `AGENT_BAR_GITHUB_CLIENT_ID` so the flow works before a production GitHub OAuth app id is embedded.
- Doctor suggestions now point at the fix command the user should run next, not a separate verification command.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Align doctor Copilot env detection with the real token resolver**
- **Found during:** Task 3 (Actionable doctor diagnostics)
- **Issue:** The doctor check ignored `COPILOT_API_TOKEN`, even though the provider token resolver already supports it.
- **Fix:** Expanded the doctor env-source list and the reported diagnostics details to include `COPILOT_API_TOKEN`.
- **Files modified:** `apps/backend/src/core/prerequisite-checks.ts`, `apps/backend/test/prerequisite-checks.test.ts`
- **Verification:** `pnpm --filter backend test`
- **Committed in:** `9d90ba0`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix kept doctor output consistent with real Copilot runtime behavior and did not expand scope beyond correctness.

## Issues Encountered
- The executor shell did not expose `pnpm` on PATH, so verification used the local pnpm binary path directly.
- A production GitHub OAuth client id is not stored in the repo; live Copilot auth verification currently requires `--client-id` or `AGENT_BAR_GITHUB_CLIENT_ID`.

## User Setup Required

None - the codebase changes do not add repo-side setup, but live Copilot auth testing still needs a GitHub OAuth client id.

## Next Phase Readiness

- Phase 6 code work is complete and the plan is ready for live Ubuntu verification with `pnpm install:ubuntu`, `agent-bar auth copilot --client-id <id>`, and `agent-bar doctor --json`.
- No code blockers remain inside this plan.

## Self-Check: PASSED

---
*Phase: 06-provider-reliability*
*Completed: 2026-03-26*

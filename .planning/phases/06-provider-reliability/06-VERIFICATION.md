---
phase: 06
slug: provider-reliability
status: human_needed
verified_at: 2026-03-26T17:02:16Z
requirements_checked: [OPS-01, OPS-02, OPS-03]
---

# Phase 06 Verification

## Goal Check

Phase goal: make all three providers work reliably for any user with minimal friction, both from the CLI and from the systemd background service.

Result: **HUMAN VERIFICATION REQUIRED**

## Requirement Coverage

1. **OPS-01 / service-mode Codex + Claude PTY path** - code satisfied, live host verification pending
Evidence:
- `apps/backend/src/providers/shared/interactive-command.ts` now uses `node-pty` with structured timeout and nonzero-exit handling.
- `apps/backend/src/providers/codex/codex-cli-fetcher.ts` routes Codex through the shared PTY runner and maps addon failures to `codex_pty_unavailable`.
- `apps/backend/src/providers/claude/claude-cli-fetcher.ts` maps PTY addon failures to `claude_pty_unavailable`.
- `apps/backend/test/codex-provider.test.ts` and `apps/backend/test/claude-provider.test.ts` cover the shared runner contract and PTY-unavailable behavior.

2. **OPS-02 / Copilot auth and token provisioning** - code satisfied, live OAuth verification pending
Evidence:
- `apps/backend/src/auth/github-device-flow.ts` implements GitHub Device Flow request/poll helpers.
- `apps/backend/src/auth/secret-tool-writer.ts` writes Copilot tokens to GNOME Keyring through `secret-tool`.
- `apps/backend/src/auth/config-writer.ts` ensures the Copilot `secretRef` exists in backend config.
- `apps/backend/src/commands/auth-command.ts` exposes `agent-bar auth copilot`.
- `apps/backend/test/auth-command.test.ts` covers happy path, `--client-id`, no-browser flow, and restart/config side effects.

3. **OPS-03 / install-time environment capture and actionable diagnostics** - code satisfied, live install verification pending
Evidence:
- `scripts/install-ubuntu.sh` writes `~/.config/systemd/user/agent-bar.service.d/env.conf` with PATH, token, and DBus variables before restarting the service.
- `packages/shared-contract/src/diagnostics.ts` includes `node-pty` and `systemd-env` as first-class diagnostics checks.
- `apps/backend/src/core/prerequisite-checks.ts` reports actionable fix commands and aligns Copilot env detection with the real token resolver.
- `apps/backend/test/prerequisite-checks.test.ts` verifies the new diagnostics behavior.

## Automated Verification Run

- `npx --yes pnpm@10.17.1 test:backend`
  Result: **PASS** (14 files, 52 tests)
- `npx --yes pnpm@10.17.1 build:backend`
  Result: **PASS**
- Plan `06-01` execution verification
  Result: **PASS** (`npx pnpm test:backend`, `npx pnpm build:backend`, backend PTY smoke checks, live `codex --version` PTY call through the built runner)
- Plan `06-02` execution verification
  Result: **PASS** (`build:backend` passed, backend test suite passed)

## Manual Verification Required

1. Run `pnpm install:ubuntu` on the target Ubuntu GNOME host and confirm `~/.config/systemd/user/agent-bar.service.d/env.conf` is created with the expected PATH / token / DBus environment.
Expected:
The service restarts successfully and the drop-in exists on disk.

2. Run `agent-bar auth copilot --client-id <github-oauth-client-id>` on the target host.
Expected:
The device-flow prompt completes, the token is stored in GNOME Keyring, backend config gains the Copilot `secretRef`, and the service restart succeeds or skips cleanly.

3. Run `agent-bar doctor --json` and a live usage fetch (`agent-bar service snapshot --json` or the GNOME surface refresh) after install/auth.
Expected:
`node-pty` and `systemd-env` checks report healthy state or direct fix commands, and Codex/Claude no longer fail through the legacy `script` wrapper path; remaining provider issues, if any, should be auth/session/data issues instead of the old PTY/systemd failure mode.

## Notes

- The code changes and automated tests support the Phase 6 goal, but the final provider-reliability claim still depends on real-machine verification with actual CLI sessions, secrets, and a GitHub OAuth client id.
- Phase completion should wait for an explicit human approval or a defect list from the Ubuntu host verification.

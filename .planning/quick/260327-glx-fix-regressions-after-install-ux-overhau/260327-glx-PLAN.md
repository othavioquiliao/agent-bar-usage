# Quick Task 260327-glx Plan

## Goal

Fix the regressions introduced after the `install-ux-overhaul` pull without changing unrelated behavior.

## Tasks

### 1. Restore robust Copilot device flow handling

- Files: `apps/backend/src/auth/github-device-flow.ts`, `apps/backend/src/commands/auth-command.ts`
- Action: switch the GitHub device-flow requests back to the documented form-encoded protocol, handle both `expired_token` and `token_expired`, and keep the command UX actionable when polling fails.
- Verify: backend auth tests cover form encoding, expiry aliases, and command-level fallback messaging.
- Done: GitHub Device Flow works against the documented GitHub contract again.

### 2. Honor provider source-mode contracts

- Files: `apps/backend/src/providers/claude/claude-cli-adapter.ts`, `apps/backend/src/providers/codex/codex-cli-adapter.ts`, `apps/backend/src/providers/codex/codex-appserver-fetcher.ts`
- Action: keep explicit `cli` mode on the CLI path, use API/app-server only for the modes that allow it, and preserve CLI fallback when the newer strategy fails.
- Verify: provider tests prove `cli` stays `cli`, `auto` can fallback, and Codex app-server snapshots are classified as CLI-backed.
- Done: adapters no longer silently override the configured source contract.

### 3. Lock the regressions with tests

- Files: `apps/backend/test/auth-command.test.ts`, `apps/backend/test/commands/auth-command.test.ts`, `apps/backend/test/claude-provider.test.ts`, `apps/backend/test/codex-provider.test.ts`, `apps/backend/test/providers/codex/codex-appserver-fetcher.test.ts`
- Action: update assertions and add focused regression coverage for the fixed behaviors.
- Verify: `pnpm --filter backend test` and `pnpm --filter gnome-extension test`.
- Done: the review findings are covered by automated tests.

---
phase: 3
slug: first-wave-providers
status: passed
verified_at: 2026-03-25T15:53:28Z
requirements_checked: [COP-01, CDX-01, CLD-01]
---

# Phase 03 Verification

## Goal Check

Phase goal: ship the first Ubuntu-viable provider set in the Node backend with reliable fetch paths and clear failure behavior.

Result: **PASSED**

## Requirement Coverage

1. **COP-01** - satisfied
Evidence:
- `apps/backend/src/providers/copilot/copilot-token-resolver.ts` resolves tokens from env first and falls back to the secret store.
- `apps/backend/src/providers/copilot/copilot-usage-fetcher.ts` calls the GitHub Copilot internal API and maps quota snapshots into the shared contract.
- `apps/backend/src/providers/copilot/copilot-adapter.ts` exposes the provider through the runtime registry.
- `apps/backend/test/copilot-provider.test.ts` covers missing token, auth failure, and success mapping.

2. **CDX-01** - satisfied
Evidence:
- `apps/backend/src/providers/codex/codex-cli-parser.ts` parses CLI output into normalized usage/reset fields.
- `apps/backend/src/providers/codex/codex-cli-fetcher.ts` resolves the binary, runs the CLI through the shared subprocess boundary, and maps failures to structured snapshots.
- `apps/backend/src/providers/codex/codex-cli-adapter.ts` exposes the provider through the runtime registry.
- `apps/backend/test/codex-provider.test.ts` covers missing CLI, parse failure, update prompts, and success mapping.

3. **CLD-01** - satisfied
Evidence:
- `apps/backend/src/providers/claude/claude-cli-parser.ts` parses session and weekly usage output into normalized fields.
- `apps/backend/src/providers/claude/claude-cli-fetcher.ts` executes the CLI through the shared interactive command helper and maps failures to structured snapshots.
- `apps/backend/src/providers/claude/claude-cli-adapter.ts` exposes the provider through the runtime registry.
- `apps/backend/test/claude-provider.test.ts` covers missing CLI, parse failure, and success mapping.

4. **Provider isolation** - satisfied
Evidence:
- `apps/backend/src/core/backend-coordinator.ts` catches availability and fetch exceptions and converts them into provider-level snapshots.
- `apps/backend/test/provider-isolation.test.ts` proves one failing provider does not collapse the full envelope and that secret values do not leak into serialized snapshots.

## Automated Verification Run

- `pnpm --filter backend test -- copilot-provider`
  Result: **PASS**
- `pnpm --filter backend test -- codex-provider`
  Result: **PASS**
- `pnpm --filter backend test -- claude-provider provider-isolation`
  Result: **PASS**
- `pnpm --filter backend test`
  Result: **PASS** (11 files, 38 tests)
- `pnpm --filter backend exec node --import tsx src/cli.ts usage --provider copilot --json`
  Result: **PASS** (structured `copilot_token_missing` snapshot)
- `pnpm --filter backend exec node --import tsx src/cli.ts usage --provider codex --json`
  Result: **PASS** (structured `codex_cli_failed` snapshot)
- `pnpm --filter backend exec node --import tsx src/cli.ts usage --provider claude --json`
  Result: **PASS** (structured `claude_cli_failed` snapshot)

## Manual Verification Notes

- The CLI smoke runs return contract-valid JSON even when local prerequisites are missing.
- Missing tokens and absent CLIs degrade to provider-level errors instead of process failures.
- The snapshot serializer and text formatter remain consistent with the normalized provider contract.

## Notes

- Phase 3 is ready for Phase 4 planning.


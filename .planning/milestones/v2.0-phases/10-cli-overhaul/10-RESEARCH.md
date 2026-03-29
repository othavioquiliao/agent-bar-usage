# Phase 10: CLI Overhaul - Research

**Researched:** 2026-03-28
**Status:** Ready for planning
**Phase:** 10-cli-overhaul

## User Constraints

- Manual CLI parsing must mirror the omarchy `src/cli.ts` pattern: switch/case parsing, `requireNextArg`, Levenshtein typo suggestions, and box-drawing help output.
- Commander must be removed from the backend package and from runtime imports.
- Zod must be removed in favor of inline type guards, assertion helpers, and normalizers.
- Biome must replace any formatter/linter setup and enforce 120-column single-quote formatting like omarchy.

## Project Constraints (from AGENTS.md)

- Keep `.planning/` current while making substantive repo changes.
- Prefer `rg` for repo search and use non-destructive git workflows.
- Do not revert unrelated user changes.

## Standard Stack

- Runtime: Bun + TypeScript ESM
- Tests: `bun run vitest`
- CLI reference: `/home/othavio/Work/agent-bar-omarchy/src/cli.ts`
- Formatter/linter target: `/home/othavio/Work/agent-bar-omarchy/biome.json`

## Codebase Findings

### CLI Surface

- `apps/backend/src/cli.ts` is still Commander-based and does both registration and usage output.
- Command logic already exists as standalone runners for most commands:
  - `runAuthCopilotCommand`, `runAuthClaudeCommand`, `runAuthCodexCommand`
  - `runDoctorCommand`
  - `runServiceStatusCommand`, `runServiceSnapshotCommand`, `runServiceRefreshCommand`
  - lifecycle runners in `src/lifecycle/*.ts`
- Only `config-command.ts` and `service-command.ts` still hide some runtime behavior behind Commander registration helpers.

### Validation Surface

- Zod is concentrated in:
  - `packages/shared-contract/src/request.ts`
  - `packages/shared-contract/src/snapshot.ts`
  - `packages/shared-contract/src/diagnostics.ts`
  - `apps/backend/src/config/config-schema.ts`
  - `apps/backend/src/config/config-loader.ts`
- Callers depend on `.parse()` today, so the replacement needs assertion helpers that return typed values and throw repo-specific errors.

### Existing Test Coverage

- Config loading already has focused tests in `apps/backend/test/config-loader.test.ts`.
- Snapshot/contract behavior is exercised by:
  - `apps/backend/test/contract.test.ts`
  - `apps/backend/test/output-parity.test.ts`
  - `apps/backend/test/service-runtime.test.ts`
- There is no dedicated CLI parser/help typo-suggestion test yet.

## Architecture Patterns

- Keep command business logic in command modules and make `cli.ts` a thin parser/dispatcher.
- Replace schema objects with:
  - string-literal arrays (`const PROVIDER_IDS = [...] as const`)
  - `isX()` guards for branch logic
  - `assertX()` / `parseX()` helpers for external input validation
  - `normalizeX()` helpers when defaults are required
- Preserve existing error classes instead of introducing generic validation errors.

## Recommended Plan Shape

1. Replace runtime validation primitives first.
   - Shared contract guards
   - Config schema parsing
   - Call-site migration
2. Rewrite command modules and `cli.ts` around direct runner functions.
3. Add Biome and clean dependency/scripts/lockfiles last, after the refactor stabilizes.

## Don't Hand-Roll

- Do not invent a large command framework to replace Commander. A small parser/dispatcher is enough.
- Do not keep “temporary” compatibility wrappers that still import Commander or Zod.
- Do not add a custom formatter/linter abstraction over Biome.

## Common Pitfalls

- Manual parsing must preserve existing command shapes like `agent-bar auth copilot --token ...`.
- Help output must include every command that currently exists, including lifecycle and service subcommands.
- Zod removal must not silently weaken validation for config JSON or service socket snapshots.
- Shared-contract helpers must remain usable from both backend code and tests.

## Code Examples

- Omarchy CLI patterns to mirror:
  - `showHelp()`
  - `requireNextArg()`
  - `levenshtein()` / `suggestCommand()`
  - `parseArgs()`
- Backend files to preserve semantics from:
  - `apps/backend/src/commands/auth-command.ts`
  - `apps/backend/src/commands/service-command.ts`
  - `apps/backend/src/config/config-loader.ts`

## Validation Architecture

- Add dedicated CLI tests for:
  - typo suggestion
  - help rendering
  - nested subcommand dispatch
- Extend config/contract tests to use new assertion helpers instead of Zod schemas.
- Final phase verification should run:
  - `cd apps/backend && bun run vitest run`
  - `bun x biome check`

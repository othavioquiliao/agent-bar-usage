# Phase 12: Terminal UI & Code Quality - Research

**Researched:** 2026-03-29
**Status:** Ready for planning
**Phase:** 12-terminal-ui-code-quality

## User Constraints

- `agent-bar` with no arguments must open an interactive menu with List All, Configure Providers, Provider Login, and Doctor actions.
- Terminal quota display should feel intentional and dense, using Unicode progress bars and the One Dark palette already implied elsewhere in the product.
- Doctor output should use `@clack/prompts` primitives (spinner/log/note/outro) instead of plain ASCII report lines.
- Provider login needs to guide users through Claude, Codex, and Copilot auth without inventing new provider-specific auth backends.
- The GitHub OAuth App client ID must be a real registered credential before the milestone can be considered fully complete.

## Project Constraints

- Preserve JSON output modes and scriptability for machine consumers.
- Reuse existing command modules, config stores, and provider contracts from prior phases.
- Avoid direct repo edits outside the GSD planning flow; phase artifacts must stay current.

## Codebase Findings

### CLI / Menu

- `runCli()` currently treats missing args as help output.
- The parser is already simple to extend with a `menu` route and/or a no-args interactive fallback.
- Existing interactive commands (`setup`, `update`, `providers`) prove `@clack/prompts` works in this Bun environment.

### Doctor

- `runDoctorCommand()` currently returns plain text or JSON.
- The underlying prerequisite checks are already structured enough to drive a clack-based presentation layer.
- Tests already exist for the plain text formatter, so a presenter seam can be added without breaking JSON coverage.

### Auth / Login

- Copilot already has the real flow logic; it mainly needs a guided TUI entrypoint and cleanup of duplicated success output.
- Claude/Codex auth commands only check credential presence; login guidance must launch the external CLIs (`claude`, `codex auth login`) interactively.
- `providers/shared/interactive-command.ts` and omarchy's login flow confirm Bun can manage interactive subprocesses cleanly.

### OAuth App Status

- The current `DEFAULT_CLIENT_ID` in `apps/backend/src/commands/auth-command.ts` is still treated as a pre-release placeholder in project docs.
- Direct verification on **2026-03-29** against GitHub's device-code endpoint returned `404 Not Found`, so there is no evidence that the embedded ID is currently valid for release use.

## Recommended Plan Shape

1. Add the interactive menu shell and CLI routing changes so `agent-bar`/`agent-bar menu` enter a TUI when interactive.
2. Build the rich terminal snapshot formatter and wire the List All action to it.
3. Add guided provider login + doctor TUI presentation, refactor obvious auth duplication, and record the OAuth client-id blocker explicitly.

## Don't Hand-Roll

- Do not reimplement provider fetching for the TUI; reuse `createUsageSnapshot()` / existing snapshot commands.
- Do not replace JSON outputs with TUI output.
- Do not fake QUAL-03 by renaming the constant or changing docs without a verifiable working GitHub OAuth App client ID.

## Common Pitfalls

- Launching clack prompts when stdin/stdout are not TTYs will hang CI/tests or produce broken output.
- ANSI-rich terminal rendering must degrade gracefully for providers with missing usage numbers or error states.
- Interactive provider login launches need inherited stdio; running them through buffered subprocess capture would break the provider CLIs.
- Menu actions must preserve process exit semantics instead of swallowing failures and leaving the shell in a misleading success state.

## Validation Architecture

- Add targeted tests for menu routing and TTY fallback behavior.
- Add formatter tests covering progress-bar rendering, severity colors, and error-state cards.
- Add login-menu tests with injected prompt/launcher functions so provider-specific flows are deterministic under Vitest.
- Add doctor presenter tests via dependency injection for spinner/log behavior, while keeping `--json` coverage intact.
- Final verification should include:
  - `cd apps/backend && bun run vitest run`
  - `cd apps/backend && bun test test/settings.test.ts test/service-runtime.test.ts`
  - `pnpm --filter gnome-extension test`
  - `bun x biome check .`

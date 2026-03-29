# Phase 12: Terminal UI & Code Quality - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning
**Mode:** Auto-generated (CLI/TUI integration)

<domain>
## Phase Boundary

Add the interactive terminal surface for Agent Bar, upgrade doctor output to a guided clack-based flow, and close obvious CLI/auth code-quality gaps without regressing the already-shipped backend and GNOME surfaces.

</domain>

<decisions>
## Implementation Decisions

### Locked Decisions

- `agent-bar` with no arguments should open an interactive `@clack/prompts` menu when stdin/stdout are attached to a TTY.
- The TUI should reuse existing command modules instead of duplicating backend logic.
- Rich terminal quota display should be implemented as a formatter over the existing `SnapshotEnvelope` contract rather than new provider-specific DTOs.
- Provider login should be guided through a TUI submenu, but actual authentication must continue using provider-native CLIs / existing Copilot device-flow code paths.
- JSON modes (`doctor --json`, `usage --json`, `service ... --json`) remain machine-readable and must not be replaced by TUI output.

### External Constraint / Blocker

- On **2026-03-29**, a direct POST to `https://github.com/login/device/code` using the current `DEFAULT_CLIENT_ID` (`Ov23liWCdSLUEPTXJz4c`) returned **HTTP 404 / `{"error":"Not Found"}`**. Replacing that value with a real registered GitHub OAuth App client ID cannot be completed autonomously inside the repo.

</decisions>

<canonical_refs>
## Canonical References

### Existing CLI / Auth surfaces
- `apps/backend/src/cli.ts` — current manual command router
- `apps/backend/src/commands/auth-command.ts` — Copilot device flow and Claude/Codex auth status commands
- `apps/backend/src/commands/diagnostics-command.ts` — doctor entrypoint
- `apps/backend/src/formatters/doctor-text-formatter.ts` — current plain doctor formatter
- `apps/backend/src/providers/shared/interactive-command.ts` — Bun terminal/interactive subprocess patterns

### Existing interactive patterns
- `apps/backend/src/lifecycle/setup.ts`
- `apps/backend/src/lifecycle/update.ts`
- `apps/backend/src/commands/providers-command.ts`

### Reference patterns from omarchy
- `/home/othavio/Work/agent-bar-omarchy/src/tui/index.ts`
- `/home/othavio/Work/agent-bar-omarchy/src/tui/login.ts`
- `/home/othavio/Work/agent-bar-omarchy/src/formatters/terminal.ts`
- `/home/othavio/Work/agent-bar-omarchy/src/tui/colors.ts`

</canonical_refs>

<code_context>
## Existing Code Insights

### Already Present

- The CLI is already framework-free and easy to extend with a new `menu` route or a no-args fallback.
- `@clack/prompts` is already installed and used successfully in lifecycle and provider-selection flows.
- Copilot auth already supports both device flow and direct token storage.
- Phase 11 established stable provider ordering, persistent cache, and locale-aware time helpers that the TUI can reuse.

### Current Gaps

- Running `agent-bar` with no args still prints boxed help instead of opening an interactive menu.
- There is no rich terminal quota renderer with Unicode progress bars / One Dark colors.
- `doctor` still prints plain text instead of guided clack spinners and colored results.
- Claude/Codex auth commands only report whether credentials exist; they do not guide the user through login flows.
- `runAuthCopilotCommand()` duplicates its success tail in both the token and device-flow branches.

</code_context>

<specifics>
## Specific Ideas

- Add a small TTY guard helper so the menu/TUI paths are only used when interactive.
- Keep menu action handlers injectable for tests, mirroring the repo's existing DI style.
- Use a terminal formatter over `SnapshotEnvelope` with generic provider cards: provider name, colored progress bar, usage numbers, reset/updated labels, and status footer.
- For Claude/Codex login flows, spawn the native CLI with inherited stdio and then run the existing auth status check as verification.
- Treat the GitHub OAuth App replacement as an explicit external blocker in the final verification/status docs unless the maintainer provides a working client ID.

</specifics>

<deferred>
## Deferred Ideas

- Animated splash screens or logo art in the TUI
- Persistent menu preferences / custom themes
- In-menu editing of provider-specific source modes beyond the existing `agent-bar providers` flow

</deferred>

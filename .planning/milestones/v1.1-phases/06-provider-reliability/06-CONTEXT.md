# Phase 6: Provider Reliability

## Goal

Make all three providers (Copilot, Codex CLI, Claude CLI) work reliably for any user with minimal friction, both from the CLI and from the systemd background service.

## Background

Phases 1-5 delivered a working backend, GNOME extension, install script, and diagnostics system. However, real-world testing on Ubuntu 24.04 with GNOME Shell 46 (Wayland) exposed that **none of the three providers actually return data** when the backend runs as a systemd service. The extension loads and communicates with the backend correctly, but every provider shows an error.

## Problems Discovered

### Problem 1: Codex and Claude — `script` PTY wrapper fails without TTY

**Symptom**: `codex_cli_failed: /usr/bin/script failed with exit code unknown` and `claude_cli_failed: Subprocess timed out: script`.

**Root cause**: Both providers fetch usage by running the CLI in interactive mode and sending commands via stdin. The code wraps the CLI with `script -qec "command" /dev/null` to create a pseudo-terminal. When the backend runs as a systemd service (no controlling terminal), `script` cannot allocate a PTY. The wrapped CLI either fails immediately or hangs until the 15-20 second timeout.

**Code path**:
- `apps/backend/src/providers/shared/interactive-command.ts` — `runInteractiveCommand()` wraps with `script -qec`
- `apps/backend/src/providers/codex/codex-cli-fetcher.ts` — sends `/status\n` input to codex REPL
- `apps/backend/src/providers/claude/claude-cli-fetcher.ts` — sends `y\r\r/usage\r` input to claude

**Investigation findings**:
- `script -qec "echo hello" /dev/null` works from terminal but hangs/fails from systemd subprocess
- Neither `codex` nor `claude` have non-interactive flags for usage data
- No REST API endpoints exist for usage queries on either platform
- `expect`, `unbuffer`, `socat` are not installed on the target system
- The only reliable alternative is `node-pty` (Microsoft), which creates real kernel PTYs programmatically

### Problem 2: Copilot — no token auto-discovery

**Symptom**: `copilot_token_missing: No Copilot token was found in the environment or resolved secret store.`

**Root cause**: The Copilot provider fetches usage via the GitHub API (`https://api.github.com/copilot_internal/user`), which requires a GitHub token. The token resolver checks environment variables (`COPILOT_API_TOKEN`, `GITHUB_TOKEN`, `GH_TOKEN`, `COPILOT_TOKEN`) and the secret store (via `secret-tool`). The user is authenticated in their terminal session, but:
1. No token env vars are set in the shell profile
2. `gh` CLI is not installed (no `gh auth token` available)
3. The systemd service has a minimal environment (`NODE_ENV=production` only)
4. No `~/.config/agent-bar/config.json` exists with a secretRef

**Code path**:
- `apps/backend/src/providers/copilot/copilot-token-resolver.ts` — checks env vars then secret store
- `apps/backend/src/providers/copilot/copilot-usage-fetcher.ts` — calls GitHub API with token
- `apps/backend/src/secrets/secret-tool-store.ts` — resolves secrets from GNOME Keyring

### Problem 3: Systemd service has minimal environment

**Symptom**: Even if the user sets `GITHUB_TOKEN` in their shell, the systemd service doesn't see it.

**Root cause**: The systemd unit file only sets `Environment=NODE_ENV=production`. The service process doesn't inherit the user's shell environment (PATH, tokens, DBUS_SESSION_BUS_ADDRESS). This affects:
- Token resolution for Copilot (env vars invisible)
- CLI resolution for Codex/Claude (PATH missing `~/.nvm/...` and `~/.local/bin`)
- Secret-tool access (needs DBUS_SESSION_BUS_ADDRESS for GNOME Keyring)

### Problem 4: Doctor gives unhelpful suggestions

**Symptom**: `agent-bar doctor --json` shows failures but `suggested_command` values are diagnostic (`which secret-tool`, `codex --version`) rather than actionable fix commands.

## User Decisions (from brainstorming session)

The following decisions were made collaboratively with the user:

1. **Codex/Claude PTY**: Use `node-pty` (Microsoft npm package) to replace the `script` wrapper. Acceptable to require `build-essential` as a prerequisite. If node-pty compilation fails, provide clear instructions via the doctor command.

2. **Copilot auth**: Create a new `agent-bar auth copilot` command implementing GitHub Device Flow OAuth. Store the token in GNOME Keyring via `secret-tool`. Auto-generate the config file with secretRef.

3. **Service environment**: The install script captures relevant env vars (PATH, tokens, DBUS_SESSION_BUS_ADDRESS) and writes a systemd override at `~/.config/systemd/user/agent-bar.service.d/env.conf`.

4. **Doctor improvements**: Every failed check shows an actionable fix command (e.g., `agent-bar auth copilot` instead of `agent-bar config validate`). Add new checks for `node-pty` availability and systemd env override.

5. **Scope**: All four work items are in scope — PTY refactor, auth command, env capture, doctor improvements.

## Etapas

This phase is split into two etapas (stages) that can be executed sequentially:

- **Etapa 1** (06-01): PTY infrastructure + provider fetcher refactor (Steps 1-2 from plan)
- **Etapa 2** (06-02): Auth command + install script + doctor improvements (Steps 3-5 from plan)

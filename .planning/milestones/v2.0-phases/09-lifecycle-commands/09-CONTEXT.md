# Phase 9: Lifecycle Commands - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can install, remove, update, and fully uninstall Agent Bar through interactive TypeScript commands that manage systemd, GNOME extension, and settings safely. This phase also introduces versioned settings with migration logic.

</domain>

<decisions>
## Implementation Decisions

### Setup & Install Flow
- `agent-bar setup` installs: CLI symlink (~/.local/bin/agent-bar), systemd service + env override, GNOME extension copy + enable — full omarchy pattern
- Setup does NOT require sudo — all files go to user-level paths (~/.local/bin, ~/.config/systemd/user/, ~/.local/share/gnome-shell/extensions/)
- Setup detects missing dependencies (bun, secret-tool, gnome-extensions) and reports with exact install commands — does NOT install automatically
- Setup is idempotent — re-running updates everything without duplicating

### Update Strategy
- `agent-bar update` runs: git fetch → show incoming commits via @clack p.note → confirm → git pull --ff-only → bun install → rebuild backend → restart systemd → re-copy GNOME extension
- If local changes exist: fail with clear message suggesting stash/commit — no auto-stash
- No rollback in v2.0 — just error message if pull fails
- Show incoming commits count and summary before confirming

### Settings & Secret Handling
- Settings format: JSON at ~/.config/agent-bar/settings.json with `version: number` field — omarchy pattern
- `agent-bar remove` preserves: GNOME Keyring secrets AND settings.json (user may want to reinstall)
- `agent-bar uninstall` additionally: deletes Keyring secrets via `secret-tool clear`, deletes settings.json and cache — requires explicit confirmation with initialValue: false
- Settings migration: `normalizeSettings()` with per-field fallback to defaults for invalid values — omarchy pattern

### Claude's Discretion
- Internal implementation details of @clack/prompts flows (spinner text, note content, intro/outro messages)
- Error message wording and formatting
- Exact order of setup steps within the install flow
- Whether to add `agent-bar apply-local` command (like omarchy) in this phase or defer

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `/home/othavio/Work/agent-bar-omarchy/src/setup.ts` — reference setup implementation (symlink, waybar wiring, asset install)
- `/home/othavio/Work/agent-bar-omarchy/src/update.ts` — reference update (git fetch, show commits, pull, bun install)
- `/home/othavio/Work/agent-bar-omarchy/src/uninstall.ts` — reference uninstall (confirmation, cleanup, signal handler)
- `/home/othavio/Work/agent-bar-omarchy/src/remove.ts` — reference remove (force uninstall wrapper)
- `/home/othavio/Work/agent-bar-omarchy/src/settings.ts` — reference settings (versioned, migration, atomic writes, load sync/async)
- `scripts/install-ubuntu.sh` — current bash installer (310 lines) — logic reference for Ubuntu-specific steps
- `apps/backend/src/config/` — existing config loading (to be replaced/enhanced with versioned settings)

### Established Patterns
- @clack/prompts for all interactive CLI flows (omarchy reference)
- XDG paths for config and cache
- Bun.spawn for subprocess execution (from Phase 8)
- Bun.file / Bun.write for file operations

### Integration Points
- `apps/backend/src/cli.ts` — where new commands (setup, remove, update, uninstall) get registered
- `packaging/systemd/user/agent-bar.service` — service file to copy during setup
- `apps/gnome-extension/` — extension directory to copy during setup
- `~/.config/systemd/user/agent-bar.service.d/env.conf` — environment override generated during setup

</code_context>

<specifics>
## Specific Ideas

- Mirror agent-bar-omarchy lifecycle patterns exactly: p.intro → p.note → p.confirm → p.spinner per step → p.outro
- Setup must handle: (1) CLI symlink, (2) systemd unit + env override, (3) GNOME extension copy + enable, (4) systemctl daemon-reload + enable + restart
- Update must handle: (1) git fetch + behind check, (2) show commits, (3) confirm, (4) git pull --ff-only, (5) bun install, (6) rebuild, (7) restart service, (8) re-copy extension
- Remove is thin wrapper over uninstall with force: true
- Settings use atomic writes (temp file + rename) like omarchy

</specifics>

<deferred>
## Deferred Ideas

- `agent-bar apply-local` command (like omarchy) — evaluate during planning
- Auto-update check on CLI startup (like omarchy's version check) — defer to Phase 12

</deferred>

# Agent Bar Ubuntu

Linux-native desktop tool that surfaces AI provider usage (Copilot, Codex CLI, Claude CLI) for Ubuntu users through a GNOME Shell extension backed by a local Node.js service.

## What You Get

- A GNOME Shell topbar indicator showing provider status at a glance.
- A backend CLI (`agent-bar`) that fetches usage snapshots, runs diagnostics, and manages a local service.
- A local Unix socket service that keeps snapshots cached for instant reads.
- A `doctor` command that reports missing prerequisites and runtime health.

## Repository Layout

```
apps/backend/           Node.js/TypeScript backend, CLI, and service runtime
apps/gnome-extension/   GNOME Shell 46 extension (indicator, menu, polling)
packages/shared-contract/  Zod schemas shared between backend and extension
scripts/                Install and verification helpers
packaging/              systemd unit and tmpfiles.d config
docs/                   Install, troubleshooting, and debugging guides
```

## Requirements

| Dependency | Version | Notes |
|---|---|---|
| Ubuntu | 24.04+ | GNOME-based desktop with Wayland or X11 |
| GNOME Shell | 46 | Required for the extension |
| Node.js | 20+ | LTS recommended |
| pnpm | 10+ | Pinned to 10.17.1 in `package.json` |
| systemd --user | any | Standard on Ubuntu desktop |
| secret-tool | optional | Install `libsecret-tools` for credential-backed providers |

## Quick Start

```bash
# 1. Clone and install dependencies
git clone <repo-url> && cd agent-bar-usage
pnpm install

# 2. Build and install everything
pnpm install:ubuntu

# 3. Verify
agent-bar doctor --json
agent-bar service status --json

# 4. Restart GNOME Shell to load the extension
#    Wayland: log out and log back in
#    X11:     Alt+F2 -> r -> Enter
```

After login, the Agent Bar indicator appears in the GNOME topbar.

## Step-by-Step Installation

### 1. Install system prerequisites

```bash
# Node.js (via nvm or your preferred method)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
nvm install --lts

# pnpm
corepack enable && corepack prepare pnpm@10.17.1 --activate

# Optional: secret-tool for credential-backed providers
sudo apt install libsecret-tools
```

### 2. Clone and install

```bash
git clone <repo-url>
cd agent-bar-usage
pnpm install
```

If pnpm prompts to approve builds (e.g., esbuild), select the packages and confirm.

### 3. Build and install

```bash
pnpm install:ubuntu
```

This single command:
- Builds `shared-contract` and `backend` packages
- Creates the CLI wrapper at `~/.local/bin/agent-bar`
- Installs the systemd user service (`agent-bar.service`)
- Protects the runtime socket directory from tmpfiles cleanup
- Copies the GNOME extension to `~/.local/share/gnome-shell/extensions/`
- Enables the extension

### 4. Restart GNOME Shell

The GNOME extension only loads on session start (Wayland limitation).

```bash
# Log out and log back in
```

### 5. Verify

```bash
# Quick check
agent-bar doctor --json

# Full contract verification
pnpm verify:ubuntu
```

## CLI Reference

### `agent-bar usage`

Fetch provider usage snapshots directly (bypasses the service).

```bash
agent-bar usage                          # Text output
agent-bar usage --json                   # JSON output
agent-bar usage --json --diagnostics     # Include provider diagnostics
agent-bar usage --provider copilot       # Single provider
agent-bar usage --json --refresh         # Force fresh data
```

### `agent-bar doctor`

Check prerequisites, configuration, and runtime health.

```bash
agent-bar doctor                         # Text output
agent-bar doctor --json                  # JSON output (machine-readable)
```

Reports on: config file, secret-tool, codex CLI, claude CLI, copilot token, service runtime.

### `agent-bar config`

Inspect and validate backend configuration.

```bash
agent-bar config validate                # Check config file
```

Config file location: `~/.config/agent-bar/config.json`

### `agent-bar service`

Manage the local Unix socket service.

```bash
agent-bar service run                    # Start in foreground (for debugging)
agent-bar service status --json          # Check service state
agent-bar service snapshot --json        # Get cached snapshot (instant)
agent-bar service refresh --json         # Force fresh snapshot
```

The service listens on `$XDG_RUNTIME_DIR/agent-bar/service.sock` (typically `/run/user/1000/agent-bar/service.sock`).

### systemd management

```bash
systemctl --user status agent-bar.service      # Check service
systemctl --user restart agent-bar.service     # Restart (recreates socket)
systemctl --user stop agent-bar.service        # Stop
journalctl --user -u agent-bar.service -f      # Follow logs
```

## Provider Setup

The backend fetches usage data from three providers. Each needs its own setup.

### Copilot

Requires a GitHub token accessible to the service. Set one of these environment variables in the systemd unit or shell profile:

```bash
# Option A: environment variable
export GITHUB_TOKEN=ghp_your_token_here

# Option B: add to systemd service override
systemctl --user edit agent-bar.service
# Add under [Service]:
#   Environment=GITHUB_TOKEN=ghp_your_token_here
# Then: systemctl --user restart agent-bar.service
```

Token lookup order: `COPILOT_API_TOKEN`, `GITHUB_TOKEN`, `GH_TOKEN`, `COPILOT_TOKEN`.

### Codex CLI

Requires `codex` on PATH and authenticated:

```bash
codex login
codex --version   # Confirm it works
```

### Claude CLI

Requires `claude` on PATH and authenticated:

```bash
claude --version   # Confirm it works
```

> **Known limitation:** Codex and Claude providers currently use interactive CLI wrapping via the `script` command, which can be unreliable when the backend runs as a systemd service (no TTY). Provider errors like `codex_cli_failed` or `claude_cli_failed` are expected in the current version. API-based fetchers are planned.

## Development

### Project structure

| Path | Language | Purpose |
|---|---|---|
| `apps/backend/src/` | TypeScript | CLI, service, providers, diagnostics |
| `apps/gnome-extension/` | JavaScript (GJS) | GNOME Shell extension |
| `packages/shared-contract/src/` | TypeScript | Zod schemas (shared types) |
| `scripts/` | Bash | Install and verify helpers |
| `packaging/` | Config | systemd unit, tmpfiles.d |

### Build commands

```bash
pnpm build:backend          # Build shared-contract + backend
pnpm build:shared           # Build shared-contract only
```

The build chain: `shared-contract` compiles first (backend depends on it). Both use `tsconfig.build.json` which overrides the base `noEmit: true` for type-checking-only configs.

### Test commands

```bash
pnpm test:backend           # Backend test suite (vitest)
pnpm test:gnome             # GNOME extension test suite (vitest)
```

### Development workflow

```bash
# 1. Edit code
# 2. Run tests
pnpm test:backend
pnpm test:gnome

# 3. Rebuild and reinstall if you changed runtime code
pnpm install:ubuntu

# 4. Restart GNOME Shell to pick up extension changes (Wayland: logout/login)

# 5. Verify everything works
pnpm verify:ubuntu
```

### GNOME extension development

The extension runs inside the GNOME Shell process (GJS, not Node.js). Key differences from Node.js:

- Imports use GI bindings: `import GObject from "gi://GObject"`, `import St from "gi://St"`
- GNOME Shell UI modules: `import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js"`
- Classes extending GObject subclasses MUST use `GObject.registerClass()` with `_init()` / `super._init()`
- No `require()`, no `node_modules` — pure ESM with GJS module system
- Test in isolation with `vitest` (mocks GJS APIs), then test live by installing and restarting GNOME Shell

Extension files are plain `.js` (no build step). Changes are picked up on GNOME Shell restart.

### Adding a new provider

1. Create `apps/backend/src/providers/<name>/` with adapter, fetcher, and parser files
2. Register the provider ID in `packages/shared-contract/src/request.ts` (`providerIdSchema`)
3. Wire the adapter into the backend coordinator
4. Run tests: `pnpm test:backend`
5. Rebuild and verify: `pnpm install:ubuntu && pnpm verify:ubuntu`

## Troubleshooting

### Extension shows "Backend error"

```bash
# Check service is running with a live socket
systemctl --user status agent-bar.service
ls /run/user/1000/agent-bar/service.sock

# If socket is missing, restart the service
systemctl --user restart agent-bar.service

# Test the snapshot path
time agent-bar service snapshot --json
# Should complete in < 1 second (cached) or ~22 seconds (first fetch)
```

### Extension shows provider errors (not "Backend error")

This means the backend is reachable but individual providers are failing. Run diagnostics:

```bash
agent-bar doctor --json
```

Common causes:
- **copilot_token_missing**: No `GITHUB_TOKEN` set. See Provider Setup above.
- **codex_cli_failed / claude_cli_failed**: Interactive CLI wrapping issue. Known limitation.
- **secret-tool missing**: `sudo apt install libsecret-tools`

### Service won't start

```bash
journalctl --user -u agent-bar.service --no-pager | tail -20
# Common: "Cannot find module" -> rebuild with pnpm install:ubuntu
```

### Extension doesn't appear after login

```bash
gnome-extensions info agent-bar-ubuntu@othavio.dev
# State should be ACTIVE

# If ERROR: check GNOME Shell logs
journalctl --user -b | grep "agent-bar" | tail -10

# Reinstall extension
pnpm install:ubuntu
# Then logout/login again
```

### Socket keeps disappearing

```bash
# Ensure tmpfiles protection is installed
cat ~/.config/user-tmpfiles.d/agent-bar.conf
# Should contain: d %t/agent-bar 0775 - - -

# If missing, reinstall
pnpm install:ubuntu
```

## Debugging

### Follow logs in real time

```bash
# Service logs
journalctl --user -u agent-bar.service -f

# GNOME Shell logs (extension errors)
journalctl --user -b | grep "agent-bar"
```

### Run service in foreground

```bash
systemctl --user stop agent-bar.service
agent-bar service run
# Ctrl+C to stop, then re-enable:
systemctl --user start agent-bar.service
```

### Test the full data flow

```bash
# 1. Service status
agent-bar service status --json

# 2. Cached snapshot (should be instant)
time agent-bar service snapshot --json

# 3. Fresh snapshot (triggers provider fetches)
time agent-bar service refresh --json

# 4. Direct CLI (bypasses service)
agent-bar usage --json --diagnostics
```

## Additional Docs

- [Ubuntu install guide](docs/ubuntu-install.md)
- [Troubleshooting](docs/ubuntu-troubleshooting.md)
- [Debugging](docs/ubuntu-debugging.md)

# Ubuntu Install Guide

Complete step-by-step installation of Agent Bar Ubuntu: backend service, CLI, and GNOME Shell extension.

## Prerequisites

| Requirement | Check command | Install if missing |
|---|---|---|
| Ubuntu 24.04+ with GNOME | `gnome-shell --version` | - |
| Node.js 20+ | `node --version` | `nvm install --lts` |
| pnpm 10+ | `pnpm --version` | `corepack enable && corepack prepare pnpm@10.17.1 --activate` |
| systemd user session | `systemctl --user status` | Standard on Ubuntu desktop |
| secret-tool (optional) | `which secret-tool` | `sudo apt install libsecret-tools` |

## Step 1: Clone the repo

```bash
git clone <repo-url>
cd agent-bar-usage
```

## Step 2: Build and install

```bash
pnpm install:ubuntu
```

This command does everything:

1. Builds `packages/shared-contract` (Zod schemas)
2. Builds `apps/backend` (TypeScript CLI and service)
3. Creates `~/.local/bin/agent-bar` (CLI wrapper)
4. Installs `~/.config/systemd/user/agent-bar.service` (user service)
5. Installs `~/.config/user-tmpfiles.d/agent-bar.conf` (socket directory protection)
6. Enables and starts the systemd service
7. Copies the GNOME extension to `~/.local/share/gnome-shell/extensions/agent-bar-ubuntu@othavio.dev/`
8. Enables the extension

If pnpm asks to approve builds (e.g., esbuild), press space to select, then confirm.

## Step 3: Restart GNOME Shell

On Wayland (default Ubuntu): **log out and log back in**.

On X11: press `Alt+F2`, type `r`, press Enter.

The extension only loads when GNOME Shell starts.

## Step 4: Verify

```bash
# Quick diagnostics
agent-bar doctor --json

# Service health
agent-bar service status --json

# Cached snapshot (should be fast)
agent-bar service snapshot --json

# Full contract verification
pnpm verify:ubuntu
```

## What gets installed

| File | Purpose |
|---|---|
| `~/.local/bin/agent-bar` | CLI wrapper (calls Node.js with the built backend) |
| `~/.config/systemd/user/agent-bar.service` | Systemd user unit for the background service |
| `~/.config/user-tmpfiles.d/agent-bar.conf` | Protects the runtime socket directory |
| `~/.local/share/gnome-shell/extensions/agent-bar-ubuntu@othavio.dev/` | GNOME Shell extension files |
| `/run/user/$UID/agent-bar/service.sock` | Unix socket (created at runtime by the service) |

## Updating

After pulling new changes:

```bash
pnpm install:ubuntu
# Then logout/login to reload the extension
```

## Troubleshooting

If you hit one of these during `pnpm install:ubuntu`:

- `sh: 1: tsc: not found`
- `Local package.json exists, but node_modules missing`

that means the workspace packages were not installed correctly. The current repo version includes `pnpm-workspace.yaml`, which tells pnpm to install `apps/*` and `packages/*` together.

Confirm that file exists in your checkout, then rerun:

```bash
pnpm install:ubuntu
```

## Uninstalling

```bash
# Stop and disable the service
systemctl --user stop agent-bar.service
systemctl --user disable agent-bar.service

# Remove installed files
rm -f ~/.local/bin/agent-bar
rm -f ~/.config/systemd/user/agent-bar.service
rm -f ~/.config/user-tmpfiles.d/agent-bar.conf
rm -rf ~/.local/share/gnome-shell/extensions/agent-bar-ubuntu@othavio.dev/

# Reload systemd
systemctl --user daemon-reload

# Logout/login to unload the extension
```

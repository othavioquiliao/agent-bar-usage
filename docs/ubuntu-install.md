# Ubuntu Install Guide

Complete step-by-step installation of Agent Bar Ubuntu: backend service, CLI, and GNOME Shell extension.

## Prerequisites

| Requirement | Check command | Install if missing |
|---|---|---|
| Ubuntu 24.04+ with GNOME | `gnome-shell --version` | - |
| Bun 1.x | `bun --version` | Follow https://bun.sh/docs/installation |
| Node.js 20+ | `node --version` | `nvm install --lts` |
| pnpm 10+ | `pnpm --version` | `corepack enable && corepack prepare pnpm@10.17.1 --activate` |
| systemd user session | `systemctl --user status` | Standard on Ubuntu desktop |
| secret-tool (optional) | `which secret-tool` | `sudo apt install libsecret-tools` |

> `Bun` e usado pelos scripts de build/teste do repositorio. O instalador Ubuntu atual ainda
> gera um wrapper local que executa o backend compilado com `node`, entao migracoes e instalacoes
> novas ainda precisam dos dois.

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

## Migrating from older installs

If you already had Agent Bar installed, `pnpm install:ubuntu` updates the service, CLI wrapper,
and GNOME extension in place. You do not need to uninstall first.

After reinstalling, check the local config:

```bash
cat ~/.config/agent-bar/config.json
```

If `codex` or `claude` still use `sourceMode: "cli"`, either:

```bash
# Option 1: reset to current defaults
rm ~/.config/agent-bar/config.json

# Option 2: edit manually and change "cli" -> "auto"
nano ~/.config/agent-bar/config.json
```

Then restart the service and re-run auth if needed:

```bash
systemctl --user restart agent-bar.service
agent-bar auth copilot
agent-bar doctor --json
```

`agent-bar auth copilot` now ships with a default GitHub OAuth `client_id`. Use `--client-id`
only to override it for testing, or `--token` for a manual/headless flow.

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
| `~/.local/bin/agent-bar` | CLI wrapper (currently calls Node.js with the built backend) |
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

### Atualizando de versoes com sourceMode "cli"

Se voce instalou o Agent Bar antes de marco/2026, o config local provavelmente usa
`sourceMode: "cli"` para Codex e Claude. Esse modo dependia de sessoes PTY interativas
que **nao funcionam mais** com as versoes atuais dos CLIs.

Apos `pnpm install:ubuntu`, atualize o config:

```bash
# Opcao 1: Delete o config para usar os novos defaults (auto)
rm ~/.config/agent-bar/config.json

# Opcao 2: Edite manualmente
# Mude "sourceMode": "cli" para "sourceMode": "auto" nos providers codex e claude
nano ~/.config/agent-bar/config.json
```

Depois reinicie o servico:

```bash
systemctl --user restart agent-bar.service
agent-bar auth copilot   # se precisar reconfigurar o token do Copilot
agent-bar usage   # Deve mostrar todos os providers com status ok
```

**O que mudou:**
- **Claude** agora usa API HTTP (`api.anthropic.com/api/oauth/usage`) — o fetcher PTY (`/usage`) foi removido
- **Codex** agora usa `codex app-server` (JSON-RPC) — o fetcher PTY (`/status`) foi depreciado
- **Copilot** continua usando API GitHub (sem mudanca)
- **Auth Copilot** nao precisa mais de `--client-id` no fluxo padrao de device auth

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

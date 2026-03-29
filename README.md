# Agent Bar Ubuntu

Linux-native desktop tool that surfaces AI provider usage (Copilot, Codex CLI, Claude CLI) for Ubuntu users through a GNOME Shell extension backed by a local CLI and Unix socket service.

## What You Get

- A GNOME Shell topbar indicator showing provider status at a glance.
- A backend CLI (`agent-bar`) that fetches usage snapshots, runs diagnostics, and manages a local service.
- A local Unix socket service that keeps snapshots cached for instant reads.
- A `doctor` command that reports missing prerequisites and runtime health.

## Repository Layout

```
apps/backend/           TypeScript backend, CLI, and service runtime
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
| Bun | 1.x | Required by the repo build/test scripts |
| Node.js | 20+ | Current Ubuntu installer and installed CLI wrapper still use Node |
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

## Atualizando de uma versao anterior

Se voce **ja tinha o Agent Bar instalado** e quer atualizar:

```bash
# 1. Puxe as mudancas
git pull

# 2. Reinstale
pnpm install:ubuntu

# 3. Revise o config local (importante)
#    Versoes anteriores usavam sourceMode "cli" para Codex e Claude.
#    Agora o padrao e "auto" (usa API/app-server em vez de PTY interativo).
#    Se o seu config ainda tem "cli", atualize ou apague o arquivo:
cat ~/.config/agent-bar/config.json
#    Mude "sourceMode": "cli" para "sourceMode": "auto" nos providers codex e claude
#    ou delete ~/.config/agent-bar/config.json para voltar aos defaults.

# 4. Reinicie o servico
systemctl --user restart agent-bar.service

# 5. Refaça a autenticacao do Copilot se necessario
agent-bar auth copilot

# 6. Verifique
agent-bar doctor --json
agent-bar usage
```

### Checklist de migracao para v2.0

Se voce esta vindo de `v1` ou `v1.1`, o caminho mais seguro e:

1. Rode `pnpm install:ubuntu` no checkout atualizado.
2. Confirme que `~/.config/agent-bar/config.json` nao ficou com `sourceMode: "cli"` para `codex` ou `claude`.
3. Se quiser um reset limpo dos defaults de provider, delete `~/.config/agent-bar/config.json` e deixe o Agent Bar recria-lo.
4. Rode `agent-bar auth copilot` se o `doctor` acusar `copilot_token_missing`.
5. Reinicie o servico com `systemctl --user restart agent-bar.service`.
6. Em Wayland, faca logout/login para recarregar a extensao GNOME.

### Por que atualizar o config?

Versoes anteriores usavam `sourceMode: "cli"` que dependia de sessoes PTY interativas
(`/usage` no Claude, `/status` no Codex). Esses comandos **nao existem mais** nas versoes
atuais dos CLIs (Claude v2.1+ e Codex v0.117+), causando timeouts.

A versao atual usa caminhos mais robustos:
- **Claude**: API HTTP via OAuth credentials (`~/.claude/.credentials.json`)
- **Codex**: app-server JSON-RPC (`codex app-server`)
- **Copilot**: API GitHub (sem mudanca)

Se o seu `~/.config/agent-bar/config.json` ainda tem `"sourceMode": "cli"`, o Agent Bar
vai ignorar esses caminhos novos e tentar o PTY antigo (que vai falhar).

### Passo a passo completo

1. **Nao precisa desinstalar a versao antiga.** O `pnpm install:ubuntu` atualiza tudo.

2. **Atualize o config** se ele existir com sourceModes antigos:

   ```bash
   # Veja o config atual
   cat ~/.config/agent-bar/config.json

   # Se codex ou claude tem "sourceMode": "cli", edite para "auto":
   # Ou delete o config para usar os novos defaults:
   rm ~/.config/agent-bar/config.json
   ```

3. **Em Wayland, faca logout/login** para recarregar a extensao GNOME.

4. **Se o `doctor` reclamar de dependencias**, resolva antes:

   ```bash
   sudo apt install libsecret-tools   # se secret-tool estiver faltando
   ```

5. **Para Copilot, use o comando de auth:**

   ```bash
   agent-bar auth copilot
   ```

   Desde a v2.0, o Agent Bar ja inclui um `client_id` padrao para o GitHub Device Flow.
   Use `--client-id` apenas para testes ou para sobrescrever esse valor. Em ambientes
   sem browser, tambem e possivel usar `agent-bar auth copilot --token ghp_SEU_TOKEN`.

6. **Verifique que tudo funciona:**

   ```bash
   agent-bar usage                    # Deve mostrar os 3 providers com status ok
   pnpm verify:ubuntu                 # Verificacao completa
   ```

## Step-by-Step Installation

### 1. Install system prerequisites

```bash
# Bun (required by the repo build/test scripts)
# See: https://bun.sh/docs/installation

# Node.js (currently still required by the Ubuntu installer/wrapper)
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

Recommended path: authenticate with the built-in Device Flow helper.

```bash
agent-bar auth copilot
```

Since v2.0, this command already includes the default GitHub OAuth client ID. Use
`--client-id` only if you need to override it for testing, or `--token` for a manual/headless flow.

You can still provide a GitHub token directly to the service through one of these environment variables:

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

Requires `codex` on PATH and authenticated. O Agent Bar usa `codex app-server` (JSON-RPC) para buscar usage — nao precisa de sessao PTY interativa.

```bash
codex login
codex --version   # Confirm it works
```

> **Importante:** O config deve ter `sourceMode: "auto"` (padrao atual). Com `"cli"`, o Agent Bar tenta o caminho PTY interativo antigo que nao funciona mais no Codex v0.117+.

### Claude CLI

Requires `claude` on PATH and authenticated. O Agent Bar usa a API HTTP da Anthropic (`api.anthropic.com/api/oauth/usage`) com credenciais OAuth locais — nao precisa de sessao PTY interativa.

```bash
claude --version   # Confirm it works
```

As credenciais OAuth ficam em `~/.claude/.credentials.json` (criadas automaticamente quando voce faz login no Claude CLI). Se o token expirar, rode qualquer comando `claude` para renovar.

> **Importante:** O caminho PTY antigo (que rodava `/usage` dentro do Claude interativo) foi removido — nao existe mais no Claude v2.1+. O config deve ter `sourceMode: "auto"` ou `"api"`.

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
- **claude_cli_removed**: O config esta com `sourceMode: "cli"` mas o fetcher PTY foi removido. Mude para `"auto"` ou `"api"`.
- **codex_cli_deprecated**: O config esta com `sourceMode: "cli"` mas o fetcher PTY foi depreciado. Mude para `"auto"`.
- **claude_cli_missing**: Credenciais OAuth nao encontradas em `~/.claude/.credentials.json`. Rode qualquer comando `claude` para gerar.
- **codex_cli_failed**: Codex app-server falhou. Verifique que `codex` esta no PATH e autenticado (`codex login`).
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

# Design: Instalacao + UX + Provider Overhaul

**Data**: 2026-03-25
**Escopo**: Smart installer, extensao GNOME resiliente, CLI UX melhorada, Claude HTTP fetcher, config system

## Contexto

O Agent Bar Ubuntu tem tres problemas fundamentais:

1. **"Backend error" na extensao GNOME**: O subprocess GIO nao consegue executar `agent-bar` de dentro do GNOME Shell. Nao ha logging para diagnostico.
2. **Providers falhando**: Copilot sem token, Codex/Claude usando node-pty interativo que falha em systemd sem TTY.
3. **Instalacao cega**: `install-ubuntu.sh` nao verifica nem instala dependencias, nao valida resultado.

## Diagnostico Tecnico

### Extensao GNOME — "Backend error"

A extensao chama `agent-bar service snapshot --json` via `Gio.SubprocessLauncher`. O comando funciona do terminal (exit 0, JSON valido). Mas a extensao mostra `state.lastError` (vermelho), indicando que o subprocess falha.

Causas provaveis:
- `normalizeCommunicateResult` pode nao lidar com o formato de retorno do GJS 46
- Nenhum logging existe no catch path — erros sao silenciosos
- Sem retry — uma falha no boot permanece ate o proximo poll (30s)

### Providers

| Provider | Metodo Atual | Problema | Solucao |
|----------|-------------|----------|---------|
| Claude | node-pty + `/usage` (20s timeout) | PTY timeout em systemd | HTTP API: `GET /api/oauth/usage` |
| Codex | node-pty + `/status` (12s timeout) | PTY falha em systemd | Manter node-pty (sem alternativa API) |
| Copilot | HTTP API GitHub | Token nao configurado | Guia interativo no install |

### Claude HTTP Endpoint

```
GET https://api.anthropic.com/api/oauth/usage
Authorization: Bearer <accessToken from ~/.claude/.credentials.json>
anthropic-beta: oauth-2025-04-20
```

Resposta:
```json
{
  "five_hour": { "utilization": 45.0, "resets_at": "2026-03-26T04:00:00Z" },
  "seven_day": { "utilization": 29.0, "resets_at": "2026-03-29T00:00:00Z" }
}
```

Rate limit: ~5 req antes de 429. Cache TTL recomendado: 300s.
Token em: `~/.claude/.credentials.json` campo `claudeAiOauth.accessToken`.

## Design

### 1. Smart Installer (`install-ubuntu.sh` v2)

Fluxo:
```
1. Pre-flight: detectar OS, GNOME Shell, sessao (X11/Wayland)
2. Check/Install Node.js >= 20 (via nvm)
3. Check/Install pnpm (via corepack)
4. Check/Install libsecret-tools (via apt)
5. Check/Install Claude CLI (via npm -g)
6. Check/Install Codex CLI (via npm -g)
7. pnpm install (dependencias do projeto)
8. Build shared-contract + backend
9. Install CLI wrapper (~/.local/bin/agent-bar)
10. Install systemd service + env override
11. Install GNOME extension + enable
12. Validacao via agent-bar doctor
13. Guia de token para Copilot
```

Regras:
- Cada step com output `[ok]` / `[!!]` instalando / `[FAIL]` com instrucao
- Cada instalacao pede confirmacao `Install X? [Y/n]`
- Se dependencia critica falhar (node, pnpm), aborta com mensagem clara
- Idempotente: rodar varias vezes nao quebra nada
- Se tudo ja estiver instalado, pula direto para build

### 2. Claude Provider — HTTP Fetcher

Novo fetcher: `claude-api-fetcher.ts`

```
Estrategia:
1. Ler accessToken de ~/.claude/.credentials.json
2. GET /api/oauth/usage com headers OAuth
3. Mapear resposta para ProviderSnapshot:
   - status: "ok" se utilization < 90, "degraded" se >= 90
   - usage.kind: "quota"
   - usage.used: utilization (percentual)
   - usage.limit: 100
   - usage.percent_used: utilization
   - reset_window: { label: "Resets in Xh", resets_at: five_hour.resets_at }
4. Cache com TTL 300s (respeitar rate limit)
5. Se token invalido/expirado:
   - Retornar error code "claude_auth_expired"
   - Mensagem: "Claude login expirado. Execute: claude auth login"
   - NAO tentar refresh automatico (conflito com Claude Code)
```

Fallback: Se `~/.claude/.credentials.json` nao existe, manter node-pty como fallback.

Adapter selection:
```
claude-adapter.ts:
  if (credentialsFileExists) -> use claude-api-fetcher
  else if (claudeCliBinaryExists && ptyAvailable) -> use claude-pty-fetcher (existente)
  else -> return "claude_cli_missing" error
```

### 3. Extensao GNOME Resiliente

#### 3.1 Logging

Adicionar em `backend-client.js`:
```javascript
// No catch de fetchUsageSnapshot:
console.error(`[agent-bar] Backend call failed (mode=${invocation.mode}):`, error.message);
console.error(`[agent-bar]   argv: ${invocation.argv.join(' ')}`);
console.error(`[agent-bar]   stderr: ${result?.stderr ?? 'none'}`);
```

Adicionar em `polling-service.js`:
```javascript
// No catch do refreshNow:
console.error(`[agent-bar] Snapshot fetch failed:`, error?.message ?? error);
```

#### 3.2 Retry com backoff

No `polling-service.js`:
- Primeira falha: retry apos 2s
- Segunda falha: retry apos 8s
- Terceira falha: retry apos 30s
- Depois: manter poll normal (30s)

Isso resolve o problema de first-boot onde o service ainda nao esta pronto.

#### 3.3 Mensagens acionaveis no menu

Mapear error codes para mensagens uteis:

| Error Code | Mensagem no Menu |
|-----------|-----------------|
| `copilot_token_missing` | "Copilot: token nao configurado\nExecute: agent-bar auth copilot" |
| `claude_auth_expired` | "Claude: login expirado\nExecute: claude auth login" |
| `claude_cli_missing` | "Claude: CLI nao instalada\nExecute: npm i -g @anthropic-ai/claude-code" |
| `codex_cli_missing` | "Codex: CLI nao instalada\nExecute: npm i -g @openai/codex" |
| `codex_pty_unavailable` | "Codex: build-essential necessario\nExecute: sudo apt install build-essential python3" |
| Backend error generico | "Backend: erro de conexao\nExecute: systemctl --user restart agent-bar" |

#### 3.4 Diagnostico de subprocess

Logar o argv, cwd, exit code e stderr do subprocess para facilitar debugging futuro.

### 4. CLI UX

#### 4.1 `agent-bar doctor` human-readable

Formato padrao (sem --json):
```
Agent Bar Doctor
  [ok] Node.js v24.13.0
  [ok] secret-tool (/usr/bin/secret-tool)
  [ok] Service rodando (/run/user/1000/agent-bar/service.sock)
  [!!] Config: usando defaults
       -> agent-bar config validate
  [ok] Claude CLI (/home/user/.local/bin/claude)
  [ok] Codex CLI (/home/user/.nvm/.../codex)
  [FAIL] Copilot: token nao configurado
       -> agent-bar auth copilot
  [ok] node-pty disponivel
  [ok] Systemd env configurado
```

`--json` mantem o formato atual para machine consumption.

#### 4.2 Error messages com next-step

Toda mensagem de erro do CLI inclui sugestao de fix:
```
Error: Copilot token nao encontrado.
  -> Configure com: agent-bar auth copilot
  -> Ou defina GITHUB_TOKEN no ambiente
```

#### 4.3 `agent-bar setup` (novo comando)

Wizard interativo:
```
Agent Bar Setup
  Qual provider voce quer configurar?
  [1] Copilot (GitHub)
  [2] Claude
  [3] Codex
  [4] Todos
```

Para cada provider, guia o usuario pelo setup minimo.

### 5. Config System

#### 5.1 Config file

Location: `~/.config/agent-bar/config.json`

```json
{
  "providers": {
    "copilot": { "enabled": true, "source": "api" },
    "claude": { "enabled": true, "source": "auto" },
    "codex": { "enabled": true, "source": "cli" }
  },
  "cache": {
    "ttl_seconds": 300
  }
}
```

`source: "auto"` = tenta API primeiro, fallback para CLI.

#### 5.2 Auth management

`agent-bar auth copilot` — ja existe, manter.
`agent-bar auth claude` — novo: valida se `~/.claude/.credentials.json` existe e token e valido.
`agent-bar auth codex` — novo: valida se `~/.codex/auth.json` existe e codex funciona.

## Prioridade de Implementacao

1. **Extensao GNOME** (logging + retry + diagnostico subprocess) — desbloqueia debugging
2. **Claude HTTP fetcher** — maior impacto, remove dependencia PTY para o provider mais usado
3. **Smart installer** — melhora drasticamente o onboarding
4. **CLI UX** (doctor colorido, error messages, setup wizard)
5. **Config system** — provider enable/disable, cache TTL

## Riscos

| Risco | Mitigacao |
|-------|----------|
| Rate limit do Claude `/api/oauth/usage` | Cache TTL 300s, exponential backoff em 429 |
| Token refresh conflita com Claude Code | NAO fazer refresh automatico, pedir re-login |
| Codex CLI pode ganhar `--json` flag | Monitorar Issue #15281, migrar quando disponivel |
| `install-ubuntu.sh` pode nao cobrir todas as distros | Focar em Ubuntu 24.04+, documentar limitacoes |
| GNOME Shell 47+ pode mudar APIs | Testar contra multiplas versoes no CI |

## Referencia

- Claude OAuth usage: `GET https://api.anthropic.com/api/oauth/usage`
- Claude credentials: `~/.claude/.credentials.json` (`claudeAiOauth.accessToken`)
- Codex auth: `~/.codex/auth.json`
- Copilot API: `GET https://api.github.com/copilot_internal/user`
- CodexBar reference: `CodexBar/` no repo (provider engine patterns)
- [Claude Code Issue #13585](https://github.com/anthropics/claude-code/issues/13585) — Quota API request
- [Codex Issue #15281](https://github.com/openai/codex/issues/15281) — Non-interactive status

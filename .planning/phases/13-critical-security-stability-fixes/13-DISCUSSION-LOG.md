# Phase 13: Critical Security & Stability Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 13-critical-security-stability-fixes
**Areas discussed:** Graceful shutdown, Timeout strategy, Atomic write scope, GNOME actor cleanup depth

---

## Graceful Shutdown

| Option | Description | Selected |
|--------|-------------|----------|
| Shutdown completo (Recomendado) | Parar refresh timer, fechar socket, deletar socket file, flush snapshot, exit(0) | ✓ |
| Log + exit rápido | Logar SIGTERM e exit(0) imediatamente, socket file fica no disco | |

**User's choice:** Shutdown completo
**Notes:** Garante que o próximo start encontra cache válido

| Option | Description | Selected |
|--------|-------------|----------|
| Ambos fatais, log + exit(1) (Recomendado) | uncaughtException e unhandledRejection ambos fatais, log stack completo para stderr | ✓ |
| Exception fatal, rejection logar apenas | Só uncaughtException é fatal, rejection só warning | |
| Você decide | Claude escolhe | |

**User's choice:** Ambos fatais, log + exit(1)
**Notes:** Systemd faz restart automaticamente

| Option | Description | Selected |
|--------|-------------|----------|
| Logar com console.error (Recomendado) | Substituir .catch(() => undefined) por .catch com console.error | ✓ |
| Você decide | Claude escolhe | |

**User's choice:** Logar com console.error
**Notes:** Erro vai pro journal do systemd, refresh timer continua normalmente

---

## Timeout Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Per-provider timeout (Recomendado) | Cada provider fetch individual ganha Promise.race com 15s | ✓ |
| Global coordinator timeout | Um único Promise.race no getSnapshot() inteiro (30s) | |
| Ambos (per-provider + global cap) | Timeout individual (15s) + global safety net (45s) | |

**User's choice:** Per-provider timeout
**Notes:** Provider lento retorna error snapshot, os outros continuam

| Option | Description | Selected |
|--------|-------------|----------|
| 15 segundos (Recomendado) | Via GLib.timeout_add_seconds + cancellable + force_exit | ✓ |
| 10 segundos | Mais agressivo, igual ao Codex appserver | |
| 30 segundos | Mais permissivo | |

**User's choice:** 15 segundos
**Notes:** Compatível com per-provider timeout do coordinator

| Option | Description | Selected |
|--------|-------------|----------|
| Manter 10s (Recomendado) | Já funciona, já testado | |
| Alinhar para 15s | Mesmo valor que per-provider timeout | ✓ |
| Você decide | Claude escolhe | |

**User's choice:** Alinhar para 15s
**Notes:** Consistência com per-provider timeout do coordinator

---

## Atomic Write Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Ambos (Recomendado) | snapshot-cache.ts E persistLatestSnapshot em service-server.ts | ✓ |
| Só snapshot-cache.ts | Só o cache de provider snapshots | |
| Você decide | Claude decide o escopo | |

**User's choice:** Ambos
**Notes:** Utility atomicWriteFileSync reutilizado nos dois

---

## GNOME Actor Cleanup Depth

| Option | Description | Selected |
|--------|-------------|----------|
| destroy() nos actors removidos (Recomendado) | Chamar child.destroy() em cada actor removido do _box | ✓ |
| destroy() + limpar GIcons | Destruir actors E limpar Map de _providerIcons a cada render | |
| Você decide | Claude escolhe | |

**User's choice:** destroy() nos actors removidos
**Notes:** GIcon cache mantido — GIcons são leves e reutilizáveis

| Option | Description | Selected |
|--------|-------------|----------|
| Não, removeAll() é suficiente (Recomendado) | PopupMenu.removeAll() já chama destroy() internamente | ✓ |
| Verificar e adicionar se necessário | Ler código de rebuildMenu para confirmar | |
| Você decide | Claude verifica e decide | |

**User's choice:** Não, removeAll() é suficiente
**Notes:** GNOME Shell cuida do lifecycle dos menu items

## Claude's Discretion

- Implementation details of atomicWriteFileSync utility
- Exact error message format in global error handlers
- Whether to add SIGINT handler alongside SIGTERM

## Deferred Ideas

None — discussion stayed within phase scope

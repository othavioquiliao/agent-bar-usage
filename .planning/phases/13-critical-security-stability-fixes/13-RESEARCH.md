# Phase 13: Critical Security & Stability Fixes - Research

**Researched:** 2026-04-05
**Domain:** Security hardening, memory lifecycle (GNOME/Clutter), crash-safe file I/O, process signal handling, timeout enforcement
**Confidence:** HIGH

## Summary

Esta fase corrige 8 problemas (2 security, 6 stability) em dois stacks distintos: o backend TypeScript/Bun e a GNOME Shell extension em GJS. Todos os fixes usam APIs ja disponiveis no runtime -- nenhuma dependencia nova e necessaria.

O vetor de shell injection em `auth-command.ts:225` usa `exec(\`xdg-open ${url}\`)` da stdlib do Node, onde o `url` recebido do GitHub Device Flow poderia conter shell metacharacters. O fix e trivial: substituir por `Bun.spawn(['xdg-open', url])`, pattern ja usado em `subprocess.ts`. O atomic write precisa de `writeFileSync` + `renameSync` no mesmo diretorio, pois `Bun.write` nao garante atomicidade em crash. Os global error handlers (`uncaughtException`, `unhandledRejection`) sao suportados pelo Bun desde v1.x e seguem a mesma API do Node.js. No lado GNOME, o leak de Clutter actors exige `child.destroy()` (nao apenas `remove_child`), e o timeout do backend-client precisa de `GLib.timeout_add_seconds` + `Gio.Cancellable` + `force_exit()`.

**Primary recommendation:** Implementar como 3 plans sequenciais: (1) shell injection + atomic write utility, (2) global error handlers + timeout enforcement no backend, (3) GNOME actor lifecycle + backend-client timeout.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** SIGTERM triggers full graceful shutdown: stop refresh timer, close socket server, delete socket file, flush last snapshot to disk, then `exit(0)`. Ensures next start finds valid cache.
- **D-02:** Both `uncaughtException` and `unhandledRejection` are treated as fatal: log full error stack to stderr (routed to systemd journal) and `exit(1)`. Systemd handles automatic restart.
- **D-03:** Replace silent `.catch(() => undefined)` in `service-server.ts` (lines 169, 271) with `.catch((err) => console.error(...))`. Errors go to journal; refresh timer continues normally on next cycle.
- **D-04:** Backend coordinator uses per-provider timeout (15s) via `Promise.race` in `#resolveSnapshot`. A hanging provider returns an error snapshot while others complete normally. No global coordinator timeout needed.
- **D-05:** GNOME extension backend-client gets a 15s timeout via `GLib.timeout_add_seconds` + `Gio.Cancellable.cancel()` + `subprocess.force_exit()`. If backend doesn't respond in 15s, extension shows error and schedules retry.
- **D-06:** Codex appserver timeout aligned from 10s to 15s for consistency with the per-provider coordinator timeout. Same `setTimeout` + `child.kill()` pattern already in place.
- **D-07:** Atomic write (temp+rename) applied to BOTH `snapshot-cache.ts` and `persistLatestSnapshot` in `service-server.ts`. A shared `atomicWriteFileSync(filePath, data)` utility writes to `${filePath}.${process.pid}.tmp` then `renameSync` to final path.
- **D-08:** Replace `exec(\`xdg-open ${url}\`)` in `auth-command.ts:225` with `Bun.spawn(['xdg-open', url])`. Array form prevents shell metacharacter interpretation.
- **D-09:** In `indicator.js` `_render()`, call `child.destroy()` (not just `remove_child`) on each actor removed from `_box`. `destroy()` recursively destroys all child actors.
- **D-10:** GIcon cache (`_providerIcons` Map) is NOT cleared on re-render -- GIcons are lightweight, reusable, and don't leak Clutter actors. Only cleared in final `destroy()`.
- **D-11:** Menu rebuild via `rebuildMenu` does NOT need explicit `destroy()` -- `PopupMenu.removeAll()` already calls `destroy()` on its items internally. No changes needed there.

### Claude's Discretion
- Implementation details of the `atomicWriteFileSync` utility (error handling, temp file naming)
- Exact error message format in the global error handlers
- Whether to add `SIGINT` handler alongside `SIGTERM` (both are common service signals)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | Fix shell injection em auth-command.ts -- substituir exec(xdg-open) por Bun.spawn array | D-08: `Bun.spawn` array form ja usado em `subprocess.ts`; pattern verificado |
| SEC-02 | Fix silent error swallowing em service-server.ts -- adicionar logging nos .catch() | D-03: linhas 169 e 271 identificadas; `console.error` roteado para journal via systemd |
| STAB-01 | Fix memory leak no GNOME indicator -- destroy() actors antes de limpar | D-09/D-10/D-11: `destroy()` recursivo em Clutter; `PopupMenu.removeAll()` ja faz destroy internamente |
| STAB-02 | Fix race condition no snapshot-cache -- atomic write (temp+rename) | D-07: utility `atomicWriteFileSync` com `writeFileSync` + `renameSync`; aplicada em 2 locais |
| STAB-03 | Adicionar global error handlers no service runtime | D-01/D-02: `uncaughtException`/`unhandledRejection` suportados pelo Bun; SIGTERM chama `runtime.stop()` |
| STAB-04 | Adicionar timeout ao subprocess do GNOME extension backend-client | D-05: `GLib.timeout_add_seconds` + `Gio.Cancellable` + `subprocess.force_exit()` |
| STAB-05 | Adicionar timeout global ao backend coordinator | D-04: `Promise.race` per-provider em `#resolveSnapshot`; 15s timeout; error snapshot on timeout |
| STAB-06 | Adicionar timeout ao Codex appserver subprocess | D-06: `REQUEST_TIMEOUT_MS` de 10000 para 15000; pattern ja implementado |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Platform:** Ubuntu 24.04.4 LTS first, Linux-native shell
- **Backend stack:** Bun + TypeScript
- **Frontend stack:** GNOME Shell extension in GJS
- **Secrets:** Linux secret storage via libsecret/GNOME Keyring only
- **Tests:** Vitest para testes normais, `bun:test` para testes que usam Bun-native APIs (Bun.listen, Bun.file)
- **Commits:** Conventional Commits em Portugues; NUNCA commitar sem perguntar
- **Language:** Responder em Portugues; termos tecnicos em English
- **GSD Workflow:** Usar entry points GSD para modificacoes

## Standard Stack

### Core (Zero New Dependencies)

| Library/API | Version | Purpose | Confidence |
|-------------|---------|---------|------------|
| Bun runtime | 1.3.11 (installed) | Backend runtime, `Bun.spawn` array form, `process.on` handlers | HIGH [VERIFIED: `bun --version`] |
| Node.js `fs` | built-in | `writeFileSync`, `renameSync`, `unlinkSync` for atomic write | HIGH [VERIFIED: codebase already uses these] |
| Vitest | ^3.2.4 (package.json) | Test framework for non-Bun-native tests | HIGH [VERIFIED: `apps/backend/package.json`] |
| `bun:test` | built-in | Test framework for Bun-native tests (service-runtime, settings) | HIGH [VERIFIED: `vitest.config.ts` excludes these] |
| GLib/Gio/St | GNOME 46 (Ubuntu 24.04) | `GLib.timeout_add_seconds`, `Gio.Cancellable`, `St.Widget.destroy()` | HIGH [CITED: gjs.guide/guides/gio/subprocesses.html] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `writeFileSync` + `renameSync` | `Bun.write()` | `Bun.write` NAO garante atomicidade em crash [CITED: bun.com/reference/bun/write] -- oficial docs nao menciona atomic write |
| Manual `Promise.race` | `AbortSignal.timeout()` | `AbortSignal.timeout` nao cancela a promise pendente em Bun; `Promise.race` e mais explicito e testavel |
| `process.on('SIGTERM')` no cli.ts | handler no service-command.ts | Service-command.ts ja tem `process.once('SIGTERM', stop)` -- precisa expandir, nao duplicar |

## Architecture Patterns

### Recommended File Structure for New Code
```
apps/backend/src/utils/
  atomic-write.ts          # NEW: atomicWriteFileSync utility
apps/backend/src/cache/
  snapshot-cache.ts         # MODIFY: usar atomicWriteFileSync no set()
apps/backend/src/service/
  service-server.ts         # MODIFY: usar atomicWriteFileSync em persistLatestSnapshot
  service-command.ts        # MODIFY: expandir graceful shutdown + global error handlers
apps/backend/src/commands/
  auth-command.ts           # MODIFY: exec -> Bun.spawn
apps/gnome-extension/panel/
  indicator.js              # MODIFY: child.destroy() no _render()
apps/gnome-extension/services/
  backend-client.js         # MODIFY: adicionar timeout com GLib + Cancellable
apps/backend/src/providers/codex/
  codex-appserver-fetcher.ts # MODIFY: REQUEST_TIMEOUT_MS 10000 -> 15000
```

### Pattern 1: Atomic Write (temp+rename)
**What:** Write to temp file, then atomic rename to target path
**When to use:** Qualquer write que precisa sobreviver a crash mid-write
**Example:**
```typescript
// Source: POSIX rename() guarantee + Node.js fs API
import { renameSync, unlinkSync, writeFileSync } from 'node:fs';

export function atomicWriteFileSync(filePath: string, data: string): void {
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  try {
    writeFileSync(tmpPath, data, 'utf8');
    renameSync(tmpPath, filePath);
  } catch (error) {
    try { unlinkSync(tmpPath); } catch { /* cleanup best-effort */ }
    throw error;
  }
}
```
[VERIFIED: `renameSync` e POSIX `rename()` -- atomico no mesmo filesystem]

### Pattern 2: Per-Provider Timeout via Promise.race
**What:** Wraps each provider fetch with a timeout race
**When to use:** Prevenir um provider hanging de bloquear todos os outros
**Example:**
```typescript
// Source: Standard Promise.race pattern
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}
```
[VERIFIED: Bun suporta `Promise.race` e `setTimeout` normalmente]

### Pattern 3: GLib Timeout + Cancellable para Subprocess Kill
**What:** Timer que cancela subprocess se nao responder no tempo
**When to use:** GNOME extension chamando backend subprocess
**Example:**
```javascript
// Source: gjs.guide/guides/gio/subprocesses.html
const cancellable = new Gio.Cancellable();
const cancelId = cancellable.connect(() => subprocess.force_exit());

const timeoutId = GLib.timeout_add_seconds(
  GLib.PRIORITY_DEFAULT,
  15,
  () => {
    cancellable.cancel();
    return GLib.SOURCE_REMOVE;
  }
);

try {
  const result = await new Promise((resolve, reject) => {
    subprocess.communicate_utf8_async(null, cancellable, (proc, asyncResult) => {
      try {
        resolve(normalizeCommunicateResult(proc, proc.communicate_utf8_finish(asyncResult)));
      } catch (error) {
        reject(error);
      }
    });
  });
} finally {
  GLib.Source.remove(timeoutId);
  cancellable.disconnect(cancelId);
}
```
[CITED: gjs.guide/guides/gio/subprocesses.html -- `cancellable.connect(() => proc.force_exit())`]

### Pattern 4: Global Error Handlers + Graceful Shutdown
**What:** Captura uncaughtException/unhandledRejection e SIGTERM
**When to use:** Service entry point
**Example:**
```typescript
// Source: Node.js process events API, supported by Bun
process.on('uncaughtException', (error) => {
  console.error('[agent-bar] Fatal uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[agent-bar] Fatal unhandled rejection:', reason);
  process.exit(1);
});
```
[VERIFIED: Bun supports both since ~v1.0 -- github.com/oven-sh/bun/issues/429 closed]

### Anti-Patterns to Avoid
- **Silent `.catch(() => undefined)`:** Engole erros completamente, tornando debugging impossivel. Sempre logar o erro mesmo que a operacao seja best-effort. (Existente nas linhas 169 e 271 de service-server.ts)
- **`exec(string)` para comandos com user input:** Shell interpolation permite injection. Sempre usar array form (`Bun.spawn([cmd, ...args])` ou `execFile`).
- **`remove_child()` sem `destroy()`:** Remove actor do parent mas nao libera o GObject/Clutter resources. Sem `destroy()`, o actor permanece em memoria indefinidamente.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file write | Custom fsync+rename with async | `writeFileSync` + `renameSync` (sync pair) | Sync pair garante sequencia correta; async introduce race conditions [VERIFIED: codebase already uses sync I/O throughout] |
| Subprocess execution | `child_process.exec(string)` | `Bun.spawn([cmd, ...args])` | Array form e immune a shell injection [VERIFIED: pattern em subprocess.ts] |
| Promise timeout | Custom timer management | Simple `Promise.race` + `setTimeout` | Standard, testavel, sem dependencias [VERIFIED: padrao JS] |
| GJS subprocess timeout | Manual timer + polling | `GLib.timeout_add_seconds` + `Gio.Cancellable` | API nativa do GNOME, integrada com event loop [CITED: gjs.guide] |

**Key insight:** Todos os fixes desta fase usam APIs built-in. A tentacao de over-engineer (ex: usar Bun.write para "atomicidade") seria pior que o padrao POSIX classico.

## Common Pitfalls

### Pitfall 1: Temp File no Diretorio Errado
**What goes wrong:** `renameSync` faz cross-device copy em vez de atomic rename
**Why it happens:** Se o temp file esta em `/tmp` e o target em `~/.cache/`, podem estar em filesystems diferentes
**How to avoid:** Temp file DEVE estar no mesmo diretorio do target: `${filePath}.${process.pid}.tmp`
**Warning signs:** `renameSync` retorna sem erro mas fica lento (~ms em vez de ~us)

### Pitfall 2: GNOME Actor Leak no _render()
**What goes wrong:** `remove_child()` remove do parent mas nao destroi o GObject
**Why it happens:** GJS/GObject reference counting nao e garbage collected como JS objects
**How to avoid:** Sempre chamar `child.destroy()` apos `remove_child()`, ou usar `destroy_all_children()` se disponivel
**Warning signs:** `Clutter.Actor` count crescente no Looking Glass (`lg` no GNOME Shell)

### Pitfall 3: Cancellable Nao Mata o Subprocess
**What goes wrong:** `Gio.Cancellable.cancel()` cancela a operacao async (`communicate_utf8_async`) mas NAO mata o processo
**Why it happens:** Design do GIO -- Cancellable cancela a promise, nao o recurso
**How to avoid:** Conectar `cancellable.connect(() => subprocess.force_exit())` ANTES de iniciar o communicate
**Warning signs:** Processos zombies apos timeout

### Pitfall 4: Exit Handler Recursivo
**What goes wrong:** `uncaughtException` handler tenta flush assincrono e causa segundo uncaughtException
**Why it happens:** Handler faz I/O async que falha
**How to avoid:** Handler DEVE ser sync-only: `console.error` + `process.exit(1)`. Nao tentar operacoes async no handler de excecao fatal.
**Warning signs:** Processo trava em vez de morrer

### Pitfall 5: SIGTERM Nao Limpa Socket File
**What goes wrong:** Socket file fica orfao, proximo start falha com EADDRINUSE
**Why it happens:** `process.exit()` chamado sem rodar `runtime.stop()` primeiro
**How to avoid:** SIGTERM handler deve chamar `runtime.stop()` que ja deleta socket file via `unlink`
**Warning signs:** `agent-bar service run` falha apos kill -15

### Pitfall 6: Vitest vs bun:test Confusion
**What goes wrong:** Teste novo usa `bun:test` imports mas e incluido no vitest config, ou vice-versa
**Why it happens:** Codebase usa dois test runners -- vitest para maioria, `bun:test` para testes com Bun-native APIs
**How to avoid:** Testes que usam `Bun.listen`, `Bun.file`, etc devem usar `bun:test` e ser excluidos do `vitest.config.ts`. Testes normais usam vitest.
**Warning signs:** `import { describe } from 'bun:test'` em arquivo nao excluido do vitest

## Code Examples

### SEC-01: Shell Injection Fix
```typescript
// BEFORE (auth-command.ts:224-227) -- VULNERABLE
function defaultOpenBrowser(url: string): void {
  exec(`xdg-open ${url}`, () => {});
}

// AFTER -- SAFE
function defaultOpenBrowser(url: string): void {
  try {
    Bun.spawn(['xdg-open', url], {
      stdout: 'ignore',
      stderr: 'ignore',
    });
  } catch {
    // xdg-open may not be available in all environments
  }
}
```
[VERIFIED: `Bun.spawn` array form usado em subprocess.ts linhas 48-54]

### SEC-02: Silent Error Swallowing Fix
```typescript
// BEFORE (service-server.ts:169)
void refreshSnapshot(true).catch(() => undefined);

// AFTER
void refreshSnapshot(true).catch((err: unknown) => {
  console.error('[agent-bar] Background refresh failed:', err instanceof Error ? err.message : err);
});
```

### STAB-01: GNOME Actor Lifecycle Fix
```javascript
// BEFORE (indicator.js:129-131)
for (const child of this._box.get_children?.() ?? []) {
  this._box.remove_child(child);
}

// AFTER
for (const child of this._box.get_children?.() ?? []) {
  this._box.remove_child(child);
  child.destroy();
}
```
[CITED: gjs.guide/extensions/topics/popup-menu.html -- `destroy()` recursively destroys child actors]

### STAB-02: Atomic Write Utility
```typescript
// NEW FILE: apps/backend/src/utils/atomic-write.ts
import { renameSync, unlinkSync, writeFileSync } from 'node:fs';

export function atomicWriteFileSync(filePath: string, data: string): void {
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  try {
    writeFileSync(tmpPath, data, 'utf8');
    renameSync(tmpPath, filePath);
  } catch (error) {
    try {
      unlinkSync(tmpPath);
    } catch {
      // Cleanup best-effort -- temp file may not have been created
    }
    throw error;
  }
}
```
[VERIFIED: POSIX `rename()` atomico no mesmo filesystem; `process.pid` previne colisao entre processos]

### STAB-03: Graceful Shutdown Expansion
```typescript
// service-command.ts -- runServiceRunCommand expanded
export async function runServiceRunCommand(): Promise<void> {
  const runtime = createAgentBarServiceRuntime({ env: process.env });

  process.on('uncaughtException', (error) => {
    console.error('[agent-bar] Fatal uncaught exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[agent-bar] Fatal unhandled rejection:', reason);
    process.exit(1);
  });

  await runtime.start();
  process.stdout.write(`agent-bar service listening on ${runtime.socketPath}\n`);

  await new Promise<void>((resolve) => {
    const shutdown = async () => {
      await runtime.stop();
      resolve();
    };

    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  });
}
```
[VERIFIED: Bun supports `process.on('uncaughtException')` and `process.on('unhandledRejection')` -- GitHub issue #429 resolved]

### STAB-05: Per-Provider Timeout
```typescript
// backend-coordinator.ts -- wrap fetch in #resolveSnapshot
const PROVIDER_TIMEOUT_MS = 15_000;

// Inside the fetcher callback of getOrFetch:
const fetchWithTimeout = Promise.race([
  adapter.getQuota(context),
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Provider ${adapter.id} timed out after ${PROVIDER_TIMEOUT_MS}ms`)), PROVIDER_TIMEOUT_MS)
  ),
]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `child_process.exec(string)` | `Bun.spawn([...args])` array form | Bun 1.0+ | Immune a shell injection |
| `Bun.write()` for "atomic" writes | `writeFileSync` + `renameSync` | Always true | `Bun.write` nao garante atomicidade em crash |
| `process.on('uncaughtException')` unavailable in Bun | Fully supported | Bun ~1.0 (2023) | Permite global error handling identico ao Node.js |
| GJS `GLib.timeout_add` only | + `Gio.Cancellable.connect(() => proc.force_exit())` | GNOME 3.x+ | Pattern canonico para timeout de subprocessos |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `PopupMenu.removeAll()` chama `destroy()` internamente nos items | Code Examples (STAB-01 / D-11) | Se nao chamar, menu items leakam -- mas referencia gjs.guide confirma [CITED] |
| A2 | `renameSync` em Bun 1.3.11 funciona identico ao Node.js `fs.renameSync` | Architecture Patterns | Se bugado, atomic write falharia silenciosamente -- risco baixo dado que codebase ja usa `fs` sync ops |
| A3 | `runtime.stop()` em service-server.ts deleta o socket file | Pitfall 5 | Codigo inspecionado: `stop()` chama `server.stop()` mas NAO chama `unlink(socketPath)` explicitamente -- pode precisar adicionar |

**NOTA sobre A3:** Inspecionei `service-server.ts:stop()` -- ele chama `server.stop()` e `clearRefreshTimer()`, mas NAO faz `unlink(socketPath)`. O `start()` faz `unlink` no inicio se o socket existe. Isso significa que entre crash e restart o socket orfao existe, mas e limpo no proximo start. O graceful shutdown (D-01) deveria adicionar `unlink` explicitamente no stop para hygiene, mas o sistema ja tolera o caso.

## Open Questions (RESOLVED)

1. **SIGINT no service-command.ts**
   - What we know: `service-command.ts` ja tem `process.once('SIGINT', stop)` no `runServiceRunCommand`
   - What's unclear: Decisao D-01 menciona SIGTERM mas nao SIGINT explicitamente; Claude's Discretion inclui "Whether to add SIGINT handler alongside SIGTERM"
   - RESOLVED: Manter SIGINT que ja existe; e o padrao para `Ctrl+C` durante dev. Adicionar SIGTERM handler com a mesma logica. Implementado no Plan 02, Task 1.

2. **Socket file cleanup no stop()**
   - What we know: `start()` faz `unlink` do socket antes de abrir; `stop()` nao faz `unlink`
   - What's unclear: Se D-01 espera que `stop()` delete o socket file ou se o `unlink` no proximo `start()` e suficiente
   - RESOLVED: Adicionar `unlink(socketPath)` no `stop()` como parte do graceful shutdown (D-01 diz "delete socket file"). Implementado no Plan 02, Task 1.

3. **Flush do snapshot no graceful shutdown**
   - What we know: D-01 diz "flush last snapshot to disk"; `rememberSnapshot` ja faz `persistLatestSnapshot`
   - What's unclear: Se precisa flush explicitamente no shutdown ou se o ultimo `rememberSnapshot` ja e suficiente
   - RESOLVED: Se `lastSnapshot !== null`, chamar `persistLatestSnapshot` uma vez no shutdown antes de exit. Protege contra cenario onde snapshot esta em memoria mas nao foi persistido. Implementado no Plan 02, Task 1.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 + bun:test (dual) |
| Config file | `apps/backend/vitest.config.ts` |
| Quick run command | `cd apps/backend && bun run vitest run --config vitest.config.ts` |
| Full suite command | `cd apps/backend && bun run vitest run --config vitest.config.ts && bun test test/service-runtime.test.ts test/settings.test.ts` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | `defaultOpenBrowser` usa `Bun.spawn` array, nao `exec` string | unit | `bun run vitest run test/commands/auth-command.test.ts -x` | Existe parcialmente -- testa auth flow mas nao `openBrowser` diretamente |
| SEC-02 | `.catch` handlers logam erros em vez de engolir | unit | `bun test test/service-runtime.test.ts` | Existe parcialmente -- testa runtime mas nao error logging |
| STAB-01 | `_render()` chama `destroy()` nos actors removidos | manual-only | N/A -- requer GNOME Shell session | Nao existe |
| STAB-02 | Atomic write sobrevive crash mid-write | unit | `bun run vitest run test/atomic-write.test.ts -x` | Wave 0 -- precisa criar |
| STAB-03 | `uncaughtException`/`unhandledRejection` logam e exitam | unit | `bun test test/service-runtime.test.ts` | Wave 0 -- precisa adicionar test case |
| STAB-04 | Backend-client timeout via GLib + Cancellable | manual-only | N/A -- requer GJS runtime | Nao existe |
| STAB-05 | Per-provider timeout via Promise.race | unit | `bun run vitest run test/provider-isolation.test.ts -x` | Existe parcialmente -- testa isolacao mas nao timeout |
| STAB-06 | Codex appserver timeout = 15s | unit | `bun run vitest run test/providers/codex/codex-appserver-fetcher.test.ts -x` | Existe -- testa mapToSnapshot/formatResetLabel |

### Sampling Rate
- **Per task commit:** `cd apps/backend && bun run vitest run --config vitest.config.ts`
- **Per wave merge:** Full suite (vitest + bun test excludes)
- **Phase gate:** Full suite green antes de `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `apps/backend/test/atomic-write.test.ts` -- covers STAB-02 (write, rename, cleanup on error)
- [ ] Expand `test/service-runtime.test.ts` -- covers STAB-03 (global handlers log + exit)
- [ ] Expand `test/commands/auth-command.test.ts` -- covers SEC-01 (verify `openBrowser` uses Bun.spawn not exec)
- [ ] Expand `test/provider-isolation.test.ts` or new `test/coordinator-timeout.test.ts` -- covers STAB-05 (provider timeout via Promise.race)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A (auth flow nao modificado, apenas xdg-open) |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A |
| V5 Input Validation | yes | SEC-01: URL input sanitizado via array form (nao shell interpolation) |
| V6 Cryptography | no | N/A |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Shell injection via crafted URL | Elevation of Privilege | Array-form subprocess spawn (`Bun.spawn(['xdg-open', url])`) [D-08] |
| Silent error swallowing masks attacks | Information Disclosure (inverted) | Log all errors to stderr/journal [D-03] |
| Crash-corrupted cache leads to service failure | Denial of Service | Atomic write (temp+rename) [D-07] |
| Hanging provider blocks all snapshots | Denial of Service | Per-provider timeout via Promise.race [D-04] |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | Backend runtime | Yes | 1.3.11 | -- |
| Node.js | Vitest + GSD scripts | Yes | v25.7.0 | -- |
| Vitest | Test runner | Yes | ^3.2.4 (package.json) | -- |
| GNOME Shell | Extension testing | No (dev machine not Ubuntu) | -- | Manual test on Ubuntu |
| GJS | Extension runtime | No (dev machine not Ubuntu) | -- | Manual test on Ubuntu |

**Missing dependencies with no fallback:**
- GNOME Shell / GJS: STAB-01 e STAB-04 nao podem ser testados automaticamente nesta maquina. Requerem validacao manual em sessao GNOME Shell no Ubuntu 24.04.

**Missing dependencies with fallback:**
- Nenhum

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `auth-command.ts`, `service-server.ts`, `snapshot-cache.ts`, `backend-coordinator.ts`, `codex-appserver-fetcher.ts`, `indicator.js`, `backend-client.js`, `service-command.ts`, `subprocess.ts`, `cli.ts`
- [gjs.guide/guides/gio/subprocesses.html](https://gjs.guide/guides/gio/subprocesses.html) -- GJS subprocess cancellation with `Gio.Cancellable` + `force_exit()`
- [gjs.guide/guides/gjs/asynchronous-programming.html](https://gjs.guide/guides/gjs/asynchronous-programming.html) -- `GLib.timeout_add_seconds`, `GLib.Source.remove`
- [gjs.guide/extensions/topics/popup-menu.html](https://gjs.guide/extensions/topics/popup-menu.html) -- `PopupMenu.removeAll()` destroys items
- [bun.com/reference/bun/write](https://bun.com/reference/bun/write) -- `Bun.write` docs (no atomicity guarantee)
- [bun.com/reference/node/fs/writeFileSync](https://bun.com/reference/node/fs/writeFileSync) -- Bun Node.js compat layer

### Secondary (MEDIUM confidence)
- [GitHub oven-sh/bun#429](https://github.com/oven-sh/bun/issues/429) -- `process.on('uncaughtException')` and `process.on('unhandledRejection')` now supported
- [GitHub oven-sh/bun#5219](https://github.com/oven-sh/bun/issues/5219) -- uncaughtException event confirmed working
- [gjs.guide/extensions/review-guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html) -- GNOME extension review requirements

### Tertiary (LOW confidence)
- Nenhuma claim depende apenas de fontes terciarias

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all APIs verified in codebase or official docs
- Architecture: HIGH -- all patterns verified against existing code and official documentation
- Pitfalls: HIGH -- derived from direct code inspection + GJS official guides

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable -- no fast-moving dependencies)

# Architecture Research: v2.1 Stability & Hardening Integration

**Domain:** Linux-native AI provider usage monitor -- stability fixes across Bun/TS backend + GNOME Shell extension (GJS)
**Researched:** 2026-04-05
**Confidence:** HIGH

## Current Architecture (Baseline)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    GNOME Shell Extension (GJS)                          │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────────────┐ │
│  │  Indicator   │  │ PollingService│  │   BackendClient              │ │
│  │  (top bar)   │  │ (timer loop)  │  │   (Gio.Subprocess → CLI)    │ │
│  └──────┬───────┘  └───────┬───────┘  └──────────────┬───────────────┘ │
│         │                  │                         │                 │
│         │    state push    │    fetchUsageSnapshot()  │                 │
│         ├──────────────────┤                         │                 │
├─────────┴──────────────────┴─────────────────────────┴─────────────────┤
│                       IPC Boundary                                     │
│            Gio.Subprocess → `agent-bar service snapshot --json`         │
│            or fallback `node --import tsx cli.ts usage --json`          │
├────────────────────────────────────────────────────────────────────────┤
│                    Backend Service (Bun + TypeScript)                   │
│  ┌─────────────┐  ┌─────────────────────┐  ┌───────────────────────┐  │
│  │  CLI Router  │  │  BackendCoordinator │  │  SnapshotCache        │  │
│  │  (cli.ts)    │  │  (orchestration)    │  │  (XDG file-backed)    │  │
│  └──────┬───────┘  └──────────┬──────────┘  └───────────┬───────────┘  │
│         │                     │                         │              │
│  ┌──────┴───────┐  ┌─────────┴────────────────────┐    │              │
│  │ ServiceServer│  │  Provider Registry            │    │              │
│  │ (Bun.listen  │  │  ┌─────────┐ ┌──────┐ ┌─────┐│    │              │
│  │  Unix socket)│  │  │ Copilot │ │Codex │ │Claude││    │              │
│  └──────────────┘  │  └─────────┘ └──────┘ └─────┘│    │              │
│                    └───────────────────────────────┘    │              │
├────────────────────────────────────────────────────────┴──────────────┤
│              Persistence: XDG cache + config + GNOME Keyring           │
└────────────────────────────────────────────────────────────────────────┘
```

## v2.1 Integration Map: Issues to Architecture Points

The 24 audit issues map to **6 distinct integration zones** in the architecture. Understanding these zones determines build order.

### Zone 1: GNOME Indicator Actor Lifecycle (CRITICAL)

**Current problem:** `indicator.js` `_render()` removes children from `_box` without calling `.destroy()` on them. GJS actors hold C-side references -- removing from parent does NOT free them. Each re-render leaks `St.BoxLayout`, `St.Bin`, `St.Icon`, and `St.Label` actors.

**File:** `apps/gnome-extension/panel/indicator.js`

**Integration point:** `_render()` method (lines 125-167)

**Current flow:**
```
_render() → _box.remove_child(child) → _providerActors.clear()
             ^--- LEAK: child actors not destroyed
```

**Required change:** Destroy actor hierarchy before removal.

**New flow:**
```
_render() → for each child: child.destroy() → _providerActors.clear() → rebuild
```

**New component needed:** None. This is a fix within the existing `_render()` method.

**Pattern to follow:** Per GJS memory management best practices, every `St.Widget` or `Clutter.Actor` must have `.destroy()` called before its reference is dropped. The existing `destroy()` method at line 169 does call `this.menu?.removeAll()` but the `_render()` path skips actor destruction entirely.

**Specific fix:**
```javascript
// In _render(), before clearing providerActors:
for (const [_id, slot] of this._providerActors) {
  slot.container.destroy();  // destroys icon, iconBox, usageLabel children too
}
this._providerActors.clear();

// For orphan children already in _box that are NOT tracked in _providerActors:
for (const child of this._box.get_children?.() ?? []) {
  child.destroy();
}
```

**Dependencies:** None. Fully self-contained.

### Zone 2: Shell Injection in Auth Command (CRITICAL)

**Current problem:** `auth-command.ts` line 225 uses `exec(\`xdg-open ${url}\`)` which interpolates the URL into a shell string. A crafted verification URL could inject arbitrary shell commands.

**File:** `apps/backend/src/commands/auth-command.ts`

**Integration point:** `defaultOpenBrowser()` function (line 224-227)

**Current flow:**
```
defaultOpenBrowser(url) → exec(`xdg-open ${url}`) → shell interpolation
```

**Required change:** Replace `exec` with `execFile` or `Bun.spawn` which pass arguments as arrays, bypassing shell interpolation entirely.

**New flow:**
```
defaultOpenBrowser(url) → Bun.spawn(['xdg-open', url]) → no shell interpolation
```

**New component needed:** None. Single-function fix.

**Specific fix:**
```typescript
function defaultOpenBrowser(url: string): void {
  try {
    Bun.spawn(['xdg-open', url], {
      stdout: 'ignore',
      stderr: 'ignore',
      stdin: 'ignore',
    });
  } catch {
    // Intentionally silent — xdg-open may not be available
  }
}
```

**Dependencies:** None. Fully self-contained.

### Zone 3: Snapshot Cache Race Condition (CRITICAL)

**Current problem:** `snapshot-cache.ts` line 73 uses `writeFileSync()` directly. If the process crashes mid-write or two concurrent writes overlap, the JSON file becomes corrupted. The `getOrFetch()` inflight deduplication (lines 93-106) mitigates concurrent fetches within a single process, but does NOT protect the file write itself.

**File:** `apps/backend/src/cache/snapshot-cache.ts`

**Integration point:** `set()` method (lines 65-76) and `persistLatestSnapshot()` in `service-server.ts` (line 100-103)

**Current flow:**
```
set() → writeFileSync(path, json) → direct overwrite (non-atomic)
persistLatestSnapshot() → writeFileSync(path, json) → direct overwrite (non-atomic)
```

**Required change:** Implement atomic write: write to temp file in same directory, then `rename()`. On Linux, `rename()` on the same filesystem is atomic -- the file is either the old version or the new version, never a partial write.

**New flow:**
```
set() → Bun.write(tempPath, json) → rename(tempPath, path) → atomic swap
```

**New component needed:** `atomicWriteFileSync()` utility function in `apps/backend/src/utils/` (or inline in cache module). This is a shared helper since both `snapshot-cache.ts` and `service-server.ts` need atomic writes.

**Specific pattern:**
```typescript
import { renameSync, unlinkSync } from 'node:fs';

function atomicWriteFileSync(filePath: string, content: string): void {
  const tempPath = `${filePath}.${process.pid}.tmp`;
  try {
    writeFileSync(tempPath, content, 'utf8');
    renameSync(tempPath, filePath);
  } catch (error) {
    try { unlinkSync(tempPath); } catch {}
    throw error;
  }
}
```

**Dependencies:** None for implementation. Should be introduced as a utility before the cache and service-server fixes consume it.

**Integration note:** `service-server.ts` `persistLatestSnapshot()` at line 100-103 has the identical problem and must also switch to `atomicWriteFileSync()`.

### Zone 4: Global Error Handlers in Service Runtime (CRITICAL)

**Current problem:** `service-server.ts` `createAgentBarServiceRuntime()` has no global `uncaughtException` / `unhandledRejection` handlers. If an unhandled error propagates from a provider fetch, socket handler, or timer callback, the service silently dies. The systemd unit may or may not restart it depending on configuration.

**File:** `apps/backend/src/service/service-server.ts` (runtime) and `apps/backend/src/commands/service-command.ts` (entry)

**Integration point:** `runServiceRunCommand()` in service-command.ts (lines 83-99) -- the process-level entry point for `agent-bar service run`.

**Current flow:**
```
runServiceRunCommand() → runtime.start() → listen on socket
  ↓ (uncaught error)
  Process crashes silently. No log. No cleanup.
```

**Required change:** Register global error handlers before `runtime.start()`. Log the error. Attempt graceful shutdown. Exit with non-zero code so systemd can restart.

**New flow:**
```
runServiceRunCommand()
  → register process.on('uncaughtException', handler)
  → register process.on('unhandledRejection', handler)
  → runtime.start()
  ↓ (uncaught error)
  Log error → runtime.stop() → process.exit(1)
```

**New component needed:** None as a separate module. The handlers are registered inline in `runServiceRunCommand()`. Optionally, a small `installGlobalErrorHandlers(cleanup: () => Promise<void>)` helper could be extracted to `apps/backend/src/utils/` for reuse.

**Bun compatibility:** Bun supports `process.on('uncaughtException')` and `process.on('unhandledRejection')` since v1.1.8. HIGH confidence -- verified via Bun release notes and Sentry integration docs.

**Dependencies:** None. Self-contained addition to the service startup path.

### Zone 5: Subprocess Timeouts (HIGH -- 3 separate fixes)

Three distinct locations need subprocess timeout enforcement:

#### 5a. GNOME Extension BackendClient (no timeout)

**Current problem:** `backend-client.js` `runGioSubprocess()` calls `communicate_utf8_async()` without a `Gio.Cancellable`. If the backend hangs, the extension freezes indefinitely since the polling service awaits the promise.

**File:** `apps/gnome-extension/services/backend-client.js`

**Integration point:** `runGioSubprocess()` function (lines 45-75)

**Current flow:**
```
runGioSubprocess(argv) → launcher.spawnv(argv) → communicate_utf8_async(null, null, callback)
                                                   ^--- no cancellable, no timeout
```

**Required change:** Add a `Gio.Cancellable` with a `GLib.timeout_add()` that triggers `force_exit()` after a configurable timeout (default 30s).

**New flow:**
```
runGioSubprocess(argv, { timeoutMs })
  → launcher.spawnv(argv)
  → GLib.timeout_add(PRIORITY_DEFAULT, timeoutMs, () => { proc.force_exit(); return false; })
  → communicate_utf8_async(null, cancellable, callback)
  → on completion: GLib.Source.remove(timeoutSourceId)
```

**Critical GJS subtlety:** `Gio.Cancellable.cancel()` does NOT kill the subprocess -- it only cancels the async operation. You MUST call `proc.force_exit()` explicitly. The timeout should call both `cancellable.cancel()` and `proc.force_exit()`.

**New component needed:** None as a separate module. The timeout logic lives inside `runGioSubprocess()`.

**Dependencies:** None. Self-contained.

#### 5b. BackendCoordinator (no global timeout)

**Current problem:** `backend-coordinator.ts` `#resolveSnapshot()` calls `adapter.isAvailable()` and `adapter.getQuota()` with no per-provider timeout. If a provider adapter hangs (e.g., waiting for a CLI subprocess that never responds), the entire snapshot generation blocks indefinitely.

**File:** `apps/backend/src/core/backend-coordinator.ts`

**Integration point:** `#resolveSnapshot()` method (lines 67-153) -- specifically the `adapter.isAvailable()` (line 117) and `adapter.getQuota()` (line 141) calls.

**Current flow:**
```
#resolveSnapshot() → adapter.isAvailable(context) → no timeout
                   → adapter.getQuota(context) → no timeout
```

**Required change:** Wrap provider calls in a `Promise.race()` with a timeout, or use `AbortSignal.timeout()` (Bun supports this). A per-provider timeout of 30s is appropriate since CLI-based providers (Codex app-server, Claude) already have their own internal timeouts but those can fail to fire.

**New flow:**
```
#resolveSnapshot()
  → Promise.race([adapter.isAvailable(context), timeout(30_000)])
  → Promise.race([adapter.getQuota(context), timeout(30_000)])
  → on timeout: return error snapshot with 'provider_timeout' code
```

**New component needed:** A small `withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T>` utility. This should go in `apps/backend/src/utils/` since it is useful beyond just the coordinator.

**Dependencies:** None for implementation. The utility should exist before the coordinator fix.

#### 5c. Codex Appserver Subprocess (can dangle after settle)

**Current problem:** `codex-appserver-fetcher.ts` has a `settle()` function that calls `child.kill()` -- but the `child.stdout` reader loop (lines 182-192) continues running after settle. The `while(true)` async reader only checks `settled` after each `read()` call. If the child process doesn't close stdout promptly after kill, the reader hangs.

**File:** `apps/backend/src/providers/codex/codex-appserver-fetcher.ts`

**Integration point:** `fetchCodexUsageViaAppServer()` function (lines 64-218)

**Current flow:**
```
settle() → clearTimeout(timer) → child.kill() → resolve(snapshot)
  BUT: async reader loop still running → may hang on reader.read()
```

**Required change:** After `child.kill()`, cancel the reader explicitly. Use `reader.cancel()` to abort the pending `read()`. Additionally, ensure `child.exited` promise resolves cleanup so no dangling process reference remains.

**New flow:**
```
settle() → clearTimeout(timer) → child.kill() → reader.cancel() → resolve(snapshot)
```

**New component needed:** None. Fix within the existing function.

**Dependencies:** None. Self-contained.

### Zone 6: Cross-Cutting Concerns (Supporting fixes)

These are not separate integration points but patterns that span multiple zones:

#### 6a. Error Logging Consistency

The service-server currently logs to `console.error` (line 265). After adding global error handlers, all service-level logging should use a consistent pattern. No new component needed -- just ensure the global handler uses the same format.

#### 6b. Subprocess Utility Consolidation

`apps/backend/src/utils/subprocess.ts` already has a `runSubprocess()` with a configurable `timeoutMs` (default 15s). The backend coordinator should route through this when calling provider adapters that use subprocess execution, rather than having each adapter manage its own timeout independently.

#### 6c. Atomic Write Utility Sharing

Both `snapshot-cache.ts` and `service-server.ts` need atomic file writes. The utility should be a single shared helper to avoid duplication.

## Component Change Summary

| Component | File | Change Type | Zone |
|-----------|------|-------------|------|
| Indicator._render() | indicator.js | **Modify** -- add actor.destroy() | 1 |
| Indicator.destroy() | indicator.js | **Verify** -- already adequate | 1 |
| defaultOpenBrowser() | auth-command.ts | **Modify** -- exec to Bun.spawn | 2 |
| atomicWriteFileSync() | utils/atomic-write.ts | **New** -- shared utility | 3 |
| SnapshotCache.set() | snapshot-cache.ts | **Modify** -- use atomic write | 3 |
| persistLatestSnapshot() | service-server.ts | **Modify** -- use atomic write | 3 |
| runServiceRunCommand() | service-command.ts | **Modify** -- add global handlers | 4 |
| runGioSubprocess() | backend-client.js | **Modify** -- add Gio.Cancellable + timeout | 5a |
| BackendCoordinator.#resolveSnapshot() | backend-coordinator.ts | **Modify** -- add per-provider timeout | 5b |
| withTimeout() | utils/timeout.ts | **New** -- small utility | 5b |
| fetchCodexUsageViaAppServer() | codex-appserver-fetcher.ts | **Modify** -- cancel reader on settle | 5c |

**Summary: 2 new files, 8 modified files.**

## Data Flow Changes

### Before v2.1 (Current)

```
PollingService
  → BackendClient.fetchUsageSnapshot()     [NO timeout]
    → Gio.Subprocess: agent-bar service snapshot --json   [NO timeout]
      → ServiceServer handles request
        → BackendCoordinator.getSnapshot()   [NO timeout per provider]
          → adapter.getQuota()               [NO timeout]
          → cache.set()                      [non-atomic write]
        → socket.write(response)
  → state update → Indicator._render()       [leaks actors]
```

### After v2.1

```
PollingService
  → BackendClient.fetchUsageSnapshot()     [30s Gio.Cancellable + force_exit]
    → Gio.Subprocess: agent-bar service snapshot --json   [killed on timeout]
      → ServiceServer handles request       [global error handlers installed]
        → BackendCoordinator.getSnapshot()
          → withTimeout(adapter.getQuota(), 30_000)  [per-provider timeout]
          → cache.set() → atomicWriteFileSync()     [atomic write-then-rename]
        → socket.write(response)
  → state update → Indicator._render()       [destroy old actors before rebuild]
```

### New Error Paths

1. **GNOME subprocess timeout:** PollingService receives a `BackendClientError` with timeout info. Extension state transitions to `error`. Retry logic kicks in via existing `retryDelays` mechanism.

2. **Provider adapter timeout:** BackendCoordinator catches the timeout, returns an error snapshot with `code: 'provider_timeout'`. Other providers still complete normally.

3. **Codex appserver reader hang:** Reader is cancelled via `reader.cancel()`. Settle function fires with timeout error snapshot. No dangling process.

4. **Service crash (uncaught):** Global handler logs error, calls `runtime.stop()`, exits with code 1. systemd restarts the service per `Restart=on-failure`.

5. **Cache write failure:** Atomic write fails at rename step. Old cache file is preserved (not corrupted). Temp file is cleaned up. Error propagates to caller which produces a fresh fetch on next request.

## Suggested Build Order

The build order follows **dependency chains and risk reduction**: fix the most dangerous issues first, create shared utilities before consumers, and handle independent zones in parallel.

### Phase 1: Critical Security + Shared Utilities (Foundation)

**Rationale:** Shell injection is the only exploitable vulnerability. Atomic write utility is a prerequisite for Zone 3. Both are small, independent, and unblock later work.

| Order | Task | Zone | Depends On | Est. Complexity |
|-------|------|------|------------|-----------------|
| 1.1 | Fix shell injection in `defaultOpenBrowser()` | 2 | Nothing | Low |
| 1.2 | Create `atomicWriteFileSync()` utility | 3 | Nothing | Low |
| 1.3 | Create `withTimeout()` utility | 5b | Nothing | Low |

### Phase 2: Critical Runtime Stability (Backend)

**Rationale:** Cache race condition and global error handlers protect against data corruption and silent service death. These affect every user on every service cycle.

| Order | Task | Zone | Depends On | Est. Complexity |
|-------|------|------|------------|-----------------|
| 2.1 | Atomic writes in `snapshot-cache.ts` | 3 | 1.2 (utility) | Low |
| 2.2 | Atomic writes in `service-server.ts` | 3 | 1.2 (utility) | Low |
| 2.3 | Global error handlers in `runServiceRunCommand()` | 4 | Nothing | Low |

### Phase 3: Subprocess Timeouts (Backend + Extension)

**Rationale:** All three subprocess timeout fixes are HIGH severity but independent of each other. They can be done in parallel. The GNOME extension fix requires GJS-specific patterns (Gio.Cancellable) distinct from the Bun backend fixes.

| Order | Task | Zone | Depends On | Est. Complexity |
|-------|------|------|------------|-----------------|
| 3.1 | Per-provider timeout in `BackendCoordinator` | 5b | 1.3 (utility) | Medium |
| 3.2 | Gio.Subprocess timeout in `BackendClient` | 5a | Nothing | Medium |
| 3.3 | Cancel reader in `codex-appserver-fetcher` | 5c | Nothing | Low |

### Phase 4: GNOME Memory Leak (Extension)

**Rationale:** Memory leak is CRITICAL severity but lower urgency than security/corruption -- the leak only accumulates over long sessions. It requires careful GJS actor lifecycle understanding and should be tested on a real GNOME desktop.

| Order | Task | Zone | Depends On | Est. Complexity |
|-------|------|------|------------|-----------------|
| 4.1 | Destroy actors in `Indicator._render()` | 1 | Nothing | Medium |
| 4.2 | Verify `Indicator.destroy()` cleanup completeness | 1 | 4.1 | Low |

### Build Order Rationale

```
Phase 1 (Foundation)  ─→  Phase 2 (Runtime Stability)  ─→  Phase 3 (Timeouts)
    ↓                                                           ↓
    └────────────────────────────────────────────────→  Phase 4 (Memory Leak)
```

- **Phase 1 before 2:** Atomic write utility must exist before cache and server consume it.
- **Phase 1 before 3:** Timeout utility must exist before coordinator consumes it.
- **Phase 2 before 3:** Stabilize the service process (error handlers) before adding timeout complexity that generates new error paths.
- **Phase 3 parallel:** All three timeout fixes are independent. Backend (5b, 5c) and extension (5a) can be developed in parallel.
- **Phase 4 last:** The memory leak is in the extension UI layer which is the outermost ring. It has zero dependencies on backend changes and benefits from stable backend behavior underneath.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Destroying Children via Parent Removal

**What people do:** Call `parent.remove_child(child)` and assume GJS frees the actor.
**Why it's wrong:** GJS actors have C-side reference counts. Removal from parent decrements one ref but the JS wrapper may hold another. The actor and its GL resources are never freed.
**Do this instead:** Always call `child.destroy()` before dropping the reference. `destroy()` recursively destroys children.

### Anti-Pattern 2: Shell String Interpolation for External Commands

**What people do:** ``exec(`command ${userInput}`)``
**Why it's wrong:** Any special shell characters in the input become executable code.
**Do this instead:** Use `Bun.spawn([command, arg1, arg2])` or `execFile(command, [arg1, arg2])` which pass arguments as arrays to the OS directly, bypassing shell interpretation.

### Anti-Pattern 3: Direct `writeFileSync` for State Persistence

**What people do:** `writeFileSync(path, json)` assuming it's atomic.
**Why it's wrong:** If the process crashes mid-write (or the disk is full), the file is truncated/corrupt. Next startup reads garbage and fails.
**Do this instead:** Write to `${path}.tmp` then `renameSync(tmp, path)`. `rename()` is atomic on Linux within the same filesystem.

### Anti-Pattern 4: Cancellable Without force_exit in GJS

**What people do:** Pass a `Gio.Cancellable` to `communicate_utf8_async()` and assume cancelling it kills the subprocess.
**Why it's wrong:** GJS `Gio.Cancellable.cancel()` only cancels the async operation, NOT the subprocess. The child process keeps running.
**Do this instead:** Connect the cancellable to `proc.force_exit()` explicitly, or call `force_exit()` in the timeout handler alongside cancel.

## Integration Boundaries

### Internal Boundaries

| Boundary | Communication | v2.1 Change |
|----------|---------------|-------------|
| GNOME Extension -> Backend | Gio.Subprocess (stdout JSON) | Add 30s timeout + force_exit |
| PollingService -> BackendClient | Promise-based async | No change (timeout is in BackendClient) |
| Indicator -> State | setState() push | No change (render fix is internal) |
| CLI -> ServiceServer | Bun.connect Unix socket | No change |
| BackendCoordinator -> Adapters | async adapter.getQuota() | Wrap in withTimeout(30s) |
| SnapshotCache -> Filesystem | writeFileSync | Switch to atomicWriteFileSync |
| ServiceServer -> Filesystem | writeFileSync | Switch to atomicWriteFileSync |

### External Boundaries

| Boundary | Integration | v2.1 Change |
|----------|-------------|-------------|
| auth-command -> xdg-open | exec() shell call | Replace with Bun.spawn array |
| codex-appserver -> codex CLI | Bun.spawn + JSONRPC | Add reader.cancel() on settle |
| Service -> systemd | Restart=on-failure | Benefits from non-zero exit on crash |

## Sources

- [GJS Memory Management Guide](https://gjs.guide/guides/gjs/memory-management.html) -- actor lifecycle, destroy patterns, reference counting
- [GNOME Shell Extensions Review Guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html) -- enable/disable contract, mandatory cleanup
- [GJS Subprocesses Guide](https://gjs.guide/guides/gio/subprocesses.html) -- Gio.Cancellable + force_exit pattern
- [Bun v1.1.8 Release Notes](https://bun.sh/blog/bun-v1.1.8) -- process.on uncaughtException support
- [Bun.write API Reference](https://bun.com/reference/bun/write) -- file I/O capabilities and limitations
- [write-file-atomic (npm)](https://github.com/npm/write-file-atomic) -- atomic write-then-rename pattern reference
- [Gio.Subprocess GTK Docs](https://docs.gtk.org/gio/class.Subprocess.html) -- force_exit, cancellable behavior

---
*Architecture research for: v2.1 Stability & Hardening*
*Researched: 2026-04-05*

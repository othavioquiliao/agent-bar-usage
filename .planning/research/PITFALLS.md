# Pitfalls Research

**Domain:** Stability and hardening fixes for an existing Bun/TypeScript backend + GNOME Shell extension (GJS)
**Researched:** 2026-04-05
**Confidence:** HIGH (issues verified against actual codebase; GJS/systemd/Bun patterns verified via official docs and community sources)

## Critical Pitfalls

### Pitfall 1: GJS Actor Leak on Re-render -- `remove_child` Does Not `destroy()`

**What goes wrong:**
The current `indicator.js` `_render()` method (line 129-131) iterates `this._box.get_children()`, calls `remove_child(child)` on each, then calls `this._providerActors.clear()`. **Removing a Clutter actor from its parent does NOT destroy it.** The actor (St.BoxLayout, St.Label, St.Icon, St.Bin) remains alive in memory, referenced by no JavaScript variable but still tracked by Clutter's internal allocation system. Each call to `setState()` triggers `_render()`, which creates 3 new provider slots (each with ~4 actors) and orphans 3 old ones. With a 2.5-minute polling interval, this leaks ~70 actors per hour. Over a desktop session of 8+ hours, this causes visible GNOME Shell sluggishness.

**Why it happens:**
In GTK, removing a widget from a container usually triggers its disposal. In Clutter/St (the GNOME Shell toolkit), `remove_child()` only detaches the actor from the parent's child list. The actor must be explicitly `destroy()`-ed to release its GPU texture, CSS style references, and GObject allocation. Developers coming from web/React backgrounds expect "remove from DOM" to be equivalent to "garbage collect," but Clutter does not work that way.

**How to avoid:**
Call `child.destroy()` after `remove_child(child)` in `_render()`. The correct pattern is:

```javascript
for (const child of this._box.get_children?.() ?? []) {
  this._box.remove_child(child);
  child.destroy();
}
```

However, there is a subtlety: do NOT access the child after `destroy()` -- this triggers a critical GJS error ("Object has been already deallocated"). If any code holds a reference to the old actors (e.g., the `_providerActors` Map), those references must be nulled BEFORE iterating, or the Map must be cleared BEFORE destroy.

The safer pattern is to cache the actors, clear the map, then destroy:

```javascript
const staleActors = [...(this._box.get_children?.() ?? [])];
this._providerActors.clear();
for (const actor of staleActors) {
  this._box.remove_child(actor);
  actor.destroy();
}
```

**Warning signs:**
- GNOME Shell memory usage grows linearly over time (`gnome-shell` process in `top`)
- GJS log shows "Object Meta.* has been already deallocated" critical errors
- GNOME Shell becomes sluggish after several hours with agent-bar enabled
- Disabling and re-enabling the extension temporarily fixes the sluggishness

**Phase to address:**
Phase 1 (Critical Fixes) -- this is the highest-priority memory leak and the most impactful single fix.

---

### Pitfall 2: Atomic File Write -- Same-Directory Temp File Requirement and fsync Gap

**What goes wrong:**
The current `snapshot-cache.ts` (line 73) and `service-server.ts` (line 102) both use `writeFileSync(path, data)` directly. This is a non-atomic write: if the process crashes, is killed, or the system loses power during the write, the file is left in a partially-written (corrupt) state. When the service restarts, it reads the corrupt JSON and `JSON.parse` throws, losing the cached data silently (the `catch {}` on line 60 swallows the error).

The fix is "write to temp file, then rename." But this pattern has three gotchas that developers commonly miss:

1. **EXDEV (cross-device rename):** If the temp file is created in `/tmp` but the target is in `~/.cache/agent-bar/`, and `/tmp` is a separate tmpfs mount (common on Ubuntu), `fs.renameSync()` throws `EXDEV: cross-device link not permitted`. The temp file MUST be in the same directory as the target.

2. **Missing fsync before rename:** Without `fsync()` on the temp file's fd before renaming, the data may still be in the kernel's page cache. A power failure after rename but before the data is flushed to disk leaves a zero-length or corrupt file at the target path.

3. **Temp file cleanup on failure:** If the write or fsync fails, the temp file is left behind as garbage. A `finally` block must `unlink` the temp file on any error.

**Why it happens:**
The "write temp + rename" recipe is widely known, but the EXDEV and fsync details are not. Most tutorials skip fsync because it is "slow." Developers test on machines that do not have `/tmp` on a separate mount, so they never encounter EXDEV.

**How to avoid:**
Implement a dedicated `atomicWriteFileSync` utility:

```typescript
import { writeFileSync, renameSync, unlinkSync, openSync, fsyncSync, closeSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

function atomicWriteFileSync(filePath: string, data: string): void {
  const dir = dirname(filePath);
  const tmpPath = join(dir, `.tmp-${randomBytes(6).toString('hex')}`);
  let fd: number | null = null;
  try {
    fd = openSync(tmpPath, 'w');
    const buffer = Buffer.from(data, 'utf8');
    // Bun's writeFileSync on fd is fine, but for safety use the low-level API
    writeFileSync(tmpPath, data, 'utf8');
    // fsync ensures data hits disk before rename
    const syncFd = openSync(tmpPath, 'r');
    fsyncSync(syncFd);
    closeSync(syncFd);
    renameSync(tmpPath, filePath);
  } catch (error) {
    try { unlinkSync(tmpPath); } catch {}
    throw error;
  }
}
```

Key rules:
- Temp file goes in `dirname(filePath)`, never `/tmp`
- Call `fsyncSync` before `renameSync`
- `unlinkSync` in the catch block
- The temp file name uses random bytes to avoid collisions with concurrent writes (unlikely in this project but defensive)

**Warning signs:**
- Cache file contains `{}` or truncated JSON after a `SIGKILL` or power failure
- `JSON.parse` errors in journalctl logs after service restarts
- Snapshot data is silently lost between service restarts (the catch on line 60 swallows the parse error)

**Phase to address:**
Phase 1 (Critical Fixes) -- the race condition in snapshot-cache is already flagged as critical in the audit.

---

### Pitfall 3: Shell Injection in `defaultOpenBrowser` via `exec()` with String Interpolation

**What goes wrong:**
The current `auth-command.ts` line 225 uses `exec(\`xdg-open ${url}\`)` where `url` comes from the GitHub Device Flow response (`deviceCode.verification_uri`). While GitHub's verification URL is currently always `https://github.com/login/device`, the value originates from an HTTP response and is not validated. If the response is intercepted (MITM) or the OAuth endpoint changes, the URL could contain shell metacharacters. `exec()` passes the entire string to `/bin/sh`, so a URL like `https://evil.com; rm -rf ~` would execute the injected command.

Even in the "safe" case, `exec()` spawns a shell process unnecessarily. `execFile()` or Bun's `Bun.spawn()` bypass the shell entirely, making the same call without any injection risk.

**Why it happens:**
`exec()` is the most convenient child_process API -- it takes a single string, requires no argument splitting. Developers use it for "one-off" commands like opening a URL without thinking about the shell interpretation layer. The `exec()` API name is misleading -- it does not just execute a binary, it runs a shell command.

**How to avoid:**
Replace `exec()` with `Bun.spawn()` or `execFile()`. For `xdg-open`, the URL is the sole argument:

```typescript
import { execFile } from 'node:child_process';

function defaultOpenBrowser(url: string): void {
  // execFile does NOT invoke a shell -- url is passed as a single argument
  execFile('xdg-open', [url], () => {
    // Intentionally silent
  });
}
```

Or with Bun's native API:

```typescript
function defaultOpenBrowser(url: string): void {
  try {
    Bun.spawn(['xdg-open', url], { stdout: 'ignore', stderr: 'ignore' });
  } catch {
    // xdg-open may not be available
  }
}
```

Additionally, validate the URL before opening:

```typescript
function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
```

**Warning signs:**
- Static analysis tools (Biome, ESLint security plugin) flag `exec()` with template literal
- Any user-facing URL is passed through `exec()` without validation
- Code review finds string interpolation in any `exec()` or `spawn({ shell: true })` call

**Phase to address:**
Phase 1 (Critical Fixes) -- shell injection is a security issue that should be fixed immediately.

---

### Pitfall 4: Adding Global Error Handlers That Swallow Errors Instead of Logging Them

**What goes wrong:**
The audit flagged "no global error handlers" in the service runtime. The common fix is to add `process.on('uncaughtException', ...)` and `process.on('unhandledRejection', ...)`. But the pitfall is in HOW these handlers are implemented:

1. **Swallowing errors:** `process.on('uncaughtException', () => {})` prevents the crash but the service continues in an undefined state. A provider that throws synchronously during fetch now runs with corrupted state, producing wrong usage numbers silently.

2. **Logging but not exiting:** `process.on('uncaughtException', (err) => { console.error(err); })` logs the error but the process continues. Node.js/Bun docs explicitly warn: "It is not safe to resume normal operation after `uncaughtException` because the system becomes unreliable."

3. **Missing SIGTERM/SIGINT handlers:** The service runs under systemd which sends SIGTERM on `systemctl stop`. Without a handler, the process exits immediately without cleaning up the socket file, leaving a stale socket that blocks the next start.

**Why it happens:**
Developers want to prevent the service from crashing in production. The instinct is "catch everything, log it, keep running." But for uncaught exceptions specifically, the correct behavior is "log, clean up, exit, let systemd restart."

**How to avoid:**
Implement error handlers with the correct severity response:

```typescript
// Uncaught exception: log and EXIT (systemd will restart)
process.on('uncaughtException', (error) => {
  console.error('[agent-bar] Uncaught exception:', error);
  // Clean up socket file
  try { unlinkSync(socketPath); } catch {}
  process.exit(1);
});

// Unhandled rejection: log but DON'T exit (Bun default already does this)
process.on('unhandledRejection', (reason) => {
  console.error('[agent-bar] Unhandled rejection:', reason);
  // Don't exit -- the coordinator uses Promise.allSettled so individual
  // provider failures are expected to be caught. A truly unhandled rejection
  // means a bug, but the service can continue.
});

// SIGTERM: graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[agent-bar] Received SIGTERM, shutting down...');
  await runtime.stop(); // Cleans up socket, stops timers
  process.exit(0);
});

// SIGINT: same as SIGTERM for dev convenience
process.on('SIGINT', async () => {
  await runtime.stop();
  process.exit(0);
});
```

The critical distinction: `unhandledRejection` can be non-fatal (log and continue), but `uncaughtException` must be fatal (log, cleanup, exit). Systemd's `Restart=on-failure` will restart the service automatically.

**Warning signs:**
- After adding error handlers, the service silently produces wrong data instead of crashing and restarting
- Stale socket files block service restart (`Error: EADDRINUSE`)
- `systemctl stop agent-bar` takes 90 seconds (the default timeout) because the process ignores SIGTERM

**Phase to address:**
Phase 1 (Critical Fixes) -- global error handlers directly affect service reliability.

---

### Pitfall 5: Subprocess Timeout in GJS Uses `globalThis.setInterval` Instead of `GLib.timeout_add`

**What goes wrong:**
The GNOME extension's `polling-service.js` uses `globalThis.setInterval()` for its polling timer and retry delays. The GNOME Shell Extension Review Guidelines explicitly state that main loop sources must be managed via `GLib.timeout_add()` / `GLib.Source.remove()`. While `globalThis.setInterval` works in GJS, there are three problems:

1. **Cleanup reliability:** `clearInterval()` in GJS wraps `GLib.Source.remove()` internally, but the semantics may differ across GNOME Shell versions. The official pattern is `GLib.Source.remove(sourceId)`.

2. **No subprocess timeout at all:** The `backend-client.js` uses `Gio.SubprocessLauncher.spawnv()` followed by `communicate_utf8_async()` with NO timeout. If the backend hangs (e.g., a provider CLI is stuck), the GNOME Shell extension blocks indefinitely waiting for the subprocess. The extension becomes unresponsive, the "Refreshing..." state persists forever, and the user must restart GNOME Shell.

3. **Review guideline compliance:** If this extension were submitted to extensions.gnome.org, it would be rejected for using `globalThis.setInterval` instead of `GLib.timeout_add_seconds`.

**Why it happens:**
The developer used familiar web APIs (`setInterval`/`clearInterval`) because they work in GJS. The abstracted `scheduler` object in polling-service.js is well-designed for testability, but its default implementation uses the wrong GJS primitive. For the subprocess timeout, the developer relied on the backend process having its own timeout, not realizing the GNOME extension needs an independent timeout guard.

**How to avoid:**
1. **Replace the default scheduler** with `GLib.timeout_add_seconds` / `GLib.Source.remove`:

```javascript
import GLib from 'gi://GLib';

function gnomeScheduler() {
  return {
    setInterval(callback, intervalMs) {
      const seconds = Math.max(1, Math.round(intervalMs / 1000));
      return GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds, () => {
        callback();
        return GLib.SOURCE_CONTINUE;
      });
    },
    clearInterval(sourceId) {
      if (sourceId !== null) {
        GLib.Source.remove(sourceId);
      }
    },
    now() {
      return new Date();
    },
  };
}
```

2. **Add subprocess timeout to `backend-client.js`** using `Gio.Cancellable` + `GLib.timeout_add`:

```javascript
async function runGioSubprocessWithTimeout(argv, { Gio, cwd, timeoutMs = 30000 } = {}) {
  const cancellable = new Gio.Cancellable();
  const timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeoutMs, () => {
    cancellable.cancel();
    return GLib.SOURCE_REMOVE;
  });

  const launcher = new Gio.SubprocessLauncher({
    flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
  });
  const subprocess = launcher.spawnv(argv);

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
    GLib.Source.remove(timeoutId);
    return result;
  } catch (error) {
    GLib.Source.remove(timeoutId);
    if (cancellable.is_cancelled()) {
      subprocess.force_exit();
      throw new Error(`Backend command timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}
```

**Warning signs:**
- Extension shows "Refreshing..." indefinitely
- GNOME Shell Extension review rejects the extension for improper main loop usage
- `journalctl /usr/bin/gnome-shell` shows GLib warnings about orphaned sources

**Phase to address:**
Phase 2 (High Priority Fixes) -- subprocess timeouts are flagged as "high" severity in the audit.

---

### Pitfall 6: systemd Hardening Directives That Silently Break User Services

**What goes wrong:**
The audit recommends hardening the systemd service with `ProtectSystem`, `PrivateTmp`, etc. However, several of these directives have silent failure modes in user services:

1. **`ProtectHome=yes` blocks XDG paths:** `ProtectHome=yes` makes `/home/`, `/root`, and `/run/user` inaccessible. Since the service needs `~/.cache/agent-bar/`, `~/.config/agent-bar/`, `~/.local/share/agent-bar/`, and `XDG_RUNTIME_DIR` (typically `/run/user/<UID>`), this directive will completely break the service. The service starts, returns no errors, but all file operations silently fail or use fallback paths.

2. **`ProtectSystem=strict` prevents writing to non-standard paths:** If the service writes anywhere outside `/tmp`, `/var/tmp`, and explicitly allowed paths, writes fail with `EROFS: read-only file system`. The error is not a crash -- `writeFileSync` throws, the catch blocks swallow it, and the service appears to work but never persists data.

3. **Many sandboxing options are silently ignored in user services:** `ProtectSystem`, `ProtectHome`, `PrivateDevices`, etc. require mount namespace support which is not available to non-root processes. The directives are accepted without error but have no effect, giving a false sense of security.

4. **`PrivateTmp=yes` with XDG_RUNTIME_DIR socket:** If the socket is created under `XDG_RUNTIME_DIR` (which is under `/run/user/`), and `ProtectHome` is enabled (which hides `/run/user/`), the socket becomes inaccessible to external processes.

**Why it happens:**
systemd hardening guides are written for system services running as root. Copy-pasting those recommendations into a user service (`systemctl --user`) causes silent failures because the security model is fundamentally different.

**How to avoid:**
For user services, the safe hardening options are:

```ini
[Service]
# These work in user services:
NoNewPrivileges=yes
RestrictRealtime=yes
RestrictSUIDSGID=yes
SystemCallArchitectures=native

# These are needed for file access:
# Do NOT use ProtectHome or ProtectSystem in user services
# Do NOT use PrivateTmp if the service uses XDG paths

# Use ReadWritePaths if using ProtectSystem (only works with namespace support):
# ProtectSystem=strict
# ReadWritePaths=%h/.cache/agent-bar %h/.config/agent-bar %t/agent-bar
```

The safest approach: start with `NoNewPrivileges=yes` and `RestrictRealtime=yes` only (these always work in user services), then test each additional directive on an Ubuntu 24.04 VM before adding it.

Use `systemd-analyze security agent-bar.service --user` to audit the current service security posture. It scores each directive and shows which ones are active vs. ignored.

**Warning signs:**
- Service starts but cache files are never written (check with `ls -la ~/.cache/agent-bar/`)
- `secret-tool` calls fail because D-Bus socket is inaccessible
- `journalctl --user -u agent-bar` shows `EROFS` or `Permission denied` errors
- `systemd-analyze security` shows a high score but the directives are actually no-ops

**Phase to address:**
Phase 3 (Production Hardening) -- systemd hardening must be tested on the target Ubuntu VM, not just added to the unit file.

---

### Pitfall 7: GNOME Theme Detection Breaking on GNOME 45+ Due to `gtk-theme` Deprecation

**What goes wrong:**
Starting with GNOME 45, enabling dark mode via the Quick Settings menu only changes the `color-scheme` GSettings key (`org.gnome.desktop.interface color-scheme`), NOT the `gtk-theme` key. Code that detects dark mode by checking if the `gtk-theme` contains "dark" or ends with "-dark" will fail on GNOME 45/46/47. The GNOME extension's CSS will not adapt to theme changes, showing light-mode styled widgets on a dark desktop (or vice versa).

**Why it happens:**
The `gtk-theme` approach worked for years (GNOME 3.x through 44). Most Stack Overflow answers and tutorials still recommend it. The change was introduced in GNOME 45 as part of the libadwaita/freedesktop color-scheme standardization, but it was not prominently documented.

**How to avoid:**
Use the `color-scheme` GSettings key as the primary detection mechanism:

```javascript
import Gio from 'gi://Gio';

function isDarkTheme() {
  const settings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
  const colorScheme = settings.get_string('color-scheme');
  return colorScheme === 'prefer-dark';
}
```

For reactive theme changes, connect to the `changed::color-scheme` signal:

```javascript
const settings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
const handlerId = settings.connect('changed::color-scheme', () => {
  const isDark = settings.get_string('color-scheme') === 'prefer-dark';
  // Update CSS classes accordingly
});
// MUST disconnect in disable():
settings.disconnect(handlerId);
```

Ubuntu 24.04 ships GNOME 46, so this is the correct API. Do not also check `gtk-theme` as a fallback -- it adds complexity and is unnecessary on the target platform.

**Warning signs:**
- Extension looks correct in light mode but does not change when user toggles to dark mode
- CSS uses hardcoded colors instead of GNOME Shell theme variables
- Theme detection works in GNOME 44 but breaks on GNOME 46 (Ubuntu 24.04)

**Phase to address:**
Phase 3 (Production Hardening) -- theme awareness is a medium-priority production polish item.

---

### Pitfall 8: AbortController/Promise.race Timeout Pattern Leaves Orphaned Operations

**What goes wrong:**
The backend coordinator fetches all providers with `Promise.all()` (line 51 of `backend-coordinator.ts`). Adding a per-provider timeout using `Promise.race([fetchPromise, timeoutPromise])` has a critical gotcha: when the timeout wins the race, the fetch promise keeps running in the background. The subprocess spawned by `Bun.spawn` continues executing. The timer created by `setTimeout` for the losing timeout also keeps ticking.

This means:
- A slow provider does not actually get cancelled -- it finishes eventually and writes to the cache after the coordinator already returned a timeout error
- If the service has limited resources, multiple orphaned fetches accumulate across refresh cycles
- The `setTimeout` timer from the losing race leaks unless explicitly cleared

**Why it happens:**
`Promise.race()` resolves when the first promise settles, but the other promises are NOT cancelled. This is a fundamental JavaScript limitation. Developers assume "the race is over" means "everything stopped," but it does not.

**How to avoid:**
Use `AbortController` + `AbortSignal.timeout()` to enable true cancellation:

```typescript
async function fetchWithTimeout(
  adapter: ProviderAdapter,
  context: ProviderContext,
  timeoutMs: number,
): Promise<ProviderSnapshot> {
  const signal = AbortSignal.timeout(timeoutMs);
  
  try {
    return await adapter.getQuota({ ...context, signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return createErrorSnapshot(adapter.id, context.sourceMode, new Date().toISOString(), 
        createProviderError('provider_timeout', `${adapter.id} timed out after ${timeoutMs}ms`, true));
    }
    throw error;
  }
}
```

The provider adapters must pass the `signal` to `Bun.spawn`:

```typescript
const proc = Bun.spawn([command, ...args], {
  signal, // AbortSignal -- kills the process when aborted
  stdout: 'pipe',
  stderr: 'pipe',
});
```

Bun's `Bun.spawn` natively supports `AbortSignal` -- when the signal fires, the subprocess is killed with `SIGTERM` (configurable via `killSignal`). This ensures no orphaned processes.

Also change `Promise.all` to `Promise.allSettled` in the coordinator to ensure one provider's timeout does not block or reject others.

**Warning signs:**
- `ps aux | grep codex` shows multiple `codex usage` processes running simultaneously
- Memory usage grows over time as orphaned fetch promises hold references
- Provider timeout errors are followed by stale cache writes from the orphaned fetch

**Phase to address:**
Phase 2 (High Priority Fixes) -- coordinator timeout is flagged as a high-severity issue.

---

### Pitfall 9: Biome Strictness Escalation Causing a Flood of Unrelated Changes

**What goes wrong:**
The audit recommends improving Biome strictness. The pitfall is enabling strict rules (e.g., `noExplicitAny: "error"`, `useNodejsImportProtocol: "error"`) across the entire codebase at once. This produces hundreds of violations in existing code, creating a massive diff that:

1. Makes code review impossible (signal drowns in noise)
2. Introduces regressions in files that were otherwise stable
3. Conflicts with every other open branch
4. Breaks `git blame` for the entire codebase

**Why it happens:**
Biome's `check --write` auto-fixes many violations, making it tempting to "just fix everything." But auto-fixes can change behavior -- for example, `noExplicitAny` auto-fix replaces `any` with `unknown`, which may break downstream code that expected `any`'s implicit assignability.

**How to avoid:**
Use a phased approach:

1. **Baseline current violations** before changing any rules: `bunx biome check . --reporter=json > .planning/biome-baseline.json`

2. **New-code-only enforcement:** Use Biome's `--changed` flag in CI to lint only modified files. This prevents new violations without touching existing code:
   ```yaml
   - run: bunx biome check --changed --since=origin/main
   ```

3. **Per-rule escalation:** Enable one strict rule at a time, fix its violations in an isolated commit, then move to the next. Order by impact:
   - First: `useNodejsImportProtocol` (mechanical, no behavior change)
   - Second: `noExplicitAny` in new files only (via overrides)
   - Last: `noNonNullAssertion` (requires careful review of each site)

4. **Keep existing relaxed rules during v2.1:** The current `biome.json` disables `noForEach`, `noNonNullAssertion`, `useNodejsImportProtocol`, and `noExplicitAny`. These are intentional choices. Do not change them all at once.

**Warning signs:**
- A single Biome commit touches 50+ files
- Auto-fix changes `any` to `unknown` and breaks type inference downstream
- CI fails on every PR because the strictness PR conflicts with everyone's branches

**Phase to address:**
Phase 4 (DX Improvements) -- Biome strictness is low-priority relative to the critical/high fixes.

---

### Pitfall 10: CI Pipeline Testing Backend but Not the GNOME Extension Build

**What goes wrong:**
Setting up GitHub Actions CI for the backend (lint, typecheck, test) is straightforward with `oven-sh/setup-bun`. But the GNOME extension is plain JavaScript that runs in GJS -- not in Node.js or Bun. The extension's tests (under `apps/gnome-extension/test/`) currently run with Vitest (a Node.js test runner), which works because the tests mock all GJS-specific imports (`gi://Gio`, `gi://GLib`, `gi://St`). This means:

1. **The tests pass in CI but the extension can fail in GNOME Shell** because the mocks hide real GJS behavioral differences
2. **No type checking for the extension** -- it is plain `.js`, and Biome catches syntax/style issues but not logic errors
3. **No validation that GJS imports are correct** -- if a test mocks `gi://St` but the real GJS API changed in GNOME 46, the test still passes

Setting up actual GJS in CI is complex (requires a D-Bus session, GNOME Shell, or at minimum `gjs` binary). Most CI runs lack these.

**Why it happens:**
The GNOME extension lives in a different runtime world than the backend. It is written in a dialect of JavaScript (GJS) with platform-specific imports that do not exist outside GNOME Shell. CI is designed around the backend's Bun/TypeScript world.

**How to avoid:**

1. **Accept the limitation explicitly.** Real GJS testing in CI is impractical for v2.1. The extension tests with Vitest + mocks are valuable for logic verification, even if they do not catch GJS-specific issues.

2. **Add `gjs` availability check to CI** (lightweight):
   ```yaml
   - name: Check GJS syntax (best-effort)
     run: |
       if command -v gjs &>/dev/null; then
         gjs -c "imports.gi.versions.Gtk = '4.0'; print('GJS available')"
       else
         echo "::warning::GJS not available in CI -- extension not validated"
       fi
     continue-on-error: true
   ```

3. **Run the extension unit tests via Bun in CI** (they use Vitest which runs under Bun):
   ```yaml
   - run: bun run test:gnome
   ```

4. **Do NOT attempt to install gnome-shell in CI** just for extension testing -- the complexity is not worth it for v2.1. Manual testing on the Ubuntu VM remains the E2E validation path.

**Warning signs:**
- Backend CI is green but the extension crashes on load in GNOME Shell
- A GJS API change (GNOME 46 to 47) breaks the extension but CI does not catch it
- Tests mock so aggressively that they are testing the mocks, not the code

**Phase to address:**
Phase 3 (CI/CD) -- set up what is practical (backend lint + test + typecheck, extension unit tests) and document the manual testing gap.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Swallowing `catch {}` without logging the error | No noisy logs during normal operation | Silent failures make debugging impossible; corrupt cache goes unnoticed | Never -- always log at minimum `console.warn` in catch blocks |
| Using `globalThis.setInterval` in GNOME extension instead of `GLib.timeout_add` | Familiar API, easier testing with Vitest | Extension rejected by GNOME review; potential cleanup issues across GNOME versions | Acceptable during development if the scheduler is abstracted (current design is good); must be replaced before release |
| Fixing all 24 audit issues in a single branch | One PR, one review, done | Massive diff makes review impossible; a bug in one fix blocks all others | Never -- fix by severity group (critical, high, medium) in separate PRs |
| Adding `ProtectSystem=strict` without testing on Ubuntu | Looks secure in the unit file | Service silently fails to write cache/config; appears working but data is lost | Never -- test every systemd directive on the target platform |
| Using `Promise.all` instead of `Promise.allSettled` for multi-provider fetch | Simpler error handling (one try/catch) | One provider failure rejects the entire snapshot; user sees "Error" even when 2 of 3 providers work | Never -- the coordinator must use `Promise.allSettled` for fault isolation |
| Skipping `fsync` in atomic write to improve performance | Writes are faster | Data loss on power failure; corrupt cache files on next boot | Acceptable for ephemeral cache only; not acceptable for config files or tokens |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GJS `Gio.Subprocess` + backend CLI | No timeout -- subprocess hangs if backend is stuck | Use `Gio.Cancellable` + `GLib.timeout_add` to force-exit after 30s |
| Bun `Bun.spawn` + provider CLI | Calling `proc.kill()` while reading stdout causes Bun to hang forever | Always race `proc.exited` against a timeout; use `AbortSignal` with `Bun.spawn` |
| GNOME Keyring via `secret-tool` in systemd | Missing `DBUS_SESSION_BUS_ADDRESS` in service environment | Ensure setup command runs `systemctl --user import-environment DBUS_SESSION_BUS_ADDRESS` |
| GSettings `color-scheme` for theme detection | Checking `gtk-theme` for "-dark" suffix (broken on GNOME 45+) | Read `org.gnome.desktop.interface color-scheme` and listen for `changed::color-scheme` signal |
| GitHub Actions + Bun | Using `bun.lockb` (binary) as cache key | Migrate to text-based `bun.lock` with `bun install --save-text-lockfile`; use `hashFiles('**/bun.lock')` |
| GitHub Actions + pnpm (for GNOME extension tests) | Forgetting that the project uses BOTH pnpm and Bun | Set up both `oven-sh/setup-bun` and `pnpm/action-setup` in CI; the GNOME extension workspace uses pnpm |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Orphaned subprocesses from timed-out fetches | `ps aux` shows accumulated `codex usage` processes | Pass `AbortSignal` to `Bun.spawn`; signal kills the process on timeout | After several refresh cycles with a slow provider |
| Re-rendering entire indicator on every state change | GNOME Shell frame drops during refresh | Diff the provider data; only destroy/recreate slots that changed | With more than 3 providers or frequent state updates |
| Unbounded retry backoff accumulation | Extension fires retry attempts from multiple failed cycles simultaneously | Clear the previous retry timer before scheduling a new one (current code does this correctly via `clearRetry()`) | Not currently broken, but removing `clearRetry()` during refactor would cause it |
| Synchronous `writeFileSync` in the service server hot path | Service blocks while writing snapshot to disk | Use async `writeFile` for the persistence path; keep sync only for atomic rename | With large snapshot payloads (many providers or verbose diagnostics) |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| `exec()` with string interpolation for URL opening | Command injection via crafted verification URI | Replace with `execFile('xdg-open', [url])` or `Bun.spawn(['xdg-open', url])` |
| Socket file with world-readable permissions | Any local process can query provider usage data and tokens | Set socket to `0600` after creation; verify permissions in CI smoke test |
| Logging full provider CLI output to journalctl | API keys or tokens in CLI output visible in system journal | Scrub sensitive patterns before logging; log only exit code and error summary |
| Global error handler catches exception but continues | Service runs with corrupted state; may serve wrong data | `uncaughtException` handler must exit after logging; rely on systemd `Restart=on-failure` |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Subprocess timeout produces generic "Error" in GNOME panel | User does not know which provider failed or why | Show provider-specific timeout message: "Codex: timed out (check `codex` CLI)" |
| Dark mode CSS not updating when user toggles theme | Extension looks broken -- white text on white background | Listen for `changed::color-scheme` signal and update CSS classes reactively |
| Service restart after hardening loses in-memory state | User sees "--%" for all providers until next refresh cycle | Read persisted snapshot from XDG cache on startup (current code does this -- preserve it) |
| `agent-bar doctor` does not report systemd hardening status | User cannot verify if sandboxing is active | Add a "systemd security" check to the doctor command |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Memory leak fix:** Actors destroyed in `_render()` -- verify `_providerActors` Map is cleared BEFORE calling `destroy()` on the actors, or references will point to finalized GObjects
- [ ] **Atomic writes:** Using temp-file-rename pattern -- verify temp file is in SAME directory as target (not `/tmp`); verify `fsync` is called before rename; verify cleanup in `finally` block
- [ ] **Shell injection fix:** Replaced `exec()` with `execFile()` -- verify the `shell: true` option is NOT set (this negates the security benefit)
- [ ] **Global error handlers:** Added `uncaughtException` handler -- verify it calls `process.exit(1)` after logging, not just logging
- [ ] **Subprocess timeout (GNOME):** Added `Gio.Cancellable` timeout -- verify the cancellable is passed to `communicate_utf8_async`; verify `force_exit()` is called when cancelled; verify timeout source is removed in `disable()`
- [ ] **Subprocess timeout (backend):** Added `AbortSignal` to `Bun.spawn` -- verify the signal actually kills the process (check `proc.killed` after timeout)
- [ ] **systemd hardening:** Added `ProtectSystem`/`ProtectHome` -- verify service can still write to `~/.cache/agent-bar/` and `~/.config/agent-bar/` on Ubuntu 24.04 VM
- [ ] **Theme detection:** Using `color-scheme` GSettings key -- verify the signal connection ID is stored and disconnected in `disable()`; verify it works when user toggles theme while extension is active
- [ ] **CI pipeline:** Backend tests run in GitHub Actions -- verify `bun install --frozen-lockfile` does not fail because `bun.lock` is missing (the project currently uses `pnpm-lock.yaml`)
- [ ] **Biome strictness:** Enabled new rules -- verify `--changed` flag is used in CI so existing violations are not flagged on unrelated PRs

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Actors not destroyed -- memory leak persists | LOW | Add `child.destroy()` in `_render()` loop; ship as hotfix. No architecture change needed |
| Atomic write placed temp in `/tmp` -- EXDEV error | LOW | Move temp file to `dirname(targetPath)`. One-line change in the utility function |
| `exec()` replaced with `execFile()` but `shell: true` was set | LOW | Remove `shell: true` option. One-line fix |
| Global error handler swallows errors | LOW | Add `process.exit(1)` to `uncaughtException` handler |
| systemd `ProtectHome` breaks file access | LOW | Remove `ProtectHome=yes` from service file; use `NoNewPrivileges=yes` only |
| GJS subprocess timeout not wired up | MEDIUM | Implement `Gio.Cancellable` pattern in `backend-client.js`; requires testing on GNOME Shell |
| Biome strictness committed too aggressively | MEDIUM | `git revert` the Biome commit; re-apply with `--changed` strategy instead |
| CI runs but does not test GNOME extension | LOW | Accept this as documented gap; extension testing remains manual on Ubuntu VM |
| Theme detection uses `gtk-theme` instead of `color-scheme` | LOW | Replace the GSettings key; single-point change with reactive signal |
| Promise.race timeout leaves orphaned processes | MEDIUM | Refactor to use `AbortSignal` with `Bun.spawn`; requires changes in subprocess.ts and provider adapters |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Actor leak in `_render()` (#1) | Phase 1: Critical Fixes | GNOME Shell memory usage stable over 8+ hours with extension enabled |
| Non-atomic cache writes (#2) | Phase 1: Critical Fixes | `kill -9` the service during a write; restart and verify cache is valid JSON |
| Shell injection in auth (#3) | Phase 1: Critical Fixes | `grep -r "exec(" apps/backend/src/` returns zero non-`execFile` hits |
| Error handlers swallowing (#4) | Phase 1: Critical Fixes | Send SIGTERM to service; verify clean shutdown and socket cleanup in < 2 seconds |
| GJS subprocess timeout (#5) | Phase 2: High Priority | Backend hangs for 60s; extension recovers within 30s timeout + shows error |
| systemd hardening (#6) | Phase 3: Production Hardening | `systemd-analyze security agent-bar.service --user` shows improved score; service reads/writes XDG paths correctly |
| Theme detection (#7) | Phase 3: Production Hardening | Toggle dark/light mode in GNOME Settings; extension CSS updates within 1 second |
| AbortController timeout (#8) | Phase 2: High Priority | Slow provider (simulated with `sleep 60`) times out; `ps aux` shows no orphaned process |
| Biome strictness (#9) | Phase 4: DX Improvements | New-code-only linting in CI; zero Biome violations in modified files on every PR |
| CI GNOME gap (#10) | Phase 3: CI/CD | CI runs backend lint + test + typecheck; extension unit tests pass; manual E2E gap is documented |

## Sources

- [GJS Memory Management Guide](https://gjs.guide/guides/gjs/memory-management.html) -- Clutter actor lifecycle, destroy() semantics, signal cleanup (HIGH confidence)
- [GNOME Shell Extension Review Guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html) -- Required cleanup in disable(), timer/signal/actor rules (HIGH confidence)
- [GJS Subprocesses Guide](https://gjs.guide/guides/gio/subprocesses.html) -- Gio.Subprocess, Gio.Cancellable patterns (HIGH confidence)
- [GJS Asynchronous Programming](https://gjs.guide/guides/gjs/asynchronous-programming.html) -- GLib.timeout_add, main loop source management (HIGH confidence)
- [npm/write-file-atomic](https://github.com/npm/write-file-atomic) -- Atomic write pattern reference, EXDEV handling (HIGH confidence)
- [LWN.net: Atomic file creation](https://lwn.net/Articles/789600/) -- fsync requirement before rename (HIGH confidence)
- [systemd.exec documentation](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html) -- ProtectSystem, ProtectHome, PrivateTmp semantics (HIGH confidence)
- [systemd Sandboxing - ArchWiki](https://wiki.archlinux.org/title/Systemd/Sandboxing) -- User service sandboxing limitations (HIGH confidence)
- [GNOME Dark Mode Switching - ArchWiki](https://wiki.archlinux.org/title/Dark_mode_switching) -- color-scheme vs gtk-theme for GNOME 45+ (HIGH confidence)
- [GNOME Developer Docs: Dark Mode](https://developer.gnome.org/documentation/tutorials/beginners/getting_started/dark_mode.html) -- Official color-scheme API (HIGH confidence)
- [Bun CI/CD Guide](https://bun.com/docs/guides/runtime/cicd) -- setup-bun action, frozen-lockfile, cache (HIGH confidence)
- [oven-sh/setup-bun](https://github.com/oven-sh/setup-bun) -- Official GitHub Action for Bun (HIGH confidence)
- [Bun Subprocess Documentation](https://bun.com/docs/runtime/child-process) -- AbortSignal support, killSignal, timeout (HIGH confidence)
- [Bun stdout read + kill hang issue](https://github.com/oven-sh/bun/issues/1498) -- Known bug with proc.kill during read (HIGH confidence)
- [AbortController Best Practices](https://kettanaito.com/blog/dont-sleep-on-abort-controller) -- Promise.race gotchas, AbortSignal.timeout (HIGH confidence)
- [Secure Coding: exec vs execFile](https://securecodingpractices.com/prevent-command-injection-node-js-child-process/) -- Shell injection prevention in Node.js (HIGH confidence)
- [GNOME Discourse: Subprocess child exit](https://discourse.gnome.org/t/how-to-make-a-glib-subprocess-having-childs-exit-responsibly/23260) -- GLib.Subprocess force_exit limitations (MEDIUM confidence)
- [Biome Migration Guide 2026](https://dev.to/pockit_tools/biome-the-eslint-and-prettier-killer-complete-migration-guide-for-2026-27m) -- Baseline, --changed, gradual adoption (MEDIUM confidence)
- [Biome Roadmap 2026](https://biomejs.dev/blog/roadmap-2026/) -- Official roadmap and feature plans (HIGH confidence)
- [GJS setInterval/setTimeout polyfill](https://dontreinventbicycle.com/gjs-set-timeout-interval.html) -- globalThis timing API availability in GJS (MEDIUM confidence)

---
*Pitfalls research for: v2.1 Stability & Hardening of Agent Bar Ubuntu (Bun/TypeScript backend + GNOME Shell extension)*
*Researched: 2026-04-05*

# Stack Research: v2.1 Stability & Hardening

**Domain:** Linux-native AI usage monitor -- stability fixes, security hardening, CI/CD, and theme awareness
**Researched:** 2026-04-05
**Confidence:** HIGH

## Scope

This research covers ONLY the stack additions/changes needed for v2.1 hardening. The existing validated stack (Bun 1.3.x, TypeScript, @clack/prompts, Biome, GJS/St, systemd user service) is NOT re-researched.

Focus areas:
1. Atomic file writes in Bun (fix race condition in snapshot-cache)
2. GJS subprocess timeout patterns (fix missing timeouts in GNOME extension)
3. GitHub Actions CI for Bun+TypeScript
4. systemd service hardening
5. GNOME theme detection (dark/light CSS awareness)
6. GJS memory management (fix memory leak in indicator)

---

## 1. Atomic File Writes in Bun

**Problem:** `snapshot-cache.ts` line 73 uses `writeFileSync()` directly to the target path. A crash mid-write corrupts the cache file. This is the race condition audit finding.

**Solution:** Write to a temp file in the same directory, then atomically rename.

### Pattern: temp + rename

| API | Source | Purpose |
|-----|--------|---------|
| `Bun.write(path, data)` | Built-in | Write to temporary file (fast, optimized for platform) |
| `rename()` from `node:fs/promises` | Bun compat layer (fully supported) | Atomic rename on same filesystem |
| `renameSync()` from `node:fs` | Bun compat layer (fully supported) | Sync variant for the existing sync cache API |

**Why this works:** POSIX guarantees `rename()` is atomic when source and destination are on the same filesystem. Writing to a temp file in the same directory (the XDG cache dir) ensures both are on the same mount.

**Implementation pattern:**

```typescript
import { renameSync, writeFileSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto'; // or use Bun.hash / Date.now()

function atomicWriteSync(targetPath: string, data: string): void {
  const tmpPath = `${targetPath}.${process.pid}.tmp`;
  try {
    writeFileSync(tmpPath, data, 'utf8');
    renameSync(tmpPath, targetPath);
  } catch (error) {
    try { unlinkSync(tmpPath); } catch { /* cleanup best-effort */ }
    throw error;
  }
}
```

**No new dependencies needed.** This is a 10-line utility function using APIs Bun already supports at 100% compat.

**Confidence: HIGH** -- `node:fs` and `node:fs/promises` are fully supported in Bun. The `rename` function is confirmed in Bun's API reference. POSIX atomic rename semantics are well-established.

### What NOT to use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `write-file-atomic` (npm) | Unnecessary dependency for a 10-line pattern | Manual temp+rename |
| `Bun.write()` directly to target | Same race condition as current code | Write to temp, then rename |
| `fsync` before rename | Overkill for a JSON cache file (not a database). The cache is regenerable. | Just temp+rename is sufficient |

---

## 2. GJS Subprocess Timeout Patterns

**Problem:** The GNOME extension's `backend-client.js` spawns `Gio.Subprocess` via `communicate_utf8_async` with no timeout. If the backend hangs, the extension hangs indefinitely.

### Pattern: GLib.timeout_add + Gio.Cancellable

The correct GJS pattern combines `Gio.Cancellable` with `GLib.timeout_add` for subprocess timeouts.

| API | Import | Purpose |
|-----|--------|---------|
| `GLib.timeout_add(priority, ms, callback)` | `gi://GLib` | Schedule a timeout callback on the main loop |
| `GLib.timeout_add_seconds(priority, secs, callback)` | `gi://GLib` | Same but in seconds (prefer for >1s timeouts) |
| `GLib.Source.remove(sourceId)` | `gi://GLib` | Cancel a scheduled timeout |
| `Gio.Cancellable` | `gi://Gio` | Cancel async operations; connect to `force_exit()` |

**Implementation pattern for subprocess with timeout:**

```javascript
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const SUBPROCESS_TIMEOUT_MS = 15000;

async function runWithTimeout(argv, timeoutMs = SUBPROCESS_TIMEOUT_MS) {
  const cancellable = new Gio.Cancellable();
  const proc = new Gio.Subprocess({
    argv,
    flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
  });
  proc.init(cancellable);

  // Connect cancellable to force-kill the process
  const cancelId = cancellable.connect(() => proc.force_exit());

  // Schedule timeout
  const timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeoutMs, () => {
    cancellable.cancel();
    return GLib.SOURCE_REMOVE;
  });

  try {
    const [stdout, stderr] = await proc.communicate_utf8_async(null, cancellable);
    GLib.Source.remove(timeoutId);
    cancellable.disconnect(cancelId);
    return { stdout, stderr, success: proc.get_successful() };
  } catch (error) {
    GLib.Source.remove(timeoutId);
    cancellable.disconnect(cancelId);
    throw error;
  }
}
```

**Critical cleanup requirement:** Per GNOME review guidelines, ALL `GLib.timeout_add` sources MUST be removed in `disable()`. The extension must track active timeout source IDs and clean them up.

**Note on `force_exit` limitation:** `Gio.Subprocess.force_exit()` does NOT affect child processes of the subprocess. This is a known GLib limitation. For the agent-bar use case this is acceptable because the backend CLI process is a single process (not a process tree).

**Note on `Gio._promisify`:** For cleaner async patterns, promisify the subprocess methods:

```javascript
Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');
```

This allows `await proc.communicate_utf8_async(null, cancellable)` instead of callback-based patterns.

**No new dependencies needed.** `GLib` and `Gio` are already imported in the extension.

**Confidence: HIGH** -- Verified via official gjs.guide documentation for both subprocesses and async programming.

---

## 3. GitHub Actions CI for Bun + TypeScript

**Problem:** No CI pipeline exists. Lint, typecheck, and test failures are only caught locally.

### Recommended: `oven-sh/setup-bun@v2`

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| `oven-sh/setup-bun` | `v2` | Install Bun in GitHub Actions | Official action from the Bun team |
| `actions/checkout` | `v4` | Clone repository | Standard |

**Workflow structure -- three parallel jobs:**

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  lint:
    name: Lint & Format
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.3.10"
      - run: bun install --frozen-lockfile
      - run: bun run biome:check

  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.3.10"
      - run: bun install --frozen-lockfile
      - run: bun x tsc --noEmit -p apps/backend/tsconfig.json

  test:
    name: Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.3.10"
      - run: bun install --frozen-lockfile
      - run: cd apps/backend && bun test
```

**Key decisions:**

| Decision | Rationale |
|----------|-----------|
| Pin `bun-version: "1.3.10"` | Current latest stable. Avoid `latest` to prevent surprise breakage. Update via PR when upgrading Bun. |
| `--frozen-lockfile` | Fail CI if lockfile is out of date (prevents drift). |
| Parallel jobs (not sequential `needs:`) | Lint, typecheck, and test are independent. Running in parallel gives faster feedback. |
| No dependency caching action | Bun docs state: "`bun install` is faster than the GitHub Actions cache" in most cases. The `setup-bun` action caches the Bun binary itself. |
| `ubuntu-latest` runner only | Project targets Ubuntu. No matrix needed -- single platform, single runtime version. |
| No build step | Bun executes TypeScript directly. No compilation artifact to produce. |

**GNOME extension tests:** The GNOME extension uses vitest (see `vitest.config.ts`). If those tests should run in CI, add a separate job:

```yaml
  test-gnome:
    name: GNOME Extension Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - run: cd apps/gnome-extension && npm install && npm test
```

**Confidence: HIGH** -- `oven-sh/setup-bun@v2` is the official GitHub Action, verified via Bun docs and GitHub Marketplace. Workflow patterns confirmed from multiple sources.

### What NOT to use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `actions/cache` for `node_modules` | `bun install` is fast enough that caching adds complexity without benefit | Let `setup-bun` cache the Bun binary only |
| `bun-version: latest` | CI should be deterministic. `latest` can break builds without code changes. | Pin exact version: `"1.3.10"` |
| Matrix strategy (multiple Bun versions) | Not a library -- single application with one target version | Single version pin |
| `needs: lint` on test job | Makes CI sequential and slower for no reason | Run jobs in parallel |

---

## 4. systemd Service Hardening

**Problem:** The current `agent-bar.service` is minimal (Type=simple, Restart=on-failure). No sandboxing or resource limits.

### Critical Finding: User Services Cannot Use Most Sandboxing

The current service is a **user** unit (`~/.config/systemd/user/` or `~/.local/share/systemd/user/`), managed via `systemctl --user`. Per the official `systemd.exec(5)` documentation:

> "Many sandboxing features are not available in user services because they require privileged kernel features (mount namespaces) that an unprivileged user service manager cannot use."

**Directives that DO NOT WORK in user services:**

| Directive | Status in User Mode |
|-----------|---------------------|
| `ProtectSystem=` | **Does not work** -- requires mount namespace |
| `ProtectHome=` | **Does not work** -- requires mount namespace |
| `PrivateTmp=` | **Does not work** unless `PrivateUsers=true` |
| `PrivateDevices=` | **Does not work** unless `PrivateUsers=true` |
| `PrivateNetwork=` | **Does not work** unless `PrivateUsers=true` |

**Directives that DO WORK in user services:**

| Directive | Value | Purpose |
|-----------|-------|---------|
| `Restart=on-failure` | Already set | Restart on non-zero exit |
| `RestartSec=2` | Already set | Delay between restart attempts |
| `Environment=` | Already set | Set env vars |
| `EnvironmentFile=-` | Add | Load env from file (- = ignore if missing) |
| `StateDirectory=agent-bar` | Add | Auto-create `$XDG_STATE_HOME/agent-bar/` (or `~/.local/state/agent-bar/`) |
| `CacheDirectory=agent-bar` | Add | Auto-create `$XDG_CACHE_HOME/agent-bar/` |
| `WatchdogSec=60` | Add | systemd kills service if it stops responding (requires sd_notify integration) |
| `TimeoutStartSec=30` | Add | Kill if startup takes too long |
| `TimeoutStopSec=10` | Add | Kill if shutdown takes too long |
| `MemoryMax=512M` | Add | Hard memory limit -- prevents runaway leaks from consuming system |
| `CPUQuota=50%` | Add | Prevents runaway CPU consumption |
| `TasksMax=50` | Add | Limits number of child processes |
| `StartLimitIntervalSec=300` | Add (in `[Unit]`) | Crash loop detection window |
| `StartLimitBurst=5` | Add (in `[Unit]`) | Max restarts within interval before giving up |
| `StandardOutput=journal` | Add | Route stdout to systemd journal |
| `StandardError=journal` | Add | Route stderr to systemd journal |

### Recommended Hardened Service File

```ini
[Unit]
Description=Agent Bar local backend service
After=default.target
StartLimitIntervalSec=300
StartLimitBurst=5

[Service]
Type=simple
ExecStart=%h/.local/bin/agent-bar service run
Restart=on-failure
RestartSec=2
TimeoutStartSec=30
TimeoutStopSec=10

# Resource limits (work in user services)
MemoryMax=512M
CPUQuota=50%
TasksMax=50

# Logging
StandardOutput=journal
StandardError=journal

# Environment
EnvironmentFile=-%h/.config/agent-bar/env

# Directories (auto-created by systemd, XDG-aware in user mode)
CacheDirectory=agent-bar
StateDirectory=agent-bar

[Install]
WantedBy=default.target
```

### Decision: Stay as User Service

| Option | Pros | Cons |
|--------|------|------|
| **User service (current, recommended)** | No root needed for install/manage. XDG dirs automatic. Access to user's DBUS session. Simple install UX. | Cannot use ProtectSystem/ProtectHome sandboxing. |
| System service with `User=` | Full sandboxing available. | Requires root to install. DBUS session access is complex. Install script needs sudo. Worse UX for a desktop tool. |

**Recommendation:** Stay as user service. The agent-bar backend reads user config files, accesses user's GNOME Keyring (via DBUS), and is managed by the user. Converting to a system service for sandboxing adds significant complexity. The resource limits (`MemoryMax`, `CPUQuota`, `TasksMax`, `TimeoutStartSec`, crash loop detection) provide meaningful hardening without requiring root.

**Confidence: HIGH** -- Verified via systemd.exec(5) man page and Arch Wiki. User service limitations confirmed from multiple authoritative sources.

---

## 5. GNOME Theme Detection (Dark/Light CSS Awareness)

**Problem:** The extension stylesheet has hardcoded One Dark colors. On a light GNOME Shell theme (available since GNOME 45, default-capable on Ubuntu 24.04's GNOME 46), the extension looks jarring.

### Approach: GSettings `color-scheme` + Dynamic CSS Classes

| API | Import | Purpose |
|-----|--------|---------|
| `Gio.Settings` | `gi://Gio` | Read `org.gnome.desktop.interface` schema |
| `settings.get_string('color-scheme')` | -- | Returns `'default'`, `'prefer-dark'`, or `'prefer-light'` |
| `settings.connect('changed::color-scheme', callback)` | -- | React to theme changes in real time |
| `St.ThemeContext.get_for_stage(global.stage)` | `gi://St` | React to shell CSS theme changes (already used in extension) |

**Implementation pattern:**

```javascript
import Gio from 'gi://Gio';

// In enable():
this._interfaceSettings = new Gio.Settings({
  schema_id: 'org.gnome.desktop.interface',
});

const scheme = this._interfaceSettings.get_string('color-scheme');
this._isDark = scheme !== 'prefer-light'; // default and prefer-dark both treated as dark

this._colorSchemeHandlerId = this._interfaceSettings.connect(
  'changed::color-scheme',
  () => {
    const newScheme = this._interfaceSettings.get_string('color-scheme');
    this._isDark = newScheme !== 'prefer-light';
    this._updateThemeClass();
  }
);

// In disable():
if (this._colorSchemeHandlerId) {
  this._interfaceSettings.disconnect(this._colorSchemeHandlerId);
  this._colorSchemeHandlerId = null;
}
this._interfaceSettings = null;
```

**CSS strategy:** Use CSS classes on the root container, NOT separate stylesheets.

```css
/* Dark mode (default) */
.agent-bar-ubuntu-indicator__provider {
  background-color: rgba(40, 44, 52, 0.92);
  color: #abb2bf;
  border: 1px solid rgba(171, 178, 191, 0.16);
}

/* Light mode override */
.agent-bar--light .agent-bar-ubuntu-indicator__provider {
  background-color: rgba(255, 255, 255, 0.92);
  color: #383a42;
  border: 1px solid rgba(56, 58, 66, 0.16);
}
```

**Why `color-scheme` instead of `St.ThemeContext`:** `St.ThemeContext.changed` fires when the shell CSS theme is swapped, but does NOT expose a dark/light boolean. The GSettings `color-scheme` key is the canonical source for dark vs. light preference since GNOME 42 and is what libadwaita/GTK4 apps use.

**Ubuntu 24.04 ships GNOME 46** -- `color-scheme` GSettings key is fully available.

**No new dependencies needed.** `Gio.Settings` is already imported and available in the extension.

**Confidence: HIGH** -- GSettings `color-scheme` key verified via GNOME documentation (introduced GNOME 42). Ubuntu 24.04 ships GNOME 46.

---

## 6. GJS Memory Management (Indicator Memory Leak Fix)

**Problem:** `indicator.js` `_render()` method (line 129-131) removes children from `_box` but never calls `.destroy()` on the removed actors. This leaks GObject/Clutter actors on every re-render (every 2.5 minutes from polling).

### Pattern: Destroy Actors Before Removing

Per GNOME Shell review guidelines: "Any objects or widgets created by an extension MUST be destroyed in `disable()`." This extends to actors created in render cycles.

| API | Purpose |
|-----|---------|
| `actor.destroy()` | Destroys the Clutter actor and releases its resources |
| `container.destroy_all_children()` | Destroys all children of a container (convenience) |

**Fix pattern for the _render() method:**

```javascript
_render() {
  const summary = buildIndicatorSummaryViewModel(this._state);

  // CRITICAL FIX: destroy old actors, not just remove them
  for (const [, slot] of this._providerActors) {
    slot.container.destroy(); // destroys children recursively
  }
  this._providerActors.clear();

  // Or alternatively, use the container method:
  // this._box.destroy_all_children();

  // ... create new provider slots ...
}
```

**Why `destroy()` is needed:** In GJS/Clutter, `remove_child()` detaches an actor from its parent but does NOT free its resources. The actor continues to exist in memory. Only `destroy()` releases the underlying C resources (GObject ref count, Clutter allocations, signal connections). Since `_render()` is called every poll cycle (~2.5 min) and on every state change, this leak compounds over time.

**Additional cleanup requirements per GNOME review guidelines:**

| Requirement | Status in Current Code | Fix |
|-------------|----------------------|-----|
| Destroy all actors in `disable()` | Partially done (`destroy()` called on `this` via PanelMenu.Button) | Ensure `_providerActors` are destroyed before `super.destroy()` |
| Remove all GLib sources in `disable()` | Current code uses `globalThis.setInterval`, not `GLib.timeout_add` | Migrate to `GLib.timeout_add_seconds` and track source IDs |
| Disconnect all signals in `disable()` | No signal connections in indicator | OK (but will need for theme detection) |

**No new dependencies needed.** `destroy()` is a built-in method on all Clutter/St actors.

**Confidence: HIGH** -- Verified via GNOME Shell review guidelines at gjs.guide.

---

## 7. Backend Subprocess Timeouts (Bun Side)

**Problem:** The backend coordinator and some provider fetchers may hang without timeouts.

### Pattern: AbortSignal.timeout() with Bun.spawn

Bun supports the standard `AbortSignal.timeout()` API. For subprocess timeouts on the backend side:

```typescript
// For fetch()-based providers (Claude API):
const response = await fetch(url, {
  signal: AbortSignal.timeout(10_000), // 10s timeout
  headers: { ... },
});

// For Bun.spawn-based providers:
// Already implemented in codex-appserver-fetcher.ts with setTimeout+settle pattern.
// The existing pattern is correct -- just needs consistent application.
```

The Codex appserver fetcher already has a proper timeout (`REQUEST_TIMEOUT_MS = 10_000`). The pattern needs to be applied consistently to all providers.

**No new dependencies needed.** `AbortSignal.timeout()` is a web standard available in Bun.

**Confidence: HIGH** -- Standard Web API, supported in Bun.

---

## 8. Shell Injection Fix (Auth Command)

**Problem:** `auth-command.ts` line 225 uses `exec(\`xdg-open ${url}\`)` which is vulnerable to shell injection if the URL contains shell metacharacters.

### Fix: Use `Bun.spawn` with Array Arguments (No Shell)

```typescript
// BEFORE (vulnerable):
exec(`xdg-open ${url}`, () => {});

// AFTER (safe):
function defaultOpenBrowser(url: string): void {
  try {
    Bun.spawn(['xdg-open', url], {
      stdout: 'ignore',
      stderr: 'ignore',
    });
  } catch {
    // Best-effort: xdg-open may not be available
  }
}
```

**Why this works:** `Bun.spawn()` with an array argument does NOT invoke a shell. Each element is passed directly as a separate argument to `execvp()`, preventing shell interpretation of metacharacters.

**No new dependencies needed.** `Bun.spawn` is already used throughout the codebase.

**Confidence: HIGH** -- Standard subprocess safety pattern. Bun.spawn with array arguments confirmed to bypass shell.

---

## Recommended Stack (v2.1 Additions Summary)

### New Capabilities (No New Dependencies)

| Capability | Implementation | Source |
|------------|---------------|--------|
| Atomic file writes | `writeFileSync` + `renameSync` (temp+rename pattern) | `node:fs` via Bun compat |
| GJS subprocess timeouts | `GLib.timeout_add` + `Gio.Cancellable` | `gi://GLib`, `gi://Gio` (already imported) |
| Theme detection | `Gio.Settings` + `color-scheme` GSettings key | `gi://Gio` (already imported) |
| Actor memory cleanup | `actor.destroy()` on re-render | `gi://Clutter`, `gi://St` (already imported) |
| Shell injection fix | `Bun.spawn(['xdg-open', url])` | Built-in Bun API |
| Backend timeouts | `AbortSignal.timeout()` / existing setTimeout pattern | Web standard |
| Crash loop detection | `StartLimitIntervalSec` + `StartLimitBurst` in systemd | systemd directives |
| Resource limits | `MemoryMax`, `CPUQuota`, `TasksMax` in systemd | systemd directives |

### New CI Tooling

| Tool | Version | Purpose |
|------|---------|---------|
| `oven-sh/setup-bun` (GitHub Action) | `v2` | Install Bun in CI runners |
| `actions/checkout` (GitHub Action) | `v4` | Standard checkout |

### No New npm Dependencies

**v2.1 adds ZERO new production or dev dependencies.** Every fix uses APIs already available in the existing stack (Bun built-ins, node:fs compat, GJS/GLib/Gio introspection, systemd directives, web standards).

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `write-file-atomic` npm package | Unnecessary for a 10-line pattern | Manual `writeFileSync` + `renameSync` |
| `proper-lockfile` npm package | Cache is single-writer (systemd service) | Atomic rename is sufficient |
| `node:child_process.exec()` for subprocess | Invokes shell, enables injection | `Bun.spawn()` with array args |
| System-level systemd service | Requires root, complicates DBUS/Keyring access | User service with resource limits |
| `ProtectSystem=strict` in user service | **Does not work** in user units | `MemoryMax` + `TasksMax` + crash loop detection |
| Separate dark/light CSS files | Complex to load/unload dynamically | CSS class toggle on root container |
| `St.ThemeContext` for dark/light detection | Does not expose dark/light boolean | `Gio.Settings` + `color-scheme` GSettings key |
| `setTimeout`/`setInterval` in GNOME extension | Not tracked by GLib main loop, cannot be cleaned up in `disable()` | `GLib.timeout_add_seconds` with source ID tracking |

---

## Version Compatibility Matrix

| Component | Version | Compatible With | Notes |
|-----------|---------|-----------------|-------|
| Bun | 1.3.10 | `node:fs` rename (100% compat) | Latest stable as of 2026-03-18 |
| `oven-sh/setup-bun` | v2 | Bun 1.3.x, GitHub Actions `ubuntu-latest` | Official Bun CI action |
| GNOME Shell | 46 (Ubuntu 24.04 LTS) | `color-scheme` GSettings key (GNOME 42+) | Fully available |
| `Gio.Subprocess` | GLib 2.40+ | GNOME 46, `communicate_utf8_async` | Fully available |
| `GLib.timeout_add` | GLib 2.0+ | All GNOME versions | Core GLib API |
| systemd `MemoryMax` | systemd 231+ | Ubuntu 24.04 (systemd 255) | Works in user units |
| systemd `TasksMax` | systemd 228+ | Ubuntu 24.04 (systemd 255) | Works in user units |
| systemd `StartLimitBurst` | systemd 229+ | Ubuntu 24.04 (systemd 255) | Works in user units |

---

## Sources

- [Bun docs: File I/O](https://bun.com/docs/runtime/file-io) -- Bun.write() API, verified HIGH confidence
- [Bun API Reference: fs/promises/rename](https://bun.com/reference/node/fs/promises/rename) -- node:fs rename compat, verified HIGH confidence
- [Bun docs: CI/CD with GitHub Actions](https://bun.com/docs/guides/runtime/cicd) -- setup-bun action, verified HIGH confidence
- [oven-sh/setup-bun GitHub](https://github.com/oven-sh/setup-bun) -- Action v2 features, caching, verified HIGH confidence
- [Bun releases](https://github.com/oven-sh/bun/releases) -- v1.3.10 latest stable (2026-03-18), verified HIGH confidence
- [GJS Guide: Subprocesses](https://gjs.guide/guides/gio/subprocesses.html) -- Gio.Subprocess + Cancellable patterns, verified HIGH confidence
- [GJS Guide: Async Programming](https://gjs.guide/guides/gjs/asynchronous-programming.html) -- GLib.timeout_add patterns, verified HIGH confidence
- [GJS Guide: Extension Review Guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html) -- Actor destruction, source cleanup, signal disconnection, verified HIGH confidence
- [systemd.exec(5) man page (Arch)](https://man.archlinux.org/man/systemd.exec.5.en) -- Sandboxing directive availability in user vs system services, verified HIGH confidence
- [Arch Wiki: systemd/Sandboxing](https://wiki.archlinux.org/title/Systemd/Sandboxing) -- User service limitations, verified HIGH confidence
- [GNOME Discourse: Read dark/light mode from shell](https://discourse.gnome.org/t/how-to-read-dark-light-mode-status-from-shell/12038) -- color-scheme GSettings approach, MEDIUM confidence
- [GNOME Blog: Dark Style Preference](https://blogs.gnome.org/alicem/2021/10/04/dark-style-preference/) -- color-scheme key introduction (GNOME 42), MEDIUM confidence
- [GJS Guide: Port to GNOME Shell 42](https://gjs.guide/extensions/upgrading/gnome-shell-42.html) -- color-scheme adoption, verified HIGH confidence
- [systemd hardening gist (ageis)](https://gist.github.com/ageis/f5595e59b1cddb1513d1b425a323db04) -- Comprehensive directive reference, MEDIUM confidence
- [Fedora SystemdSecurityHardening](https://fedoraproject.org/wiki/Changes/SystemdSecurityHardening) -- Distro-level hardening initiative, MEDIUM confidence

---
*Stack research for: v2.1 Stability & Hardening -- Agent Bar Ubuntu*
*Researched: 2026-04-05*

# Agent Bar Ubuntu v2.1 — Codebase Hardening & Quality Milestone

**Date:** 2026-04-05
**Author:** Comprehensive audit of ~10,000 LOC across backend (Bun/TS), GNOME extension (GJS), and infrastructure
**Status:** Design — pending approval

## Context

Agent Bar Ubuntu v2.0 shipped on 2026-03-29 with a working end-to-end stack: Bun/TypeScript backend, GNOME Shell extension, systemd service, and CLI with `agent-bar auth copilot`. The architecture is well-structured with clean separation of concerns, dependency injection, and immutable state management.

However, a deep audit of every file revealed **24 issues** that collectively prevent the system from being production-grade for long-running usage. The most critical: memory leaks in the GNOME extension that grow linearly over time, a shell injection vulnerability, race conditions in file-backed cache, and complete absence of CI/CD.

This milestone addresses all findings through 5 sequential waves, each leaving the system strictly better than before.

## Scope

All 24 issues organized into 5 waves. Each wave is independently shippable and leaves the system in a better state.

## Wave 0: Foundation — Security, Crashes & Memory Safety

### 0a: Test Safety Net for GNOME Extension UI

**Rationale:** `indicator.js` (180 LOC) and `menu-builder.js` (86 LOC) have 0% test coverage. Fixing the memory leak without tests is unsafe because GJS `destroy()` behavior on Clutter/St actors is subtle — calling `destroy()` on an already-destroyed actor crashes GNOME Shell.

**Files to create:**
- `apps/gnome-extension/test/indicator.test.js`
- `apps/gnome-extension/test/menu-builder.test.js`

**What to test:**
- `_render()` creates correct number of provider slots
- `_render()` called twice doesn't duplicate actors
- `setState()` triggers re-render with new data
- `destroy()` cleans up all references
- `rebuildMenu()` creates expected menu items
- `rebuildMenu()` called twice doesn't leak items

**Approach:** Mock GObject/St/Clutter with minimal stubs (like existing tests do), verify actor lifecycle.

### 0b: Memory Leak Fix + Shell Injection + Global Error Handlers

**Issue 1 — Memory leak in `indicator.js:125-131`**

```
Current:  remove_child(child) without destroy() → actors accumulate
Fix:      destroy() each actor before clearing the map
Location: apps/gnome-extension/panel/indicator.js, _render() and destroy()
```

Specific changes:
- In `_render()`: before the `remove_child` loop, iterate `this._providerActors.values()` and call `slot.container.destroy()` on each
- In `destroy()`: iterate `this._providerActors.values()` and call `slot.container.destroy()` before `clear()`

**~~Issue 1b~~ — FALSE POSITIVE: `menu-builder.js:45` is safe**

GNOME Shell's `PopupMenu.removeAll()` already calls `item.destroy()` on each menu item internally ([source](https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/popupMenu.js)). No fix needed.

**Issue 5 — Shell injection in `auth-command.ts:225`**

```
Current:  exec(`xdg-open ${url}`)
Fix:      execFile('xdg-open', [url])
Location: apps/backend/src/commands/auth-command.ts, defaultOpenBrowser()
```

The `url` comes from GitHub's Device Flow API response (`verification_uri`), so it's semi-trusted, but proper escaping is still required. `execFile` passes args as an array, avoiding shell interpretation entirely.

```typescript
// Before
import { exec } from 'node:child_process';
function defaultOpenBrowser(url: string): void {
  exec(`xdg-open ${url}`, () => {});
}

// After
import { execFile } from 'node:child_process';
function defaultOpenBrowser(url: string): void {
  execFile('xdg-open', [url], () => {});
}
```

**Issue 6 — No global error handlers in service runtime**

```
Location: apps/backend/src/commands/service-command.ts, runServiceRunCommand() (line 83)
Fix:      Add process.on('unhandledRejection') and process.on('uncaughtException') before runtime.start()
```

```typescript
// Add at the top of runServiceRunCommand(), before runtime.start()
process.on('unhandledRejection', (reason) => {
  console.error('[agent-bar] Unhandled rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[agent-bar] Uncaught exception:', error);
  process.exitCode = 1;
});
```

### 0c: Race Condition + Silent Error Swallowing

**Issue 2 — Non-atomic file write in `snapshot-cache.ts:73`**

```
Current:  writeFileSync(path, data) — reader can see partial JSON
Fix:      Write to temp file, then rename (atomic on same filesystem)
Location: apps/backend/src/cache/snapshot-cache.ts, set() method
Also:     apps/backend/src/service/service-server.ts, persistLatestSnapshot()
```

```typescript
// Atomic write helper
import { renameSync, writeFileSync } from 'node:fs';

function atomicWriteFileSync(filePath: string, data: string): void {
  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, data, 'utf8');
  renameSync(tmpPath, filePath);
}
```

Apply in both locations:
- `snapshot-cache.ts:73` — `set()` method
- `service-server.ts:102` — `persistLatestSnapshot()`

**Issue 3 — Silent error swallowing in `service-server.ts:169,271`**

```
Current:  void refreshSnapshot(true).catch(() => undefined)
Fix:      Log the error, update lastError state
```

```typescript
// Before (line 169)
void refreshSnapshot(true).catch(() => undefined);

// After
void refreshSnapshot(true).catch((error) => {
  console.error('[agent-bar] Periodic refresh failed:', error instanceof Error ? error.message : error);
});

// Before (line 271)
void refreshSnapshot(true).catch(() => undefined);

// After
void refreshSnapshot(true).catch((error) => {
  console.error('[agent-bar] Initial refresh failed:', error instanceof Error ? error.message : error);
});
```

Note: `lastError` is already set inside `refreshSnapshot()` catch block (line 149), so we only need to add console logging.

### 0d: Subprocess Timeouts

**Issue 4a — GNOME extension subprocess has no timeout**

```
Location: apps/gnome-extension/services/backend-client.js, runGioSubprocess()
Fix:      Add GLib.timeout_add that sends SIGTERM after 30s
```

**Issue 4b — Backend coordinator has no global timeout**

```
Location: apps/backend/src/core/backend-coordinator.ts (or usage-snapshot.ts)
Fix:      Wrap Promise.all with AbortController or Promise.race timeout
```

**Issue 4c — Codex app-server subprocess can dangle**

```
Location: apps/backend/src/providers/codex/codex-appserver-fetcher.ts
Fix:      Ensure settle() properly kills subprocess and resolves/rejects
```

## Wave 1: Quality Gate — CI/CD + Stricter Rules

### 1a: GitHub Actions CI

**File to create:** `.github/workflows/ci.yml`

```yaml
name: CI
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build:backend
      - run: pnpm test:backend
      - run: pnpm test:gnome
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build:shared
      - run: cd apps/backend && bun x tsc --noEmit
```

### 1b: Stricter Biome Rules

**File to modify:** `biome.json`

Enable incrementally:
1. `noExplicitAny: "warn"` → fix violations → promote to `"error"`
2. `noNonNullAssertion: "warn"` → fix violations → promote to `"error"`
3. `useNodejsImportProtocol: "warn"` (Bun supports `node:` prefix)

### 1c: .editorconfig

**File to create:** `.editorconfig`

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

## Wave 2: Robustness — Production Hardening

### 2a: systemd Hardening

**File to modify:** `packaging/systemd/user/agent-bar.service`

Add:
```ini
StandardOutput=journal
StandardError=journal
TimeoutStartSec=15s
TimeoutStopSec=10s
StartLimitBurst=5
StartLimitIntervalSec=60s
```

### 2b: Config Safety

**Issue 14 — Config defaults mutation risk**

```
Location: apps/backend/src/config/config-schema.ts
Fix:      Object.freeze() on default config objects
```

### 2c: CSS Theme Awareness

**File to modify:** `apps/gnome-extension/stylesheet.css`

The current stylesheet is hardcoded for dark theme (One Dark palette). Add light theme support via GNOME's StThemeNode properties or conditional classes.

Note: GNOME Shell CSS does NOT support `@media (prefers-color-scheme)`. Instead, detect theme at runtime in `extension.js` and apply a CSS class:
```javascript
// In enable()
const settings = St.Settings.get();
const isDark = settings.gtk_theme?.includes('dark') ?? true;
this._indicator.add_style_class_name(isDark ? 'agent-bar--dark' : 'agent-bar--light');
```

### 2d: Snapshot Schema Versioning

**Issue 13 — No versioning strategy**

```
Location: packages/shared-contract/src/snapshot.ts
Fix:      Document version migration path, add version assertion on load
```

### 2e: Claude Token Refresh

**Issue 8 — OAuth token refresh not implemented**

```
Location: apps/backend/src/providers/claude/claude-api-fetcher.ts
Status:   This is a FEATURE, not a bug fix. Requires understanding Anthropic's OAuth refresh flow.
Approach: Read credentials.expiresAt; if expired, attempt refresh via refresh_token if present.
          If no refresh_token exists (most likely), surface clear error suggesting `claude auth login`.
```

This item may be descoped if Anthropic's OAuth doesn't expose refresh tokens to CLI consumers.

## Wave 3: Polish + Developer Experience

### 3a: Complete pnpm Scripts

**File to modify:** `package.json` (root)

Add:
```json
{
  "dev": "cd apps/backend && bun --watch src/cli.ts",
  "test": "pnpm test:backend && pnpm test:gnome",
  "typecheck": "pnpm build:shared && cd apps/backend && bun x tsc --noEmit",
  "clean": "rm -rf apps/backend/dist packages/shared-contract/dist"
}
```

### 3b: CONTRIBUTING.md Expansion

Expand with:
- Dev setup (clone, pnpm install, bun build)
- How to add a new provider
- Testing guidelines
- PR checklist
- Architecture overview (link to ubuntu-extension-analysis/)

### 3c: CHANGELOG.md

Create initial CHANGELOG.md with v2.0 as baseline.

### 3d: Retry Fix (setInterval → setTimeout)

**Issue 19 — polling-service.js uses setInterval for one-shot retry**

```
Location: apps/gnome-extension/services/polling-service.js
Fix:      Replace scheduler.setInterval with scheduler.setTimeout in scheduleRetry()
```

Functional impact: none (clearRetry() is called in callback). Semantic improvement only.

### 3e: i18n Preparation

**Issue 20 — All UI strings hardcoded in English**

For v2.1, scope to:
1. Add `gettext-domain` to `metadata.json`
2. Extract strings from `view-model.js` to a constants file
3. Wrap with `_()` for future gettext integration

Full translation support deferred to v2.2+.

## Wave 4: Refactors — Clean & Extensible Code

### 4a: Provider Abstract Base

**Issue 15 — No shared retry/error logic across providers**

Create abstract helper or shared utilities:
- `createProviderErrorSnapshot()` — replaces 5 inline calls in copilot-usage-fetcher.ts
- `withTimeout(promise, ms)` — shared timeout wrapper
- `withRetry(fn, maxRetries, backoffMs)` — shared retry logic

### 4b: Code Deduplication

**Issue 22 — buildErrorSnapshot called 5x with 10 params**

```
Location: apps/backend/src/providers/copilot/copilot-usage-fetcher.ts
Fix:      Extract common error snapshot builder, pass object instead of positional params
```

### 4c: State Cleanup

**Issue 23 — `error` duplicates `lastError` in extension state**

```
Location: apps/gnome-extension/state/extension-state.js
Fix:      Remove duplicate `error` field, keep only `lastError`
          Update all consumers (view-model.js, polling-service.js)
```

### 4d: API Version Headers

**Issue 24 — Hardcoded `X-Github-Api-Version: 2025-04-01`**

```
Location: apps/backend/src/providers/copilot/copilot-usage-fetcher.ts
Fix:      Move to config constant or read from package.json
```

## Non-Goals

- New providers (Cursor, Amp) — deferred to v2.2
- Additional surfaces (Waybar, AppIndicator) — deferred to v2.2+
- Historical usage trends — deferred to v3.0
- AppImage/deb distribution — deferred to v2.2
- Docker dev environment — nice-to-have, not committed
- Full i18n with translations — v2.2+

## Verification Plan

### Per-Wave Verification

**Wave 0:**
- Run `pnpm test:gnome` — new indicator/menu tests pass
- Run `pnpm test:backend` — existing tests still pass
- Manual: enable extension, check GNOME Shell `journalctl --user -u gnome-shell` for no memory-related warnings
- Manual: run `agent-bar auth copilot` — xdg-open still works (no regression from execFile change)
- Manual: kill backend mid-fetch — verify GNOME extension shows error state (not hang)

**Wave 1:**
- Push to GitHub — CI passes (lint + test + typecheck)
- `pnpm lint` catches `any` types with warnings
- `.editorconfig` recognized by VS Code/JetBrains

**Wave 2:**
- `systemctl --user status agent-bar` shows journal output
- Rapid restart doesn't cause infinite loop (StartLimitBurst)
- Extension looks correct in both light and dark GNOME themes
- Config loaded with `Object.freeze` doesn't allow mutation

**Wave 3:**
- `pnpm dev` starts watch mode
- `pnpm test` runs all suites
- CHANGELOG.md exists with v2.0 entry
- CONTRIBUTING.md has provider addition guide

**Wave 4:**
- All 29+ backend test files still pass
- All 6+ GNOME test files still pass
- No `buildErrorSnapshot` with > 5 positional params remains
- Extension state has no duplicate `error`/`lastError`

### End-to-End Smoke Test

After all waves:
1. Fresh `pnpm install && pnpm build:backend`
2. `scripts/install-ubuntu.sh` completes
3. `scripts/verify-ubuntu-install.sh` all green
4. `agent-bar doctor` reports healthy
5. `agent-bar usage --json` returns valid envelope
6. GNOME extension shows providers in topbar
7. Menu dropdown opens with correct data
8. `journalctl --user -u agent-bar` shows structured logs
9. Leave running for 1 hour — no visible memory growth in GNOME Shell

## Risk Assessment

| Wave | Risk | Mitigation |
|------|------|------------|
| 0 | GJS destroy() behavior different than expected | Write tests first (0a before 0b) |
| 0 | Atomic write may behave differently on tmpfs | Test on both ext4 and tmpfs |
| 1 | Biome strict rules may surface many violations | Start with "warn", fix incrementally |
| 2 | CSS theme detection may not work on all GNOME versions | Fallback to dark theme (current behavior) |
| 2 | Claude token refresh may not be possible | Graceful degradation to "please re-auth" message |
| 4 | Provider refactor may break adapter contracts | Existing test coverage is good for providers |

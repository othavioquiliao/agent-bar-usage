# Phase 14: Quality Gate & Production Hardening - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Enforce stricter lint rules across the TypeScript codebase, harden the systemd user service with resource limits and operational guards, make the GNOME extension theme-aware (dark/light), freeze config defaults against accidental mutation, and add schema versioning to the snapshot cache. Covers 6 requirements: QUAL-01, QUAL-02, HARD-01, HARD-02, HARD-03, HARD-04.

</domain>

<decisions>
## Implementation Decisions

### Biome Strict Lint Rules (QUAL-01)
- **D-01:** Enable all 3 rules as `"error"` directly — only 2 violations exist in the entire codebase, so a gradual `"warn"` phase is unnecessary overhead. Fix violations in the same commit that enables the rules.
- **D-02:** Fix `as any` in `apps/backend/test/settings.test.ts:68` by replacing with `as unknown as Partial<Settings>`. This is idiomatic TypeScript for intentionally passing non-conforming data in tests without opening an `any` hole.
- **D-03:** Fix non-null assertion in `apps/backend/src/auth/config-writer.ts:69` by adding an explicit null check with `throw`. The function uses `copilotIndex` twice (read on line 69, write on line 83), so `.find()` refactor would still need index-based access for the write. A defensive guard is the proportional fix.
- **D-04:** `useNodejsImportProtocol` has zero violations — all TypeScript files already use `node:` prefix. Enabling it prevents future regressions.

### EditorConfig (QUAL-02)
- **D-05:** Create `.editorconfig` at repo root matching existing Biome formatter config: 2-space indent, LF line endings, UTF-8, 120-char line width. Insert before final newline, trim trailing whitespace.

### systemd Service Hardening (HARD-01)
- **D-06:** Use two-tier memory defense: `MemoryHigh=256M` (soft throttle via kernel reclaim) + `MemoryMax=512M` (hard OOM kill). Bun idle RSS is ~28MB; 256M is 9x headroom. MemoryHigh triggers gradual throttling, giving the service a chance to recover from transient spikes before the hard cap kills it.
- **D-07:** `TasksMax=50` — Bun is single-threaded JS with ~6-10 internal threads plus occasional `Bun.spawn` subprocesses. 50 is sufficient for current 3-provider architecture with margin for future additions.
- **D-08:** `StartLimitBurst=5` + `StartLimitIntervalSec=300` — allows 5 restarts in 5 minutes, accommodating desktop session startup races (DBUS, GNOME Keyring, network may not be ready simultaneously with `After=default.target`).
- **D-09:** Additional directives (zero app code changes):
  - `StandardOutput=journal` + `StandardError=journal` — explicit log routing (declares default for clarity)
  - `TimeoutStartSec=30` + `TimeoutStopSec=10` — prevents hung startup (default is infinity for Type=simple) and ensures clean shutdown path from Phase 13's SIGTERM handler runs
  - `Nice=10` — lower scheduling priority than user apps, desktop responsiveness preserved
- **D-10:** Defer `WatchdogSec` — requires `Type=notify` + `sd_notify("WATCHDOG=1")` integration in Bun app code (~20-30 lines + runtime dependency). Not justified for current stability profile; revisit if silent hangs become an issue.
- **D-11:** Defer `EnvironmentFile` — no user-configurable env vars exist yet. Add when needed.

### Object.freeze on Config Defaults (HARD-02)
- **D-12:** Shallow `Object.freeze(DEFAULT_SETTINGS)` in `settings-schema.ts` — this is the one true shared singleton. `Settings` type is flat (`{ version: number }`), so shallow freeze = complete protection.
- **D-13:** Add `Readonly<BackendConfig>` as return type of `createDefaultConfig()` — compile-time safety at zero runtime cost. The factory already returns new objects per call (preventing shared mutation), so runtime freeze adds no value here.
- **D-14:** No deep freeze utility needed. The factory pattern for `BackendConfig` already provides isolation, and TypeScript's `Readonly<>` catches accidental mutation at compile time.

### CSS Theme Awareness (HARD-03)
- **D-15:** Use GNOME 46's **built-in dual-stylesheet mechanism** — zero JavaScript changes required. GNOME Shell's `extensionSystem.js` automatically:
  1. Resolves `Main.getStyleVariant()` to determine dark/light from `org.gnome.desktop.interface color-scheme`
  2. Loads `stylesheet-${variant}.css` with fallback to `stylesheet.css`
  3. Listens to `St.Settings` `notify::color-scheme` signal and auto-swaps stylesheets on theme change
  This is the same mechanism used by official GNOME Shell extensions (`window-list`, `workspace-indicator`).
- **D-16:** Rename current `stylesheet.css` to `stylesheet-dark.css` (it already uses One Dark palette). Create new `stylesheet-light.css` with **adaptive contrast**: same layout/structure, inverted background/text luminance. Not a full redesign — keep BEM class structure identical.
- **D-17:** Provider brand colors in light mode: use **slightly darkened variants** for better contrast. The yellow (`#e5c07b`) has only ~2.1:1 contrast ratio against white — unacceptable for accessibility. Darken hue by ~15% lightness for light stylesheet while keeping same hue identity.
- **D-18:** Keep `stylesheet.css` as a copy of `stylesheet-dark.css` for fallback — GNOME Shell loads plain `stylesheet.css` if the variant file is missing or on pre-46 shells.

### Snapshot Cache Schema Versioning (HARD-04)
- **D-19:** Add flat `cacheSchemaVersion: number` field to `SnapshotCacheEntry` interface. Follows existing pattern from `config-schema.ts` (`schemaVersion: 1` with hard equality check).
- **D-20:** Define separate `CACHE_SCHEMA_VERSION = 1` constant in `snapshot-cache.ts` — independent of `snapshotSchemaVersion` from `shared-contract`, since cache wrapping format and API snapshot schema evolve on different timelines.
- **D-21:** Fail-fast version check: immediately after `JSON.parse`, before `assertProviderSnapshot`. If `entry.cacheSchemaVersion !== CACHE_SCHEMA_VERSION`, return `null` (graceful reset). The existing `catch` block already returns `null`, so this is consistent.
- **D-22:** No migration logic needed — cache TTL is 30 seconds and auto-repopulates on next poll cycle. A cache miss on version mismatch costs one extra API poll (sub-second). Migration logic would be over-engineering for an ephemeral cache.

### Claude's Discretion
- Exact light theme color palette values (as long as contrast ratios pass WCAG AA for text)
- Whether to add a `[Unit] Documentation=` directive to the systemd service
- Whether the `as unknown as Partial<Settings>` fix needs a clarifying comment in the test
- Exact `TimeoutStartSec` value (30s recommended but 15-45s range is acceptable)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — QUAL-01, QUAL-02, HARD-01 through HARD-04 definitions
- `.planning/ROADMAP.md` §Phase 14 — Success criteria (4 testable conditions)

### Prior Phase Context
- `.planning/phases/13-critical-security-stability-fixes/13-CONTEXT.md` — Phase 13 decisions (SIGTERM handler, atomic write utility referenced by HARD-04)

### Codebase Analysis
- `.planning/codebase/ARCHITECTURE.md` — Layer boundaries and data flow
- `.planning/codebase/CONCERNS.md` — Tech debt from audit

</canonical_refs>

<code_context>
## Existing Code Insights

### Files to Modify
- `biome.json` — QUAL-01: enable `noExplicitAny`, `noNonNullAssertion`, `useNodejsImportProtocol` as `"error"`
- `apps/backend/test/settings.test.ts:68` — QUAL-01: `as any` → `as unknown as Partial<Settings>`
- `apps/backend/src/auth/config-writer.ts:69` — QUAL-01: `providers[copilotIndex]!` → null check with throw
- `packaging/systemd/user/agent-bar.service` — HARD-01: add MemoryHigh/Max, TasksMax, StartLimitBurst, timeouts, Nice
- `apps/backend/src/settings/settings-schema.ts:7-9` — HARD-02: wrap `DEFAULT_SETTINGS` in `Object.freeze()`
- `apps/backend/src/config/default-config.ts:3` — HARD-02: change return type to `Readonly<BackendConfig>`
- `apps/gnome-extension/stylesheet.css` — HARD-03: rename to `stylesheet-dark.css`, create `stylesheet-light.css`
- `apps/backend/src/cache/snapshot-cache.ts:10-14` — HARD-04: add `cacheSchemaVersion` to `SnapshotCacheEntry`
- `apps/backend/src/cache/snapshot-cache.ts:50-63` — HARD-04: add version check before `assertProviderSnapshot`

### New Files
- `.editorconfig` — QUAL-02: IDE formatting consistency
- `apps/gnome-extension/stylesheet-light.css` — HARD-03: light theme variant
- `apps/gnome-extension/stylesheet-dark.css` — HARD-03: renamed from current stylesheet.css

### Established Patterns
- Biome config at repo root with `includes` array scoping lint to specific directories
- systemd user service at `packaging/systemd/user/` — minimal unit file pattern
- `Object.freeze()` not yet used in codebase — this will be the first instance
- GNOME extension uses BEM-style CSS class naming (`__element--modifier`) — keep this pattern in both stylesheets
- `config-schema.ts` has `schemaVersion: 1` pattern — reuse for cache versioning
- Phase 13 added `atomicWriteFileSync` utility — cache writes already use it

### Integration Points
- Biome rules affect all files in `includes` scope — `apps/backend/src/**/*.ts`, `apps/backend/test/**/*.ts`, `apps/gnome-extension/**/*.js`, `packages/shared-contract/src/**/*.ts`
- systemd service file is installed by `apps/backend/src/commands/setup-command.ts` — verify it copies the updated file
- GNOME extension loads stylesheets via `extensionSystem.js` — no manual loading code changes needed for dual-stylesheet
- `SnapshotCacheEntry` is used by `snapshot-cache.ts` only — schema change is self-contained

</code_context>

<specifics>
## Specific Ideas

- GNOME 46's `extensionSystem.js` resolves variant via `Main.getStyleVariant()` which maps `color-scheme` GSettings → `'dark'`|`'light'`|`''` → loads `stylesheet-{variant}.css` with plain `stylesheet.css` fallback
- The `window-list` and `workspace-indicator` official extensions use this exact dual-stylesheet pattern on GNOME 46+
- Yellow provider color (`#e5c07b`) fails WCAG AA against white backgrounds (~2.1:1 ratio) — light stylesheet must use a darkened variant

</specifics>

<deferred>
## Deferred Ideas

- **WatchdogSec** — requires Type=notify + sd_notify integration in Bun; revisit if silent hangs emerge
- **EnvironmentFile** — no user-configurable env vars yet; add when feature emerges
- **Deep freeze utility** — not needed with factory pattern + Readonly<>; revisit if more shared config singletons appear
- **CSS custom properties** — St CSS engine in GNOME Shell does not support CSS variables; when/if St gains support, consolidate dual stylesheets into one

</deferred>

---

*Phase: 14-quality-gate-production-hardening*
*Context gathered: 2026-04-05*
*Discussion method: Autonomous Claude + Codex parallel research on 5 gray areas*

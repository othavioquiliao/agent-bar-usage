# Project Research Summary

**Project:** Agent Bar Ubuntu v2.1 -- Stability & Hardening
**Domain:** Linux-native desktop tool hardening (Bun/TypeScript backend + GNOME Shell extension)
**Researched:** 2026-04-05
**Confidence:** HIGH

## Executive Summary

Agent Bar Ubuntu v2.1 is a hardening milestone, not a feature milestone. The v2.1 audit identified 24 issues across the existing Bun/TypeScript backend service and GNOME Shell extension (GJS), with 6 critical findings: a memory leak from undestroyed Clutter actors in the GNOME indicator, a shell injection vulnerability in the auth command, a race condition in snapshot cache writes, missing global error handlers in the service runtime, missing subprocess timeouts in both the GNOME extension and backend coordinator, and no CI pipeline. The research confirms that every critical fix can be implemented using APIs already available in the existing stack -- v2.1 requires zero new production dependencies.

The recommended approach is a wave-based delivery model structured around dependency chains and risk reduction. Critical security and stability fixes ship first (memory leak, shell injection, atomic writes, error handlers, subprocess timeouts), followed by CI/DX infrastructure, then production hardening (systemd, theme awareness, schema versioning), and finally developer experience improvements. All four research files converge on the same conclusion: the existing architecture is sound and the fixes are surgical -- they change 8 existing files and add 2 small utility files. The architecture does not need restructuring; it needs the safety nets that a production desktop service demands.

The key risk is the GNOME extension layer, where GJS-specific patterns (Clutter actor lifecycle, GLib main loop sources, Gio.Cancellable) differ significantly from standard JavaScript. Developers must not assume web/Node.js patterns apply -- `remove_child()` does not free actors, `globalThis.setInterval` is not the correct GJS primitive, and `Gio.Cancellable.cancel()` does not kill subprocesses. The research also warns against copy-pasting systemd hardening directives from system-service guides into user services, since most sandboxing directives (`ProtectSystem`, `ProtectHome`, `PrivateTmp`) silently fail in user-mode units.

## Key Findings

### Recommended Stack

v2.1 adds zero new npm dependencies. Every fix uses APIs already available in the existing stack: `node:fs` rename via Bun compat (atomic writes), `GLib.timeout_add` + `Gio.Cancellable` (GJS subprocess timeouts), `Gio.Settings` for `color-scheme` GSettings key (theme detection), `Clutter.Actor.destroy()` (memory leak), `Bun.spawn` with array args (shell injection fix), `AbortSignal.timeout()` (backend timeouts), and systemd directives for resource limits.

**Core additions (no new dependencies):**
- `atomicWriteFileSync` utility: `writeFileSync` to temp + `renameSync` -- prevents cache corruption on crash
- `withTimeout` utility: `AbortSignal.timeout()` / `Promise.race` -- prevents hung provider fetches
- `oven-sh/setup-bun@v2` GitHub Action: official Bun CI action -- enables lint/typecheck/test in CI
- systemd `MemoryMax`, `CPUQuota`, `TasksMax`, `StartLimitBurst`: resource limits that work in user services
- `Gio.Settings` `color-scheme` key: canonical dark/light detection since GNOME 42, fully available on Ubuntu 24.04 (GNOME 46)

**Critical version requirements:**
- Bun 1.3.10 (pinned for CI determinism; `node:fs` rename 100% compat)
- GNOME Shell 46 (Ubuntu 24.04 LTS; `color-scheme` GSettings key available)
- systemd 255 (Ubuntu 24.04; `MemoryMax`, `TasksMax`, `StartLimitBurst` work in user units)

### Expected Features

**Must have (table stakes -- P0):**
- Memory leak fix in GNOME indicator -- actors destroyed on re-render (prevents desktop degradation)
- Shell injection fix in auth command -- `Bun.spawn` replaces `exec` (eliminates security vulnerability)
- Atomic file writes for snapshot cache -- write-to-temp + rename (prevents data corruption)
- Global error handlers in service runtime -- `uncaughtException` + `unhandledRejection` (prevents silent deaths)
- Subprocess timeouts across all 3 sites -- GNOME extension, coordinator, codex appserver (prevents indefinite hangs)
- GitHub Actions CI pipeline -- lint + typecheck + test (prevents undetected regressions)

**Should have (competitive advantage -- P1):**
- CSS theme awareness via `color-scheme` GSettings -- extension works on both dark and light themes
- systemd service hardening -- `MemoryMax`, `TasksMax`, crash loop detection (resource control)
- Stricter Biome lint rules -- `useNodejsImportProtocol` first, `noNonNullAssertion` next (progressive code quality)
- Config safety -- validation on every read, graceful fallback (resilient configuration)
- Snapshot schema versioning -- migration functions for future-proofing (upgrade safety)
- Claude token refresh awareness -- detect expiry, show clear message instead of cryptic 401

**Defer to v2.2+ (refactoring risk):**
- Provider abstract helpers / code dedup -- benefits future providers but carries regression risk
- API version headers -- low risk but low urgency
- `noExplicitAny` Biome rule -- requires type annotations on many boundaries
- Full ESM migration -- both CJS and ESM work transparently in Bun

**Anti-features (explicitly rejected):**
- Rewriting GNOME extension in TypeScript -- GJS type definitions incomplete, adds build complexity for ~500 lines
- Adding structured logging framework (pino/winston) -- systemd journal is sufficient for single-user desktop service
- Per-call retry logic for providers -- polling interval already serves as retry mechanism; per-call retries create retry storms
- Sentry/error tracking -- local desktop tool, not a cloud service; systemd journal is the correct error sink

### Architecture Approach

The existing architecture is a two-layer system -- GNOME Shell extension (GJS) communicating with a Bun/TypeScript backend service via CLI subprocess (`Gio.Subprocess` -> `agent-bar service snapshot --json`). The v2.1 changes map to 6 distinct integration zones within this architecture, requiring modifications to 8 existing files and creation of 2 new utility files. No new components, no new IPC mechanisms, no architecture restructuring.

**Integration zones (build order determines phase structure):**
1. **Indicator Actor Lifecycle** (indicator.js) -- destroy actors before removal in `_render()`
2. **Shell Injection** (auth-command.ts) -- `exec()` to `Bun.spawn()` with array args
3. **Snapshot Cache** (snapshot-cache.ts, service-server.ts) -- atomic write utility consumed by both
4. **Global Error Handlers** (service-command.ts) -- `uncaughtException` + `SIGTERM` + socket cleanup
5. **Subprocess Timeouts** (backend-client.js, backend-coordinator.ts, codex-appserver-fetcher.ts) -- three independent timeout fixes
6. **Cross-Cutting** (CI, systemd, theme, lint) -- infrastructure that spans multiple zones

**Key data flow change:** After v2.1, every link in the chain from GNOME polling to provider fetch to cache write has a timeout, error handler, and atomic persistence. The "before" flow had 5 unguarded points; the "after" flow has zero.

### Critical Pitfalls

1. **GJS actor leak on re-render** -- `remove_child()` does NOT destroy Clutter actors. Must call `child.destroy()` explicitly. Clear `_providerActors` Map BEFORE destroying actors to avoid "Object already deallocated" critical errors. Leaks ~70 actors/hour with current polling interval.

2. **Atomic write requires same-directory temp file** -- If temp file is in `/tmp` and target is in `~/.cache/`, `renameSync` throws `EXDEV: cross-device link`. Temp file MUST be in `dirname(targetPath)`. Additionally, consider `fsync` before rename for config files (not required for regenerable cache).

3. **systemd sandboxing directives silently fail in user services** -- `ProtectSystem`, `ProtectHome`, `PrivateTmp` require mount namespaces unavailable to unprivileged user service managers. These directives are accepted without error but have no effect, giving false security. Use `MemoryMax`, `TasksMax`, `NoNewPrivileges`, and crash loop detection instead.

4. **`Gio.Cancellable.cancel()` does NOT kill GJS subprocesses** -- It only cancels the async operation. Must explicitly call `proc.force_exit()` in the timeout handler. Also, `force_exit()` does not affect child processes of the subprocess.

5. **`Promise.race` timeout leaves orphaned processes** -- When timeout wins the race, the fetch promise and its spawned subprocess continue running. Use `AbortSignal` with `Bun.spawn` (natively supported) to actually kill the process on timeout. Change `Promise.all` to `Promise.allSettled` in coordinator for fault isolation.

## Implications for Roadmap

Based on combined research, the milestone should be structured as 4 phases (called "waves" in FEATURES.md) ordered by dependency chains and risk reduction.

### Phase 1: Critical Security + Stability Fixes

**Rationale:** These are the 5 P0 issues that represent active security vulnerabilities, data corruption risks, and user-visible instability. Every other phase benefits from these fixes being in place. Global error handlers must come first because all subsequent fixes benefit from error visibility. Shell injection is the only exploitable vulnerability. Atomic write utility is a prerequisite for cache and service fixes.

**Delivers:** A service that does not leak memory, cannot be command-injected, does not corrupt cache files, logs fatal errors, and does not hang on slow providers.

**Addresses features:**
- Memory leak fix (GNOME indicator)
- Shell injection fix (auth command)
- Atomic file writes (cache + service server)
- Global error handlers (uncaughtException + SIGTERM + socket cleanup)
- Subprocess timeouts (all 3 sites: GNOME extension, coordinator, codex appserver)

**Avoids pitfalls:**
- Pitfall #1: Actor leak -- must call `destroy()` before dropping references
- Pitfall #2: Atomic write same-directory requirement + EXDEV risk
- Pitfall #3: Shell injection via `exec()` string interpolation
- Pitfall #4: Error handlers must exit on uncaughtException, not swallow
- Pitfall #5: GJS subprocess timeout must use `GLib.timeout_add` + `force_exit`, not `setInterval`
- Pitfall #8: `Promise.race` must use `AbortSignal` to kill orphaned processes

**Build order within phase:**
1. Shell injection fix + `atomicWriteFileSync` utility + `withTimeout` utility (3 independent tasks)
2. Atomic writes in cache + service server + global error handlers (depend on utility from step 1)
3. Subprocess timeouts in coordinator, GNOME extension, codex appserver (3 independent tasks; coordinator depends on utility from step 1)
4. Memory leak fix in indicator (independent but benefits from stable backend underneath)

### Phase 2: CI/DX Infrastructure

**Rationale:** CI depends on pnpm workspace scripts existing and lint rules being configured. This phase creates the safety net that prevents regressions from Phases 3-4. Must come before production hardening so that hardening changes are validated by CI.

**Delivers:** Automated validation on every PR (lint, typecheck, test). Consistent entry points for local development.

**Addresses features:**
- GitHub Actions CI pipeline (lint + typecheck + test in parallel jobs)
- pnpm workspace scripts (root-level `lint`, `test`, `typecheck`)
- Stricter Biome rules (`useNodejsImportProtocol` first, then `noNonNullAssertion`)
- `.editorconfig` for consistent formatting

**Avoids pitfalls:**
- Pitfall #9: Biome strictness escalation -- use `--changed` flag in CI, enable rules incrementally, never auto-fix `noExplicitAny` across the whole codebase
- Pitfall #10: CI cannot fully test GNOME extension -- accept this gap, run extension unit tests via Vitest, document manual E2E requirement

### Phase 3: Production Hardening

**Rationale:** Requires Phase 1 fixes to be in place (atomic writes for sandbox path alignment, error handlers for journal logging, memory leak fix before theme re-renders). These are medium-priority improvements that make the product production-grade.

**Delivers:** Desktop-theme-aware extension, resource-limited service, resilient config handling, schema migration infrastructure.

**Addresses features:**
- systemd service hardening (MemoryMax, CPUQuota, TasksMax, crash loop detection)
- CSS theme awareness (dark/light detection via `color-scheme` GSettings)
- Config safety (validation on every read, graceful fallback)
- Snapshot schema versioning (migration functions)
- Claude token refresh awareness (expiry detection)

**Avoids pitfalls:**
- Pitfall #6: systemd sandboxing directives -- stay as user service, use only directives confirmed to work in user mode, test with `systemd-analyze security --user`
- Pitfall #7: Theme detection -- use `color-scheme` GSettings key, NOT `gtk-theme` (deprecated for dark/light detection on GNOME 45+)

### Phase 4: Developer Experience

**Rationale:** DX improvements that benefit contributors but do not affect end users directly. Lowest risk, lowest urgency. Can be partially deferred if timeline is tight.

**Delivers:** Contributor documentation, improved retry behavior, preparation for future work.

**Addresses features:**
- CONTRIBUTING.md + CHANGELOG.md
- Retry fix in `polling-service.js` (backoff reset after success)
- i18n preparation (externalize user-facing strings -- structure only)

**Avoids pitfalls:** Minimal pitfall exposure -- these are documentation and minor behavioral fixes.

### Phase Ordering Rationale

- **Phase 1 before all others:** Security + stability fixes are prerequisites. Atomic write utility is consumed by Phase 3 (systemd sandbox path alignment). Error handlers are consumed by Phase 3 (journal logging). Memory leak fix is consumed by Phase 3 (theme re-renders).
- **Phase 2 before Phase 3:** CI must exist before production hardening changes land so that regressions in hardening are caught automatically.
- **Phase 3 after Phase 1:** systemd `CacheDirectory`/`StateDirectory` must match the paths where atomic writes actually create temp files. Theme CSS toggle triggers re-renders that must not leak actors.
- **Phase 4 is optional:** Can be deferred entirely to v2.2 if timeline is tight. No features or fixes depend on it.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1, GJS fixes (indicator + subprocess timeout):** GJS actor lifecycle and `Gio.Cancellable` + `force_exit` patterns are well-documented but require hands-on testing on a real GNOME Shell session. Mock tests cannot validate GJS-specific behavior.
- **Phase 3, systemd hardening:** Must be tested on Ubuntu 24.04 VM. Directives that work on Arch/Fedora may behave differently on Ubuntu's systemd 255. Use `systemd-analyze security --user` to verify.

Phases with standard patterns (skip `/gsd-research-phase`):
- **Phase 1, backend fixes (shell injection, atomic writes, error handlers):** Textbook patterns with HIGH confidence from official documentation.
- **Phase 2, CI pipeline:** `oven-sh/setup-bun@v2` is official, well-documented, and the workflow structure is standard.
- **Phase 4, DX:** Documentation and minor behavioral fixes -- no research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All APIs verified against official Bun docs, GJS guides, and systemd man pages. Zero new dependencies needed. Bun 1.3.10 `node:fs` compat confirmed. |
| Features | HIGH | Feature list derived directly from the v2.1 audit of the actual codebase (24 issues). Prioritization based on severity and dependency analysis. Anti-features justified with concrete trade-off reasoning. |
| Architecture | HIGH | Integration zones mapped to specific files and line numbers. Data flow changes are surgical -- 8 modified files, 2 new files. Architecture itself does not change. |
| Pitfalls | HIGH | All 10 pitfalls verified against official documentation (GJS guide, systemd.exec man page, Bun subprocess docs). GJS-specific pitfalls (#1, #4, #5, #7) are the most likely to trip developers unfamiliar with the GNOME Shell extension model. |

**Overall confidence:** HIGH

### Gaps to Address

- **GNOME extension E2E testing in CI:** Not feasible for v2.1 -- GJS requires a D-Bus session and GNOME Shell. Extension validation remains manual on Ubuntu VM. This is an accepted gap, not a solvable one at this stage.
- **`fsync` before atomic rename:** STACK.md says fsync is overkill for regenerable cache; PITFALLS.md flags the fsync gap as a power-failure risk. **Recommendation:** Skip `fsync` for the snapshot cache (regenerable) but add it for config files (not regenerable). Resolve during Phase 1 planning.
- **`Promise.allSettled` vs `Promise.all` in coordinator:** PITFALLS.md and ARCHITECTURE.md both recommend switching to `Promise.allSettled` for fault isolation, but this was not in the original 24-issue audit. **Recommendation:** Include it in Phase 1 as part of the coordinator timeout fix -- it is a one-line change with high impact.
- **Socket file permissions:** PITFALLS.md flags world-readable socket as a security issue. Not mentioned in the audit. **Recommendation:** Verify current socket permissions during Phase 1 execution; add `chmod 0600` if needed.
- **pnpm vs Bun lockfile in CI:** The project uses pnpm workspaces but Bun for the backend. CI workflow must handle both. **Recommendation:** Resolve during Phase 2 planning by verifying which lockfile (`pnpm-lock.yaml` vs `bun.lock`) each workspace uses.

## Sources

### Primary (HIGH confidence)
- [GJS Guide: Memory Management](https://gjs.guide/guides/gjs/memory-management.html) -- actor lifecycle, destroy patterns
- [GJS Guide: Subprocesses](https://gjs.guide/guides/gio/subprocesses.html) -- Gio.Cancellable, force_exit
- [GJS Guide: Async Programming](https://gjs.guide/guides/gjs/asynchronous-programming.html) -- GLib.timeout_add, main loop sources
- [GNOME Shell Extension Review Guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html) -- mandatory cleanup in disable()
- [systemd.exec(5) man page](https://man.archlinux.org/man/systemd.exec.5.en) -- sandboxing directive availability in user vs system services
- [Bun docs: File I/O](https://bun.com/docs/runtime/file-io) -- Bun.write, node:fs compat
- [Bun docs: CI/CD](https://bun.com/docs/guides/runtime/cicd) -- oven-sh/setup-bun@v2
- [Bun API: fs/promises/rename](https://bun.com/reference/node/fs/promises/rename) -- atomic rename compat
- [oven-sh/setup-bun GitHub](https://github.com/oven-sh/setup-bun) -- Action v2 features
- [GNOME Developer Docs: Dark Mode](https://developer.gnome.org/documentation/tutorials/beginners/getting_started/dark_mode.html) -- color-scheme API

### Secondary (MEDIUM confidence)
- [ArchWiki: systemd/Sandboxing](https://wiki.archlinux.org/title/Systemd/Sandboxing) -- user service limitations
- [ArchWiki: Dark Mode Switching](https://wiki.archlinux.org/title/Dark_mode_switching) -- color-scheme vs gtk-theme (GNOME 45+)
- [GNOME Discourse: color-scheme detection](https://discourse.gnome.org/t/how-to-read-dark-light-mode-status-from-shell/12038) -- GSettings approach
- [Biome Migration Guide 2026](https://dev.to/pockit_tools/biome-the-eslint-and-prettier-killer-complete-migration-guide-for-2026-27m) -- gradual adoption
- [AbortController Best Practices](https://kettanaito.com/blog/dont-sleep-on-abort-controller) -- Promise.race gotchas

### Tertiary (needs validation during execution)
- [systemd hardening gist (ageis)](https://gist.github.com/ageis/f5595e59b1cddb1513d1b425a323db04) -- comprehensive but not specific to user services
- [GJS setInterval/setTimeout polyfill](https://dontreinventbicycle.com/gjs-set-timeout-interval.html) -- globalThis timing API in GJS

---
*Research completed: 2026-04-05*
*Ready for roadmap: yes*

# Feature Research

**Domain:** Stability, security, and production hardening for a Bun/TypeScript backend + GNOME Shell extension (AI usage monitor)
**Researched:** 2026-04-05
**Confidence:** HIGH

## Feature Landscape

This is a **hardening milestone**, not a feature milestone. The 24 issues from the v2.1 audit define the scope. The categories below re-frame these issues as features users experience -- either through reliability (crashes stop), security (data stays safe), or developer velocity (CI catches regressions).

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels broken or dangerous.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| GNOME indicator does not leak memory on re-render | Users expect a panel indicator that does not gradually consume RAM until GNOME Shell becomes unresponsive. The current `_render()` removes children from `_box` but never calls `.destroy()` on old St actors. Clutter actors hold native C references that GJS GC cannot reclaim without explicit destruction. Over hours of polling every 150s, this creates hundreds of orphaned actors. | MEDIUM | Fix in `indicator.js`: before `remove_child()`, call `child.destroy()` on each old actor. Clear `_providerActors` Map values with `.destroy()` before `.clear()`. In `destroy()`, iterate `_providerActors` values and destroy each slot's container. The fix is small code-wise but critical to verify -- must test memory over sustained polling. |
| No shell injection in auth command | Users expect that running `agent-bar auth copilot` cannot be exploited to execute arbitrary commands. The current `defaultOpenBrowser()` uses `exec(\`xdg-open ${url}\`)` which passes the URL through a shell interpreter. A crafted verification URL could inject shell metacharacters. This is a textbook command injection vulnerability. | LOW | Replace `exec()` with `execFile('xdg-open', [url])` which bypasses shell interpretation entirely. Additionally, validate the URL before passing it: parse with `new URL()`, enforce `https:` protocol only, reject if parsing fails. Two lines of validation + one function change. |
| Atomic file writes for snapshot cache | Users expect cached data to survive service restarts without corruption. The current `snapshot-cache.ts` uses `writeFileSync()` directly to the target path. If the process crashes mid-write (OOM kill, SIGKILL, power loss), the file is left in a half-written state and the next read returns `null` or throws. | LOW | Write to a temp file in the same directory (`${targetPath}.tmp.${process.pid}`), then `renameSync()` to the target path. `rename()` within the same filesystem is atomic on Linux. Same pattern for `persistLatestSnapshot()` in `service-server.ts`. Both sites need the fix. |
| Global error handlers in service runtime | Users expect the background service to log fatal errors instead of silently dying. The current `service-server.ts` has no `process.on('uncaughtException')` or `process.on('unhandledRejection')` handlers. If an unhandled error occurs, Bun terminates the process with no diagnostic output. systemd restarts it, but the root cause is lost. | LOW | Add `process.on('uncaughtException', ...)` and `process.on('unhandledRejection', ...)` in the service entry point (before `createAgentBarServiceRuntime`). Log the error to stderr (which systemd captures in the journal). For uncaught exceptions: log + exit(1) so systemd triggers `Restart=on-failure`. For unhandled rejections: log but do not exit (many are non-fatal). Bun supports both since v1.1.8. |
| Subprocess timeouts everywhere | Users expect that a hung CLI subprocess does not block the entire service. The backend's `runSubprocess()` already has a 15s default timeout, but three call sites bypass it: (1) GNOME extension's `Gio.SubprocessLauncher` has **no** timeout -- a hung `agent-bar usage` blocks the shell process indefinitely. (2) `BackendCoordinator` delegates to `runSubprocess` but individual provider adapters may set very long or no explicit timeouts. (3) `codex-appserver-fetcher.ts` has its own 10s timeout but the `Bun.spawn` for the appserver has no kill-on-timeout guarantee if the reader loop stalls. | MEDIUM | Three separate fixes: (1) GNOME extension: add `GLib.timeout_add_seconds()` watchdog that calls `subprocess.force_exit()` after 30s. (2) Verify that all provider adapter subprocess calls flow through `runSubprocess()` with explicit `timeoutMs`. (3) In `codex-appserver-fetcher.ts`, ensure `child.kill()` is called reliably in the `settle()` function even if the reader throws. |
| GitHub Actions CI pipeline | Users and contributors expect that pull requests are automatically validated. The codebase currently has zero CI. No lint check, no typecheck, no test run. Regressions introduced in PRs are caught only by manual testing. | MEDIUM | Single workflow file `.github/workflows/ci.yml` with 3 jobs: (1) `lint` -- `biome check`, (2) `typecheck` -- `bunx tsc --noEmit`, (3) `test` -- `bun test`. Use `oven-sh/setup-bun@v2` action. Cache `node_modules` via `actions/cache`. Trigger on `push` to main and on PRs. Matrix is single-OS (ubuntu-latest) since the product targets Ubuntu only. |
| systemd service hardening | Users expect the background service to run with minimal privileges. The current `agent-bar.service` is a bare-bones unit: `Type=simple`, `ExecStart`, `Restart=on-failure`. No filesystem sandboxing, no capability restrictions, no private tmp. A compromised service has full access to the user's home directory and session. | LOW | Add directives to the service file: `ProtectSystem=strict`, `ProtectHome=tmpfs`, `BindPaths=%h/.config/agent-bar %h/.cache/agent-bar %h/.local/share/keyrings`, `PrivateTmp=yes`, `NoNewPrivileges=yes`, `ProtectKernelTunables=yes`, `ProtectKernelModules=yes`, `ProtectControlGroups=yes`, `RestrictNamespaces=yes`, `SystemCallFilter=@system-service`. **Important caveat:** `ProtectHome` and sandboxing directives have limited effect in user-mode services due to systemd's security model -- but setting `NoNewPrivileges=yes` and `RestrictNamespaces=yes` still work and provide meaningful protection. Test with `systemd-analyze security --user agent-bar.service`. |

### Differentiators (Competitive Advantage)

Features that go beyond fixing what is broken and make the product notably more polished or robust than competitors.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| CSS theme awareness (dark/light) | The GNOME extension currently hardcodes a One Dark color palette. On Ubuntu's default light Yaru theme, the dark-on-dark colors are invisible against the light panel. Detecting the system color scheme and adapting CSS makes the extension work correctly on all GNOME desktop configurations out of the box. No competitor AI usage tool adapts to the desktop theme. | MEDIUM | Read `org.gnome.desktop.interface color-scheme` via `Gio.Settings`. If `'prefer-dark'` use current dark palette; otherwise apply a light variant with dark text on light backgrounds. Connect to `changed::color-scheme` signal to react when the user toggles theme. Provide two CSS class roots (`.agent-bar-ubuntu--dark`, `.agent-bar-ubuntu--light`) and swap on the indicator's top-level actor. Requires designing a light color palette (invert contrast values, use Adwaita light accent colors). |
| Stricter Biome lint rules | The current Biome config disables `noExplicitAny`, `noNonNullAssertion`, and `useNodejsImportProtocol`. Enabling these progressively raises code quality and prevents entire categories of runtime errors. Projects with strict lint catch bugs that tests miss. | LOW | Enable rules incrementally: first `useNodejsImportProtocol` (simple mechanical fix -- add `node:` prefix to all bare imports). Then `noNonNullAssertion` (replace `!` with proper null checks). Finally `noExplicitAny` with an allow-list for genuinely untyped boundaries. Each rule can be a separate commit. Add `.editorconfig` for consistent editor settings across contributors. |
| Snapshot schema versioning with migration | The `shared-contract` hardcodes `snapshotSchemaVersion = '1'`. The `config-schema.ts` hardcodes `schemaVersion: 1` with no migration path. If the schema changes in a future version, old cached files and config files will fail validation and users will see errors until they manually delete stale data. Adding migration logic now prevents that class of breakage. | LOW | Add `migrateSnapshot(raw)` and `migrateConfig(raw)` functions that check the version field and apply transformation chains (currently: v1 -> v1, identity). When reading cached files: attempt parse, check version, migrate if needed, validate. When reading config: same pattern. This is boilerplate now but pays off the moment schema changes are needed. |
| Claude token refresh awareness | The Claude credentials file (`~/.claude/.credentials.json`) contains an `expiresAt` field. The current `claude-credentials.ts` reads the token but does not check expiry. If the token is expired, the API call fails with a cryptic 401 instead of a clear "Token expired, run `claude auth login` to re-authenticate" message. | LOW | In `readClaudeCredentials()`: parse `expiresAt`, compare to `Date.now()`. If expired, return a new status like `{ status: 'expired', expiresAt }` that the adapter translates to a clear error message. The GNOME extension and CLI can then show "Claude: token expired" instead of a generic fetch error. Does not require actually refreshing the token -- just detecting and reporting expiry. |
| Provider abstract helpers / code dedup | The three provider adapters (Copilot, Codex, Claude) repeat similar patterns: error snapshot construction, availability checking, subprocess invocation with timeout. Extracting shared helpers reduces per-provider boilerplate and makes adding future providers (Amp, Cursor) faster. | MEDIUM | Create `provider-helpers.ts` with: `buildErrorSnapshot(id, source, message)`, `buildUnavailableSnapshot(id, source)`, `withSubprocessTimeout(command, args, opts)`. Each adapter calls these instead of constructing snapshots inline. The existing `provider-adapter.ts` already has `createErrorSnapshot` and `createUnavailableSnapshot` -- this is about making adapters consume them consistently and reducing duplicated logic in the three adapter files. |
| CONTRIBUTING.md + CHANGELOG.md | No contributor documentation exists. No record of changes between versions. For a tool that runs as a systemd service on user machines, a changelog communicates what changed and why. CONTRIBUTING.md reduces onboarding friction for anyone auditing or extending the project. | LOW | CONTRIBUTING.md: dev setup (Bun install, pnpm install, bun test), project structure overview, PR conventions (conventional commits in Portuguese), how to test the GNOME extension (must be on Ubuntu). CHANGELOG.md: retroactive entries for v1.0, v1.1, v2.0 from commit history. Going forward: update changelog as part of milestone completion. |
| pnpm workspace scripts | The monorepo uses pnpm workspaces but the root `package.json` has minimal scripts. Contributors have to know which directory to `cd` into. Adding root-level `lint`, `test`, `typecheck`, `build` scripts that delegate to workspace packages provides a single entry point. | LOW | Add to root `package.json`: `"lint": "biome check"`, `"test": "bun test apps/backend/test"`, `"typecheck": "bunx tsc --noEmit -p apps/backend"`, `"build": "bun build apps/backend/src/cli.ts --outdir dist"`. These become the commands CI runs. |
| API version headers for provider requests | The Copilot API fetcher and Claude API fetcher make HTTP requests without sending version headers. API providers may change response formats without notice. Sending `X-Agent-Bar-Version` and provider-specific API version headers (e.g., `anthropic-version` for Claude) makes requests more predictable and debuggable. | LOW | Add a `USER_AGENT` constant (`agent-bar/2.1`) and include it in all `fetch()` calls as `User-Agent` header. For Claude API: add `anthropic-version: 2023-06-01` header. For Copilot: add `X-GitHub-Api-Version` if applicable. These are one-line additions per fetcher. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem like they belong in a hardening release but actually introduce more risk than they remove.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full test coverage before shipping fixes | "Cover everything with tests first" | The critical fixes (memory leak, shell injection, race condition) are production safety issues. Delaying them to write comprehensive test suites extends the window of vulnerability. Tests for these specific issues can be narrow and focused. | Write targeted tests for each fix (regression tests). Integration coverage can expand in a later DX wave. |
| Rewrite GNOME extension in TypeScript | "TypeScript catches bugs" | GNOME Shell extensions must be plain GJS (JavaScript). TypeScript requires a build step, source maps for debugging, and the GJS type definitions (`@girs/*`) are incomplete and sometimes incorrect. The complexity is not worth it for ~500 lines of GJS. | Keep GJS, add JSDoc type annotations where helpful, and rely on Biome linting for the extension source. |
| Migrate to ESM everywhere | "ESM is the standard" | Bun supports both CJS and ESM transparently. The GNOME extension uses ESM-style imports natively. Forcing a migration touches every import in the backend without fixing any bug. Risking import resolution issues during a stability milestone is counterproductive. | Leave module format as-is. Both surfaces work. Revisit in a feature milestone if needed. |
| Add structured logging framework (pino, winston) | "Console.log is not production-grade" | The service runs as a single-user systemd unit. systemd journal captures stdout/stderr with timestamps and unit context. Adding a logging framework increases dependencies and complexity for a service that has exactly one consumer. | Use `console.error()` and `console.warn()` for the service (captured by journal). Add structured prefixes like `[agent-bar:service]`, `[agent-bar:cache]` for greppability. |
| Implement retry logic for all provider API calls | "Retry on transient failures" | The polling service already retries every 150s. Adding per-call retry creates compounding retry storms: polling retry * per-provider retry * per-call retry. For a background polling service, the natural polling interval IS the retry mechanism. | Fix the one broken retry path (identified in audit: retry after error does not reset backoff in `polling-service.js`). Do not add per-call retries. The 150s poll interval handles transient failures. |
| Add Sentry or error tracking service | "Production apps need error tracking" | This is a local desktop tool running on the user's machine, not a cloud service. Sending error telemetry requires user consent, network access, and privacy considerations. The systemd journal is the appropriate error sink for local services. | Use `journalctl --user -u agent-bar.service` for error inspection. The `doctor` command already provides diagnostic output. |

## Feature Dependencies

```
[Global Error Handlers]
    (no dependencies -- standalone safety net)

[Shell Injection Fix]
    (no dependencies -- standalone security fix)

[Atomic File Writes]
    (no dependencies -- standalone reliability fix)

[Memory Leak Fix (GNOME Indicator)]
    (no dependencies -- standalone GJS fix)

[Subprocess Timeouts]
    +---depends on---> [Global Error Handlers]
        (timeout kills must not crash the service without logging)

[CI Pipeline]
    +---depends on---> [pnpm Workspace Scripts]
        (CI runs the same scripts developers run locally)
    +---depends on---> [Stricter Biome Rules]
        (CI should enforce the new rules, not the old ones)

[systemd Hardening]
    +---depends on---> [Atomic File Writes]
        (sandboxed paths must match where files are written)
    +---depends on---> [Global Error Handlers]
        (hardened service must still log failures to journal)

[CSS Theme Awareness]
    +---depends on---> [Memory Leak Fix]
        (theme-switching re-renders must not leak actors)

[Schema Versioning]
    +---depends on---> [Atomic File Writes]
        (migrated files must be written atomically)

[Claude Token Refresh]
    (no dependencies -- reads existing credential file)

[Provider Abstract Helpers]
    +---depends on---> [Subprocess Timeouts]
        (shared helpers should enforce timeouts by default)

[Stricter Biome Rules]
    (no dependencies -- lint config changes only)

[pnpm Workspace Scripts]
    (no dependencies -- package.json changes only)

[CONTRIBUTING.md / CHANGELOG.md]
    (no dependencies -- documentation only)

[API Version Headers]
    (no dependencies -- per-fetcher one-line changes)

[Config Safety]
    +---depends on---> [Schema Versioning]
        (config reads must handle version migration)
    +---depends on---> [Atomic File Writes]
        (config writes must be atomic)

[Retry Fix (polling-service.js)]
    +---depends on---> [Memory Leak Fix]
        (retry re-renders must not leak actors)
```

### Dependency Notes

- **Global Error Handlers has no dependencies:** It is a standalone addition to the service entry point. Should be first because all subsequent fixes benefit from error visibility.
- **CI Pipeline depends on scripts and lint rules:** The CI workflow should run `pnpm lint`, `pnpm test`, `pnpm typecheck`. These scripts must exist first.
- **CSS Theme Awareness depends on Memory Leak Fix:** Theme toggling triggers re-renders. If the memory leak is not fixed first, theme changes will accelerate memory consumption.
- **systemd Hardening depends on Atomic File Writes:** The `BindPaths` directives must match the directories where cache and config files are actually written. If the atomic write pattern uses temp files in a different directory, the sandbox blocks them.
- **Provider Abstract Helpers depend on Subprocess Timeouts:** The shared helper for subprocess invocation should enforce timeouts by default, so it must be built after the timeout pattern is established.

## MVP Definition

### Ship Now (v2.1 Wave 0 -- Critical)

Safety fixes that must ship immediately. Each one prevents data loss, security vulnerability, or user-visible instability.

- [ ] Memory leak fix in GNOME indicator -- actors destroyed on re-render
- [ ] Shell injection fix in auth command -- `execFile` replaces `exec`
- [ ] Atomic file writes for cache and snapshot -- write-to-temp + rename
- [ ] Global error handlers in service runtime -- `uncaughtException` + `unhandledRejection`
- [ ] Subprocess timeouts in GNOME extension, coordinator, and codex appserver

### Ship Soon (v2.1 Wave 1 -- Infrastructure)

Foundation that every subsequent fix builds on.

- [ ] GitHub Actions CI pipeline (lint + typecheck + test)
- [ ] Stricter Biome rules (enable `useNodejsImportProtocol`, plan `noNonNullAssertion`)
- [ ] pnpm workspace scripts for root-level `lint`, `test`, `typecheck`
- [ ] `.editorconfig` for consistent formatting

### Ship After (v2.1 Wave 2 -- Production Hardening)

Production-grade improvements that require Wave 0 fixes to be in place.

- [ ] systemd service hardening (sandboxing directives)
- [ ] Config safety (validation on every read, graceful fallback)
- [ ] CSS theme awareness (dark/light detection + dual palette)
- [ ] Snapshot schema versioning with migration functions
- [ ] Claude token refresh awareness (expiry detection + clear message)

### Ship Last (v2.1 Wave 3 -- Developer Experience)

DX improvements that benefit contributors but do not affect end users directly.

- [ ] CONTRIBUTING.md + CHANGELOG.md
- [ ] pnpm script improvements
- [ ] Retry fix in `polling-service.js` (backoff reset after success)
- [ ] i18n preparation (externalize user-facing strings -- structure only, no translations)

### Defer to v2.2+ (Wave 4 -- Refactoring)

Refactors that improve code quality but carry risk of regressions.

- [ ] Provider abstract helpers / code dedup -- benefits future providers
- [ ] API version headers -- low risk but low urgency
- [ ] State cleanup patterns -- audit and simplify state flow across components
- [ ] `noExplicitAny` Biome rule -- requires type annotations on many boundaries

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Risk if Skipped | Priority |
|---------|------------|---------------------|-----------------|----------|
| Memory leak fix (GNOME indicator) | HIGH | LOW | **Service degrades over hours** | P0 |
| Shell injection fix (auth command) | HIGH | LOW | **Security vulnerability** | P0 |
| Atomic file writes (cache) | HIGH | LOW | **Data corruption on crash** | P0 |
| Global error handlers | HIGH | LOW | **Silent service deaths** | P0 |
| Subprocess timeouts (all 3 sites) | HIGH | MEDIUM | **Service hangs indefinitely** | P0 |
| GitHub Actions CI | HIGH | MEDIUM | Regressions in PRs undetected | P1 |
| Stricter Biome rules | MEDIUM | LOW | Type errors caught later | P1 |
| pnpm workspace scripts | MEDIUM | LOW | CI and DX friction | P1 |
| systemd hardening | MEDIUM | LOW | Excessive service privileges | P1 |
| CSS theme awareness | MEDIUM | MEDIUM | Invisible on light themes | P1 |
| Config safety | MEDIUM | LOW | Config errors crash service | P1 |
| Schema versioning | LOW | LOW | Future upgrade breakage | P2 |
| Claude token refresh | LOW | LOW | Cryptic 401 errors | P2 |
| CONTRIBUTING.md + CHANGELOG | LOW | LOW | Contributor friction | P2 |
| Retry fix (polling-service.js) | LOW | LOW | Unnecessary backoff after recovery | P2 |
| Provider abstract helpers | LOW | MEDIUM | Code duplication continues | P3 |
| API version headers | LOW | LOW | API response unpredictability | P3 |
| State cleanup | LOW | MEDIUM | Internal complexity | P3 |

**Priority key:**
- P0: Must fix immediately -- production safety and security
- P1: Should ship in v2.1 -- prevents regressions, improves robustness
- P2: Nice to include in v2.1 -- quality of life
- P3: Defer to v2.2 -- refactoring that carries regression risk

## User-Visible Impact Analysis

Which fixes have the highest impact from the user's perspective?

| Fix | Who Feels It | How They Feel It | Impact Level |
|-----|-------------|------------------|--------------|
| Memory leak (GNOME indicator) | Every GNOME user | Shell becomes sluggish after hours; only fix is `gnome-shell --replace` or logout | **CRITICAL** -- degrades the desktop environment itself |
| Shell injection (auth command) | Any user running `auth copilot` | Invisible but exploitable if Device Flow URL is tampered with | **CRITICAL** -- security vulnerability |
| Atomic file writes | Users whose machine loses power or OOM-kills the service | Service starts with corrupt cache, shows stale/no data until next successful refresh | **HIGH** -- data loss on crash |
| Global error handlers | Users checking `journalctl` after service failures | No log output explaining why the service died | **HIGH** -- invisible failures |
| Subprocess timeouts (GNOME) | Users with slow network or broken CLI | GNOME Shell freezes for the duration of the stuck subprocess | **HIGH** -- desktop responsiveness |
| CSS theme awareness | Users on Yaru Light (Ubuntu default) | Panel indicator text/backgrounds invisible against light panel | **MEDIUM** -- extension unusable on light themes |
| CI pipeline | Contributors | PRs can introduce regressions undetected | **MEDIUM** -- developer trust |
| systemd hardening | Security-conscious users | Service runs with unnecessarily broad permissions | **MEDIUM** -- attack surface |
| Claude token refresh | Claude users whose token expires | Generic "fetch failed" error instead of "token expired, re-login" | **LOW** -- confusing error message |

## Competitor Feature Analysis

Since this is a hardening release, "competitors" are the patterns established by similar Linux desktop tools.

| Aspect | Waybar Modules | Ubuntu System Monitor | GNOME Weather | Agent Bar v2.0 (current) | Agent Bar v2.1 (target) |
|--------|---------------|----------------------|---------------|--------------------------|-------------------------|
| Actor lifecycle | N/A (Waybar is C++) | Proper destroy in disable() | Proper destroy in disable() | Leaks actors on re-render | Destroy actors before removal |
| Input sanitization | N/A | N/A | N/A | Shell injection via exec() | execFile() + URL validation |
| File write safety | Atomic via temp+rename | N/A | Uses GSettings (atomic) | Direct writeFileSync | Temp file + rename |
| Global error handling | Catches SIGSEGV | Built into GNOME Shell | Built into GNOME Shell | No handlers | uncaughtException + unhandledRejection |
| CI pipeline | GitHub Actions | GNOME CI (Meson) | GNOME CI | None | GitHub Actions (lint + test + typecheck) |
| Service sandboxing | N/A (user process) | systemd hardened | N/A | Bare service unit | ProtectSystem, NoNewPrivileges, etc. |
| Theme adaptation | Inherits Waybar theme | Follows system theme | Follows AdwStyleManager | Hardcoded One Dark | Reads color-scheme GSettings |

## Sources

- [GJS Memory Management Guide](https://gjs.guide/guides/gjs/memory-management.html) -- actor lifecycle, GC interaction with GObject references
- [GNOME Shell Extension Review Guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html) -- mandatory cleanup in disable(), signal disconnection, source removal
- [systemd Hardening Options (GitHub Gist)](https://gist.github.com/ageis/f5595e59b1cddb1513d1b425a323db04) -- comprehensive directive reference
- [systemd Sandboxing (ArchWiki)](https://wiki.archlinux.org/title/Systemd/Sandboxing) -- user-service limitations, iterative approach
- [systemd Service Hardening on Ubuntu (OneUptime, 2026)](https://oneuptime.com/blog/post/2026-03-02-how-to-configure-systemd-service-hardening-on-ubuntu/view) -- current best practices
- [Preventing Command Injection in Node.js (Auth0)](https://auth0.com/blog/preventing-command-injection-attacks-in-node-js-apps/) -- execFile vs exec, input validation
- [Prevent Command Injection with execFile (Secure Coding Practices)](https://securecodingpractices.com/prevent-command-injection-node-js-child-process/) -- shell-free process execution
- [Node.js File System Production Guide (2026)](https://thelinuxcode.com/nodejs-file-system-in-practice-a-production-grade-guide-for-2026/) -- atomic rename pattern, TOCTOU avoidance
- [Node.js Race Conditions (Design Patterns)](https://nodejsdesignpatterns.com/blog/node-js-race-conditions/) -- single-threaded misconception, file I/O races
- [Bun process.on uncaughtException (GitHub Issue #429)](https://github.com/oven-sh/bun/issues/429) -- support confirmed since v1.1.8
- [Bun test/lint/typecheck GitHub Actions (Gist)](https://gist.github.com/morajabi/2cf441fca6b7c1a8cce1b5b262c04d1e) -- Bun CI workflow with caching
- [GNOME color-scheme detection (GNOME Discourse)](https://discourse.gnome.org/t/how-to-read-dark-light-mode-status-from-shell/12038) -- GSettings `org.gnome.desktop.interface color-scheme`
- [GNOME Developer Docs: Dark Mode](https://developer.gnome.org/documentation/tutorials/beginners/getting_started/dark_mode.html) -- forcing/detecting color scheme
- v2.1 codebase audit results (internal) -- 24 issues across 3 severity levels

---
*Feature research for: Agent Bar Ubuntu v2.1 Stability & Hardening*
*Researched: 2026-04-05*

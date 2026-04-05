# Phase 13: Critical Security & Stability Fixes - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix all P0/P1 issues: the service cannot be exploited via shell injection, does not leak GNOME Clutter actors on re-render, does not corrupt cache files on crash, does not die silently on fatal errors, and does not hang indefinitely on slow providers. Covers 8 requirements: SEC-01, SEC-02, STAB-01 through STAB-06.

</domain>

<decisions>
## Implementation Decisions

### Graceful Shutdown (STAB-03, SEC-02)
- **D-01:** SIGTERM triggers full graceful shutdown: stop refresh timer, close socket server, delete socket file, flush last snapshot to disk, then `exit(0)`. Ensures next start finds valid cache.
- **D-02:** Both `uncaughtException` and `unhandledRejection` are treated as fatal: log full error stack to stderr (routed to systemd journal) and `exit(1)`. Systemd handles automatic restart.
- **D-03:** Replace silent `.catch(() => undefined)` in `service-server.ts` (lines 169, 271) with `.catch((err) => console.error(...))`. Errors go to journal; refresh timer continues normally on next cycle.

### Timeout Strategy (STAB-04, STAB-05, STAB-06)
- **D-04:** Backend coordinator uses per-provider timeout (15s) via `Promise.race` in `#resolveSnapshot`. A hanging provider returns an error snapshot while others complete normally. No global coordinator timeout needed.
- **D-05:** GNOME extension backend-client gets a 15s timeout via `GLib.timeout_add_seconds` + `Gio.Cancellable.cancel()` + `subprocess.force_exit()`. If backend doesn't respond in 15s, extension shows error and schedules retry.
- **D-06:** Codex appserver timeout aligned from 10s to 15s for consistency with the per-provider coordinator timeout. Same `setTimeout` + `child.kill()` pattern already in place.

### Atomic Write (STAB-02)
- **D-07:** Atomic write (temp+rename) applied to BOTH `snapshot-cache.ts` and `persistLatestSnapshot` in `service-server.ts`. A shared `atomicWriteFileSync(filePath, data)` utility writes to `${filePath}.${process.pid}.tmp` then `renameSync` to final path. Both locations use the same utility.

### Shell Injection Fix (SEC-01)
- **D-08:** Replace `exec(\`xdg-open ${url}\`)` in `auth-command.ts:225` with `Bun.spawn(['xdg-open', url])`. Array form prevents shell metacharacter interpretation. This is the only shell injection vector identified.

### GNOME Actor Lifecycle (STAB-01)
- **D-09:** In `indicator.js` `_render()`, call `child.destroy()` (not just `remove_child`) on each actor removed from `_box`. `destroy()` recursively destroys all child actors (iconBox, icon, usageLabel).
- **D-10:** GIcon cache (`_providerIcons` Map) is NOT cleared on re-render — GIcons are lightweight, reusable across renders, and don't leak Clutter actors. Only cleared in the final `destroy()`.
- **D-11:** Menu rebuild via `rebuildMenu` does NOT need explicit `destroy()` — `PopupMenu.removeAll()` already calls `destroy()` on its items internally. No changes needed there.

### Claude's Discretion
- Implementation details of the `atomicWriteFileSync` utility (error handling, temp file naming)
- Exact error message format in the global error handlers
- Whether to add `SIGINT` handler alongside `SIGTERM` (both are common service signals)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — SEC-01, SEC-02, STAB-01 through STAB-06 definitions
- `.planning/ROADMAP.md` §Phase 13 — Success criteria (5 testable conditions)

### Codebase Analysis
- `.planning/codebase/CONCERNS.md` — Tech debt and security considerations from audit
- `.planning/codebase/ARCHITECTURE.md` — Layer boundaries and data flow

</canonical_refs>

<code_context>
## Existing Code Insights

### Files to Modify
- `apps/backend/src/commands/auth-command.ts:225` — SEC-01: `exec(\`xdg-open ${url}\`)` → `Bun.spawn` array
- `apps/backend/src/service/service-server.ts:169,271` — SEC-02: silent `.catch(() => undefined)` → logged catches
- `apps/backend/src/service/service-server.ts` — STAB-03: add global error handlers + SIGTERM
- `apps/backend/src/cache/snapshot-cache.ts:73` — STAB-02: `writeFileSync` → `atomicWriteFileSync`
- `apps/backend/src/service/service-server.ts:101-102` — STAB-02: `persistLatestSnapshot` → `atomicWriteFileSync`
- `apps/gnome-extension/panel/indicator.js:129-131` — STAB-01: `remove_child` → `child.destroy()`
- `apps/gnome-extension/services/backend-client.js:60-68` — STAB-04: add GLib timeout + cancellable
- `apps/backend/src/core/backend-coordinator.ts:51-53` — STAB-05: wrap per-provider in `Promise.race`
- `apps/backend/src/providers/codex/codex-appserver-fetcher.ts:7` — STAB-06: `REQUEST_TIMEOUT_MS` 10000 → 15000

### New Files
- `apps/backend/src/utils/atomic-write.ts` — shared `atomicWriteFileSync` utility

### Established Patterns
- Dependency injection via options objects (auth-command, service-server, backend-coordinator all use this)
- `Bun.spawn` array form already used in `subprocess.ts` — SEC-01 fix follows existing pattern
- Provider error snapshots via `createErrorSnapshot` — timeout errors should use same pattern
- `console.error('[agent-bar] ...')` prefix used in GNOME extension — backend should adopt same prefix

### Integration Points
- Service entry point (`service-command.ts`) is where global handlers and SIGTERM are registered
- The `runtime.stop()` method already handles timer cleanup and socket close — SIGTERM just needs to call it
- Backend coordinator `#resolveSnapshot` is the single choke point for per-provider timeout

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-critical-security-stability-fixes*
*Context gathered: 2026-04-05*

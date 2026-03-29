# Phase 11: Provider Independence & Data - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning
**Mode:** Auto-generated (architecture + extension integration)

<domain>
## Phase Boundary

Refactor the provider layer so each provider is a self-contained module with explicit metadata, add persistent file-based caching plus service-side auto-refresh, and expose provider selection to users through a CLI flow that directly affects the GNOME topbar. Reuse the current backend config and GNOME extension surfaces instead of introducing a second settings source of truth.

</domain>

<decisions>
## Implementation Decisions

### Locked Decisions

- Provider selection source of truth is the existing backend config `providers` array: order controls topbar order, `enabled` controls visibility.
- Provider internals (CLI/API fetchers, parsers, credential readers) should stay in their current directories; Phase 11 wraps/reorganizes them instead of rewriting provider logic from scratch.
- File cache lives under `XDG_CACHE_HOME/agent-bar` with safe filenames, TTL metadata, and in-flight request deduplication.
- The service runtime owns periodic background refresh and should keep serving the last cached snapshot while a fresh refresh is in progress.
- GNOME indicator rendering must become data-driven from the snapshot/config order rather than a hard-coded provider order.
- Existing packaged provider assets (`assets/providers/*.svg`, `assets/*-icon.png`) are authoritative and should be wired before inventing new art.
- Locale-aware time formatting should be centralized and reused across CLI/extension output, using `Intl.RelativeTimeFormat` and `Intl.DateTimeFormat`.

### The Agent's Discretion

- Exact provider module shape, as long as it clearly exposes `{ id, name, cacheKey, isAvailable(), getQuota() }`
- Whether persistent cache stores provider snapshots, aggregate envelopes, or both, provided startup can serve cached data immediately and deduplicate refreshes
- Exact UX of `agent-bar providers`, as long as it lets the user choose which providers appear in the GNOME topbar and preserves order

</decisions>

<canonical_refs>
## Canonical References

### Backend provider architecture
- `apps/backend/src/core/provider-adapter.ts` — current provider contract
- `apps/backend/src/core/provider-registry.ts` — current registry shape
- `apps/backend/src/core/provider-registry-factory.ts` — current provider wiring choke point
- `apps/backend/src/core/provider-context-builder.ts` — config/secret/source-mode resolution
- `apps/backend/src/config/config-schema.ts` — existing provider config shape (`enabled`, `sourceMode`, `secretRef`)
- `apps/backend/src/config/default-config.ts` — current provider defaults/order

### Backend data/cache/service
- `apps/backend/src/cache/snapshot-cache.ts` — current in-memory TTL cache
- `apps/backend/src/core/backend-coordinator.ts` — current per-provider cache use
- `apps/backend/src/core/usage-snapshot.ts` — current ephemeral cache construction
- `apps/backend/src/service/service-server.ts` — current warmup-only service runtime
- `apps/backend/src/service/service-client.ts` — snapshot/refresh/status wire protocol

### GNOME extension surfaces
- `apps/gnome-extension/panel/indicator.js` — hard-coded indicator provider slots
- `apps/gnome-extension/utils/view-model.js` — fixed provider order and relative-time labels
- `apps/gnome-extension/utils/provider-icons.js` — packaged/fallback icon resolution
- `apps/gnome-extension/stylesheet.css` — existing One Dark-inspired spacing/color tokens

### Reference patterns from omarchy
- `/home/othavio/Work/agent-bar-omarchy/src/cache.ts` — file cache with TTL + in-flight dedup
- `/home/othavio/Work/agent-bar-omarchy/src/providers/types.ts` — minimal provider contract
- `/home/othavio/Work/agent-bar-omarchy/src/providers/registry.ts` — lightweight provider registration
- `/home/othavio/Work/agent-bar-omarchy/src/tui/configure-layout.ts` — provider selection/order flow

</canonical_refs>

<code_context>
## Existing Code Insights

### Already Present

- Providers already avoid cross-importing each other; the coupling is mostly through the current central registry factory and the shared adapter contract.
- Backend config already models provider order and visibility through `providers[]` plus `enabled`.
- The GNOME extension already formats relative/absolute times via `Intl.*`.
- Packaged SVG icons for `claude`, `codex`, and `copilot` already exist under `apps/gnome-extension/assets/providers/`.

### Current Gaps

- Backend cache is process-local only and recreated per CLI invocation.
- Service runtime warms once but does not auto-refresh on an interval.
- Restarting the service drops cached data until a new refresh completes.
- CLI has no `providers` command.
- Indicator summary always reserves slots for a fixed provider order, even when a provider is disabled or absent from the snapshot.
- CLI text formatter still prints raw ISO timestamps instead of locale-aware labels.

</code_context>

<specifics>
## Specific Ideas

- Prefer persisting provider snapshots keyed by provider/source so CLI and service can both benefit from the same cache primitives.
- Use the current `config.providers` array order to drive both backend snapshot order and GNOME indicator order.
- Wire the copilot SVG into the icon helpers and remove any remaining fallback-only behavior for known providers.

</specifics>

<deferred>
## Deferred Ideas

- Additional provider families beyond `claude`, `codex`, and `copilot`
- Historical charts or multi-snapshot analytics
- Full TUI login/configuration flows (Phase 12)

</deferred>

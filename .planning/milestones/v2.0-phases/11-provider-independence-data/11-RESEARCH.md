# Phase 11: Provider Independence & Data - Research

**Researched:** 2026-03-29
**Status:** Ready for planning
**Phase:** 11-provider-independence-data

## User Constraints

- Each provider must remain self-contained with zero cross-provider imports.
- Provider contract should collapse to the minimal explicit surface: `{ id, name, cacheKey, isAvailable(), getQuota() }`.
- `agent-bar providers` must become the user-facing way to control which providers appear in the GNOME topbar.
- Backend must own periodic auto-refresh and persistent cache behavior, not only the extension polling loop.
- Date/time formatting must be locale-aware in both CLI and GNOME output.

## Project Constraints (from AGENTS.md)

- Keep `.planning/` current before and during substantive repo changes.
- Preserve existing design language in the GNOME extension instead of replacing it with a new visual system.
- Avoid destructive git operations and work with existing user changes.

## Standard Stack

- Runtime: Bun + TypeScript ESM
- Tests: `bun run vitest run` plus Bun-only tests where Bun APIs are required
- Interactive CLI: `@clack/prompts`
- GNOME UI: St, PopupMenu, stylesheet-based theming
- Data formatting: `Intl.RelativeTimeFormat`, `Intl.DateTimeFormat`
- Cache reference: `/home/othavio/Work/agent-bar-omarchy/src/cache.ts`

## Codebase Findings

### Provider Architecture

- `provider-adapter.ts` exposes `id`, `defaultSourceMode`, `isAvailable`, and `fetch`, but not explicit `name` or `cacheKey`.
- Providers are already isolated in separate directories; the main coupling point is `provider-registry-factory.ts`, which imports each concrete provider directly.
- `ProviderContextBuilder` already resolves provider order from config and filters out disabled providers when the request is not explicit.

### Data Flow and Caching

- `SnapshotCache` is in-memory only and lives inside each `BackendCoordinator` instance.
- `createUsageSnapshot()` constructs a brand-new `SnapshotCache()` every call, so CLI invocations never share cache and service runtime only benefits from process-local reuse if a coordinator instance is reused.
- `service-server.ts` warms one snapshot on startup but has no interval refresh loop and no persistent startup hydration from disk.
- Existing `cache-refresh.test.ts` already exercises TTL reuse semantics and can be extended instead of replaced.

### Provider Selection and GNOME Integration

- The extension menu already respects whatever providers arrive in the snapshot envelope because it maps `snapshotEnvelope.providers` directly.
- The panel indicator does not: `INDICATOR_PROVIDER_ORDER` is fixed to `['codex', 'claude', 'copilot']`, and `indicator.js` eagerly creates slots for all three providers.
- Provider icons already exist for all three providers, but the non-indicator icon helper only maps packaged PNGs for codex/claude and falls back for copilot.
- Backend config already stores `enabled` and preserves order, so there is no need for a second selection store.

### Locale-Aware Formatting

- GNOME extension `utils/time.js` already uses `Intl.RelativeTimeFormat` and `Intl.DateTimeFormat`.
- Backend CLI `text-formatter.ts` still prints raw ISO timestamps, so the remaining work is mainly on the CLI/backend side plus any consistency cleanup in the extension.

## Reference Findings From Omarchy

- `src/cache.ts` provides the most directly reusable pattern for this phase: safe cache keys, `ensureDir()`, TTL metadata, file-backed `get/set/invalidate`, and in-flight fetch deduplication.
- `src/providers/types.ts` demonstrates the exact metadata expansion we need (`id`, `name`, `cacheKey`) without forcing provider files to know about each other.
- `src/tui/configure-layout.ts` shows a solid multiselect/order-edit pattern for choosing visible providers.

## Recommended Plan Shape

1. Introduce provider metadata/contract cleanup and a config-backed `agent-bar providers` command.
2. Replace the in-memory snapshot cache with a file-backed cache and integrate it into service auto-refresh/startup hydration.
3. Make the GNOME indicator/provider icon handling dynamic and finish locale-aware CLI formatting.

## Don't Hand-Roll

- Do not introduce a second provider-preference store separate from backend config.
- Do not rewrite individual provider fetchers/parsers if the phase can be satisfied by wrapping them behind a cleaner contract.
- Do not leave the service refresh loop in the extension only; Phase 11 explicitly requires backend-side auto-refresh.
- Do not hard-code provider order in the extension after this phase.

## Common Pitfalls

- A persistent cache without in-flight dedup will still stampede on concurrent refreshes.
- Serving only a warmup promise is not enough for the restart criterion; startup must have a synchronous/near-immediate cached path.
- If `agent-bar providers` toggles `enabled` flags but the indicator still renders fixed slots, users will see disabled providers as dead placeholders.
- Copilot icon assets already exist; leaving it on a fallback badge would fail PROV-04 even if selection works.

## Validation Architecture

- Backend tests should cover provider registry metadata, providers command config persistence, cache persistence/dedup, and service auto-refresh behavior.
- GNOME extension tests should cover dynamic provider ordering/selection, copilot icon usage, and locale-aware text labels.
- Final phase verification should include:
  - `cd apps/backend && bun run vitest run`
  - `cd apps/backend && bun test test/settings.test.ts test/service-runtime.test.ts`
  - `bun x biome check .`

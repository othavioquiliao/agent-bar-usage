---
phase: 11-provider-independence-data
plan: 03
subsystem: formatting-ui
tags: [intl, locale-aware, gnome-indicator, provider-icons, topbar-order]

# Dependency graph
requires:
  - phase: 11-provider-independence-data/01
    provides: "Config-backed provider order/visibility and explicit provider metadata"
  - phase: 11-provider-independence-data/02
    provides: "Stable persisted snapshots and service-owned refresh behavior"
provides:
  - "Locale-aware CLI timestamp formatting via shared backend helpers"
  - "Dynamic GNOME topbar provider rendering that follows snapshot/config order"
  - "Shared packaged icon resolution for known providers including copilot"
affects: [12-terminal-ui-code-quality]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CLI prints relative + absolute timestamps via `Intl.RelativeTimeFormat` and `Intl.DateTimeFormat`"
    - "GNOME indicator chips are rebuilt from snapshot-derived provider order instead of a fixed provider constant"
    - "Packaged provider icon resolution is centralized through a pure relative-path helper reused by the indicator and icon actor utilities"

key-files:
  created:
    - apps/backend/src/formatters/time-formatters.ts
    - apps/gnome-extension/utils/provider-icon-assets.js
    - apps/gnome-extension/test/provider-icon-assets.test.js
  modified:
    - apps/backend/src/formatters/text-formatter.ts
    - apps/backend/test/output-parity.test.ts
    - apps/gnome-extension/utils/view-model.js
    - apps/gnome-extension/panel/indicator.js
    - apps/gnome-extension/utils/provider-icons.js
    - apps/gnome-extension/test/view-model.test.js

key-decisions:
  - "CLI keeps the richer view: relative and absolute timestamps together for `updated` and `reset` labels"
  - "The GNOME extension keeps shorter relative labels, but derives them from `resets_at`/`updated_at` instead of provider-supplied English strings"
  - "Known providers resolve packaged assets first (`assets/providers/*.svg`, then legacy PNGs) before any fallback badge path is considered"

requirements-completed: [PROV-04, DATA-03]

# Metrics
duration: 1 session
completed: 2026-03-29
---

# Phase 11 Plan 03: Locale-Aware Formatting & Dynamic GNOME Summary

**Phase 11 closed with the user-visible integration work: timestamps are locale-aware, copilot uses packaged assets, and the GNOME topbar no longer reserves dead slots for disabled providers.**

## Accomplishments

- Added backend timestamp helpers that format `updated` and `reset` text with locale-aware relative and absolute labels
- Updated text output so CLI snapshots no longer print raw ISO timestamps in human-facing mode
- Removed the fixed indicator provider order and rebuilt the GNOME topbar directly from snapshot/config order
- Added shared packaged-icon resolution and covered the copilot asset path explicitly in tests
- Updated GNOME view-model tests to assert data-driven topbar ordering and locale-aware reset labels

## Verification

- `cd apps/backend && bun run vitest run test/output-parity.test.ts`
- `pnpm --filter gnome-extension test`
- `bun x biome check .`

## Deviations From Plan

- A small pure helper (`apps/gnome-extension/utils/provider-icon-assets.js`) was introduced so icon-path resolution could be tested without loading GJS `Gio`/`St` bindings inside Vitest

## Next Phase Readiness

- The Phase 12 TUI can now rely on stable provider metadata, config-backed selection, persistent snapshots, and locale-aware formatting without revisiting the Phase 11 data contracts

---
*Phase: 11-provider-independence-data*
*Completed: 2026-03-29*

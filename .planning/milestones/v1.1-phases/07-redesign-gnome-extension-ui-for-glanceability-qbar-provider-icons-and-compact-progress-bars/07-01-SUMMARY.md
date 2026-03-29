---
phase: 07-redesign-gnome-extension-ui-for-glanceability-qbar-provider-icons-and-compact-progress-bars
plan: "01"
subsystem: ui
tags: [gnome-shell, gjs, stylesheet, assets, install, verification]
requires:
  - phase: 04-ubuntu-desktop-surface
    provides: GNOME extension lifecycle, panel indicator, and state-driven menu baseline
provides:
  - Packaged GNOME Shell stylesheet with neutral row and progress-bar classes
  - Bundled Claude and Codex provider assets plus a Copilot fallback badge helper
  - Source-only and post-install Wave 0 preflight verification for extension payloads
affects: [07-02-PLAN.md, 07-03-PLAN.md, install-flow]
tech-stack:
  added:
    - GNOME Shell stylesheet.css
    - packaged PNG provider assets
    - bash verification script
  patterns:
    - extension-owned assets
    - stylesheet load/unload lifecycle
    - two-mode Wave 0 preflight
key-files:
  created:
    - apps/gnome-extension/stylesheet.css
    - apps/gnome-extension/utils/provider-icons.js
    - apps/gnome-extension/assets/claude-code-icon.png
    - apps/gnome-extension/assets/codex-icon.png
    - scripts/verify-gnome-wave0.sh
  modified:
    - apps/gnome-extension/extension.js
    - scripts/install-ubuntu.sh
key-decisions:
  - "Package stylesheet and provider icons inside the GNOME extension instead of resolving qbar assets from the repo at runtime."
  - "Treat Wave 0 verification as two modes so source-tree checks stay independent from GNOME host binaries until install time."
patterns-established:
  - "Extension visuals must load from stylesheet.css in enable() and unload explicitly in disable()."
  - "Provider identity helpers resolve packaged file icons first and fall back to a readable in-extension badge for Copilot."
requirements-completed: []
duration: 4min
completed: 2026-03-26
---

# Phase 7 Plan 01: Packaged GNOME Visual Foundation Summary

**Packaged GNOME Shell stylesheet, bundled Claude/Codex provider assets, and a two-mode Wave 0 verifier for installed extension payloads**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-26T16:11:45Z
- **Completed:** 2026-03-26T16:15:39Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added `apps/gnome-extension/stylesheet.css` with neutral summary/provider/details classes, compact progress-bar styling, and restrained provider/status accents.
- Bundled Claude and Codex icons into the extension package and added `createProviderIdentityActor()` so provider identity no longer depends on runtime `qbar/` paths.
- Loaded the packaged stylesheet from the extension lifecycle, shipped `stylesheet.css` and `assets/` through `scripts/install-ubuntu.sh`, and added a Wave 0 verifier with `--source-only` and `--post-install` modes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add packaged stylesheet and provider identity assets** - `a09f32a` (feat)
2. **Task 2: Wire stylesheet and assets into extension runtime and install flow** - `3bad378` (feat)
3. **Task 3: Add the Wave 0 preflight command for install payload and GNOME smoke prerequisites** - `ab2941b` (feat)

**Plan metadata:** pending final docs commit

## Files Created/Modified

- `apps/gnome-extension/stylesheet.css` - Shell-only styling contract for summary rows, provider rows, progress bars, details rows, and provider identity slots.
- `apps/gnome-extension/utils/provider-icons.js` - Packaged icon resolver plus readable fallback badge actor for Copilot and unknown providers.
- `apps/gnome-extension/assets/claude-code-icon.png` - Bundled Claude identity asset for installed extension use.
- `apps/gnome-extension/assets/codex-icon.png` - Bundled Codex identity asset for installed extension use.
- `apps/gnome-extension/extension.js` - Loads and unloads the extension stylesheet during enable/disable.
- `scripts/install-ubuntu.sh` - Copies `stylesheet.css` and `assets/` into the installed GNOME extension directory.
- `scripts/verify-gnome-wave0.sh` - Wave 0 source-only and post-install verifier with explicit prerequisite remediation.

## Decisions Made

- Packaged assets are the only supported runtime source for Phase 7 visuals; the extension no longer assumes the repo checkout is present next to the installed GNOME extension.
- Wave 0 verification is split into `--source-only` and `--post-install` so packaging assertions can run before live GNOME binaries are available.

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

- Local verification is currently blocked by a missing `pnpm` binary. `bash scripts/verify-gnome-wave0.sh --source-only` now fails fast with remediation text instead of silently skipping the prerequisite.
- `roadmap update-plan-progress` checked off `07-01-PLAN.md` but left the phase progress row stale at `0/0`; the roadmap table was corrected manually to keep summary counts consistent.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 7 now has packaged styling and provider identity primitives ready for the compact view-model and row-rendering work in `07-02` and `07-03`.
- Before live GNOME verification, the host environment still needs `pnpm`; post-install/manual checks will also require `gjs`, `gnome-shell`, and `gnome-extensions`.

## Self-Check: PASSED

- Summary file exists at `.planning/phases/07-redesign-gnome-extension-ui-for-glanceability-qbar-provider-icons-and-compact-progress-bars/07-01-SUMMARY.md`.
- Task commits `a09f32a`, `3bad378`, and `ab2941b` are present in git history.
- Stub-pattern scan across the plan-touched implementation files returned no matches.

---
*Phase: 07-redesign-gnome-extension-ui-for-glanceability-qbar-provider-icons-and-compact-progress-bars*
*Completed: 2026-03-26*

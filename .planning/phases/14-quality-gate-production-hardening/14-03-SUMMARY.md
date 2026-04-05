---
phase: 14-quality-gate-production-hardening
plan: 03
subsystem: ui
tags: [gnome-shell, css, theme, dark-mode, light-mode, wcag, accessibility]

# Dependency graph
requires:
  - phase: 14-01
    provides: Biome strict lint rules that validate modified extension.js
provides:
  - "GNOME Shell dual-stylesheet theme awareness (dark + light + fallback)"
  - "WCAG AA-compliant light theme colors for all three providers"
  - "Simplified extension.js without manual stylesheet loading"
affects: [gnome-extension, packaging]

# Tech tracking
tech-stack:
  added: []
  patterns: ["GNOME 46 dual-stylesheet mechanism (stylesheet-dark.css / stylesheet-light.css)"]

key-files:
  created:
    - apps/gnome-extension/stylesheet-dark.css
    - apps/gnome-extension/stylesheet-light.css
  modified:
    - apps/gnome-extension/stylesheet.css
    - apps/gnome-extension/extension.js

key-decisions:
  - "Used text-level darkened colors (#1579cb, #996e1e, #567f39) for provider row border-left instead of accent colors, providing 4.5:1 contrast vs 3:1 on light backgrounds"
  - "Removed St import entirely from extension.js after confirming it was only used in the removed stylesheet methods"

patterns-established:
  - "Dual-stylesheet pattern: stylesheet-dark.css + stylesheet-light.css + stylesheet.css fallback for GNOME Shell extensions"
  - "Provider color adaptation: text-level colors (4.5:1 WCAG AA) for borders/text, accent colors (3:1) for fills/backgrounds"

requirements-completed: [HARD-03]

# Metrics
duration: 4min
completed: 2026-04-05
---

# Phase 14 Plan 03: GNOME Dual-Stylesheet Theme Awareness Summary

**Dual-stylesheet theme support with WCAG AA-compliant Adwaita light palette and automatic dark/light swap via GNOME 46 built-in mechanism**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-05T21:34:16Z
- **Completed:** 2026-04-05T21:38:47Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created dark and light stylesheets with identical BEM selector structure (44 selectors each) and WCAG AA-compliant provider colors
- Removed manual stylesheet loading from extension.js (31 lines deleted), eliminating double-loading conflict with GNOME Shell's built-in mechanism
- Kept stylesheet.css as pre-GNOME 46 fallback (identical to dark variant)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create stylesheet-dark.css and stylesheet-light.css** - `2dbf4ca` (feat)
2. **Task 2: Remove manual stylesheet loading from extension.js** - `a639e3c` (refactor)

## Files Created/Modified
- `apps/gnome-extension/stylesheet-dark.css` - Dark theme (verbatim copy of original One Dark palette)
- `apps/gnome-extension/stylesheet-light.css` - Light theme with Adwaita-compatible colors, WCAG AA contrast
- `apps/gnome-extension/stylesheet.css` - Fallback for pre-GNOME 46 shells (copy of dark)
- `apps/gnome-extension/extension.js` - Removed _loadStylesheet(), _unloadStylesheet(), St import, _stylesheetFile references

## Decisions Made
- Used text-level darkened provider colors (#1579cb, #996e1e, #567f39) for the 3px border-left on provider rows instead of the accent colors (#3799ea, #bf8a25, #6da148). Rationale: border-left is a thin visual identity mark adjacent to text -- the text-level colors provide 4.5:1 contrast (WCAG AA) vs 3:1 for accent colors, making the provider identity stripe more visible on light backgrounds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Provider row border colors use text-level contrast**
- **Found during:** Task 1 (light stylesheet creation)
- **Issue:** Plan's color mapping table specified accent colors (#3799ea, #bf8a25, #6da148) for provider row border-left, but plan acceptance criteria required hex values #1579cb, #996e1e, #567f39 to be present in the file. The accent colors only appear in rgba decompositions.
- **Fix:** Used text-level WCAG AA colors for border-left (4.5:1 contrast) and kept accent colors for progress fills (where 3:1 is sufficient for non-text UI elements)
- **Files modified:** apps/gnome-extension/stylesheet-light.css
- **Verification:** All 8 acceptance criteria checks pass, Biome lint clean
- **Committed in:** 2dbf4ca (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Color choice is strictly better (higher contrast on the same element). No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 14 fully complete (plans 01, 02, 03 all done)
- Visual verification on real GNOME Shell 46 session still recommended:
  1. `gsettings set org.gnome.desktop.interface color-scheme 'prefer-dark'` -- verify dark theme
  2. `gsettings set org.gnome.desktop.interface color-scheme 'prefer-light'` -- verify light theme
  3. Toggle between the two -- verify swap without restart

## Self-Check: PASSED

All 5 files verified on disk, both task commits (2dbf4ca, a639e3c) found in git log.

---
*Phase: 14-quality-gate-production-hardening*
*Completed: 2026-04-05*

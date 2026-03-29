# Phase 7: GNOME Extension UI Redesign - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the GNOME Shell extension UI so Ubuntu users can monitor provider usage more effectively from the top bar and the expanded menu. This phase covers the indicator summary, provider row presentation, compact progress visualization, restrained color usage, and adoption of the existing `qbar` provider icons where appropriate.

This phase does not add new providers, preferences screens, or a broader desktop app surface. It refines how the current normalized snapshot data is presented so the extension becomes more glanceable, less text-heavy, and more visually structured.

</domain>

<decisions>
## Implementation Decisions

### Information Density and Layout
- **D-01:** The expanded menu should move away from multi-line prose rows and toward compact provider-focused blocks that are scannable in seconds.
- **D-02:** Each provider entry should prioritize provider identity, quota progress, and short supporting metadata instead of rendering every available backend string inline.
- **D-03:** Provider details should be layered: primary usage information first, compact secondary metadata second, and verbose diagnostics only when relevant.

### Progress and Status Representation
- **D-04:** Quota state should be represented primarily with compact progress bars plus concise numeric values such as used, limit, and percent.
- **D-05:** Progress and severity should use restrained color on mostly neutral surfaces; color is for provider identity and alert emphasis, not decoration.
- **D-06:** Status communication must not rely on color alone. Labels, iconography, and text need to remain understandable for degraded and error states.

### Iconography and Visual Identity
- **D-07:** Provider-specific identity in the menu should reuse the existing `qbar` provider icons instead of generic symbolic icons.
- **D-08:** The UI should borrow selective visual cues from `qbar`, especially iconography and disciplined accent usage, without making the GNOME extension look like a separate themed dashboard.

### Indicator and Menu Behavior
- **D-09:** The top-bar indicator should stay calm and compact, surfacing aggregate state rather than turning into a crowded per-provider strip.
- **D-10:** The expanded menu should show richer information than the indicator, but still remain concise enough for quick decision-making.
- **D-11:** Actionable error guidance and refresh controls remain in scope, but they should be visually secondary to usage monitoring and should avoid adding unnecessary text noise.
- **D-12:** The existing refresh gating behavior from Phase 4 should be preserved so repeated manual refreshes cannot overlap while loading.

### the agent's Discretion
- Exact top-bar wording and aggregate summary logic, as long as it is compact and more informative than a generic provider count.
- Exact menu composition primitives, including whether to keep `PopupMenuItem` text rows or introduce richer `St` widget-based rows.
- Exact progress-bar styling, spacing, and host-theme integration, as long as the result stays minimal, playful, and Ubuntu-native.
- Exact handling of secondary diagnostics visibility, as long as the default presentation remains concise and non-verbose.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and design direction
- `.planning/PROJECT.md` - current product scope, Ubuntu-native constraint, and milestone direction
- `.planning/ROADMAP.md` - Phase 7 entry and milestone sequencing
- `.planning/STATE.md` - current phase ordering and recent roadmap evolution
- `.impeccable.md` - persistent design context for glanceability, restrained color, and minimal-but-playful direction

### Prior phase outputs that constrain this redesign
- `.planning/phases/04-ubuntu-desktop-surface/04-03-SUMMARY.md` - current GNOME extension UI baseline, summary states, provider detail rows, and refresh behavior
- `.planning/phases/05-delivery-hardening/05-CONTEXT.md` - requirement that diagnostics remain understandable from the desktop surface
- `.planning/phases/06-provider-reliability/06-CONTEXT.md` - provider reliability work, doctor guidance expectations, and error-state relevance

### Current GNOME extension implementation anchors
- `apps/gnome-extension/panel/indicator.js` - current top-bar icon and label rendering
- `apps/gnome-extension/panel/menu-builder.js` - current popup menu section structure and refresh/details actions
- `apps/gnome-extension/panel/provider-row.js` - current text-heavy provider row rendering
- `apps/gnome-extension/utils/view-model.js` - current snapshot-to-view-model mapping for summary and provider rows

### qbar visual references and assets
- `qbar/icons/claude-code-icon.png` - Claude provider icon to reuse
- `qbar/icons/codex-icon.png` - Codex provider icon to reuse
- `qbar/icons/amp-icon.svg` - Amp icon reference for future parity patterns
- `qbar/src/theme.ts` - restrained One Dark-derived palette and provider accent mapping
- `qbar/src/waybar-contract.ts` - compact icon-plus-status treatment and cautious surface styling
- `qbar/snippets/waybar-style.css` - practical reference for icon sizing, spacing, and restrained severity color usage

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/gnome-extension/utils/view-model.js`: already converts backend snapshots into UI-facing summary and provider-row data, making it the natural place to add compact metrics and progress-oriented fields.
- `apps/gnome-extension/panel/menu-builder.js`: already owns menu section composition and can be reshaped into a more structured hierarchy without changing backend contracts.
- `apps/gnome-extension/panel/provider-row.js`: is the current row boundary and can be replaced or upgraded to render richer GNOME widgets instead of multi-line strings.
- `apps/gnome-extension/panel/indicator.js`: already centralizes top-bar rendering and can absorb a more informative but still compact summary model.
- `qbar/icons/*`: already provides provider-brand assets that match the requested direction.
- `qbar/src/theme.ts` and `qbar/src/waybar-contract.ts`: provide a proven reference for restrained accent usage, icon sizing, and compact status presentation.

### Established Patterns
- The GNOME extension consumes normalized snapshot state rather than reaching into backend internals directly.
- Menu sections are rebuilt from state changes instead of being incrementally mutated.
- Refresh is already gated while loading and should stay that way.
- The current UI is intentionally simple and text-first; richer visual structure will likely require extending the current view model and introducing custom row composition.

### Integration Points
- New compact metrics and progress-bar fields should be derived in `apps/gnome-extension/utils/view-model.js` so presentation stays decoupled from provider/backend concerns.
- Provider-row redesign should connect through `apps/gnome-extension/panel/provider-row.js` and `apps/gnome-extension/panel/menu-builder.js`.
- Top-bar summary changes should remain isolated to `apps/gnome-extension/panel/indicator.js` plus summary view-model output.
- Reusing `qbar` icons in the extension will require an explicit asset strategy so the GNOME extension package can resolve and ship those assets reliably.
- The current extension has no dedicated visual styling layer for this richer UI, so Phase 7 may need to introduce one rather than relying on text-only PopupMenu defaults.

</code_context>

<specifics>
## Specific Ideas

- Replace text-heavy provider rows with compact rows or cards that lead with icon, provider name, progress bar, and a short quota string.
- Keep richer details available on click, but compress them into short labels rather than paragraph-like diagnostics.
- Reuse `qbar` provider icons and borrow its restrained accent logic without importing an overly themed look into GNOME.
- Preserve a calm top-bar surface; the deeper visual richness should live primarily in the expanded menu.
- Respect host-platform theming where practical because no explicit light/dark split was requested.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---
*Phase: 07-redesign-gnome-extension-ui-for-glanceability-qbar-provider-icons-and-compact-progress-bars*
*Context gathered: 2026-03-26*

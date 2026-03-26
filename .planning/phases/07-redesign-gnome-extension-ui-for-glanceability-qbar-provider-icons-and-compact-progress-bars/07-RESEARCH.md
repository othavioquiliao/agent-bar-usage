# Phase 7: GNOME Extension UI Redesign - Research

**Researched:** 2026-03-26
**Domain:** GNOME Shell 46 extension UI redesign in GJS using `St`, `PopupMenu`, packaged assets, and shell-only CSS
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

## Project Constraints (from CLAUDE.md)

- Start substantive repo changes through the appropriate `gsd-*` workflow; do not bypass planning artifacts unless explicitly asked.
- Treat `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, and `.planning/STATE.md` as the scope/progress source of truth.
- Preserve the Ubuntu-first constraint: the UI must feel native to GNOME/Ubuntu rather than like a port of the macOS shell.
- Keep the backend/frontend contract independent from GNOME-extension specifics.
- Use the existing design context in `.impeccable.md`: passive monitoring first, glanceability over prose, restrained accent color, minimal-but-playful tone, and no color-only status meaning.
- For frontend work, avoid generic dashboard/card-grid aesthetics, overuse of decorative color, and gratuitous motion.
- Respect GNOME extension lifecycle discipline: create UI in `enable()`, clean up in `disable()`, and avoid shell changes during construction/module initialization.

## Summary

Phase 7 should stay inside the current architecture rather than introducing a new UI stack. The current extension already has the correct high-level seam: normalized backend snapshot -> pure view model -> menu/indicator render. The redesign should preserve that seam, expand the view model with compact quota/progress/icon metadata, and swap the current text-only `PopupMenuItem` rows for structured `PopupBaseMenuItem`/`St` rows plus a new `stylesheet.css`.

The most important implementation decision is packaging. The current install flow copies only `extension.js`, `metadata.json`, `panel`, `services`, `state`, and `utils`; it does not ship a stylesheet or icon assets. Since GNOME extensions are expected to carry `stylesheet.css` and bundled assets inside the extension directory, Phase 7 must add a real extension styling layer and copy `qbar` icon assets into the installed extension instead of resolving them from the repo at runtime.

The main technical risk is not the layout primitives themselves, but the shell-specific details around sizing and manual validation. GNOME 46 changed `St.Bin` expansion behavior, which matters for compact bar/fill layouts. That means the plan should front-load a small row/progress proof-of-concept, keep progress rendering simple, and reserve live GNOME Shell verification as a mandatory phase gate because the current machine lacks `gnome-shell` and `gnome-extensions`.

**Primary recommendation:** Keep the existing state/view-model pipeline, add `stylesheet.css` plus packaged `assets/`, and implement provider rows as structured `PopupBaseMenuItem`/`St` layouts with compact metrics and restrained accent usage.

## Standard Stack

### Core

| Library / API | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| GNOME Shell extension ESModules (`Extension`, `PanelMenu.Button`) | GNOME Shell 46 target | Indicator lifecycle and panel integration | Already the project's frontend stack; GNOME 46 docs show no relevant `extension.js` lifecycle breakage |
| `PopupMenu` + `PopupBaseMenuItem` | GNOME Shell 46 target | Structured popup menu sections and provider rows | Official shell menu API; supports richer items without inventing a custom menu system |
| `St` widgets (`St.BoxLayout`, `St.Label`, `St.Icon`, `St.Widget`/`St.Bin`) | GNOME Shell 46 target | Row composition, icon slots, progress track/fill, styling hooks | Native GNOME Shell UI toolkit; aligns with Ubuntu-native constraint |
| `Gio.FileIcon` + `St.Icon:gicon` | Gio 2.87.5 docs / Shell API 18 docs | Load packaged provider icons from extension files | Official file-backed icon path; avoids runtime repo-path coupling |
| `stylesheet.css` in extension root | Standard GNOME extension structure | Shell-only styling layer for rows, bars, spacing, and state colors | GNOME extensions conventionally ship `stylesheet.css`; the current codebase has no equivalent yet |

### Supporting

| Library / API | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 3.2.4 | Pure JS tests for view-model and non-GJS helpers | Keep using for snapshot/view-model and packaging helper coverage; verified as npm `latest` on 2026-03-26 |
| GJS runtime | 1.86.0 (local machine) | Shell-side JS execution and syntax compatibility | Use for live extension/manual verification on a GNOME host |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Rich `PopupBaseMenuItem` rows with `St` children | Plain `PopupMenuItem` / multiline strings | Simpler, but it keeps the current text-heavy problem and prevents compact icon + bar composition |
| Packaged extension `assets/` + `stylesheet.css` | Resolve files directly from `qbar/` in the repo | Faster in development, but breaks install reliability and violates extension packaging expectations |
| `St` widget composition for progress bars | `St.DrawingArea` / Cairo drawing | Drawing gives tighter control, but adds shell-version rendering complexity and is unnecessary for a minimal bar unless layout APIs prove insufficient |

**Installation:**
```bash
# No new Phase 7 runtime packages are required.
# Existing test/install flows still depend on the repo package manager.
pnpm install
```

**Version verification:** `Vitest` 3.2.4 is still the npm `latest` tag as of 2026-03-26 on npmjs. No additional npm packages are recommended for this phase.

## Architecture Patterns

### Recommended Project Structure

```text
apps/gnome-extension/
├── extension.js                # Extension lifecycle only
├── metadata.json               # Shell version + identity
├── stylesheet.css              # New shell-only design tokens and row styling
├── assets/                     # New packaged provider assets copied from qbar
├── panel/
│   ├── indicator.js            # Aggregate top-bar rendering only
│   ├── menu-builder.js         # Menu section composition
│   ├── provider-row.js         # Rich provider row actor construction
│   └── progress-bar.js         # Optional small helper if row assembly gets noisy
├── state/
├── services/
└── utils/
    └── view-model.js           # Compact metrics, row state, icon key, summary logic
```

### Pattern 1: Preserve the View-Model Boundary
**What:** Keep backend/provider knowledge out of shell widgets. Expand `view-model.js` to produce compact summary and provider-row fields such as aggregate health ratio, issue count, icon key, quota line, clamped progress percent, and one secondary line only.

**When to use:** For every new display field in the indicator or menu.

**Example:**
```js
// Source: local project pattern in apps/gnome-extension/utils/view-model.js
const snapshotViewModel = buildSnapshotViewModel(state, { now });

for (const providerRow of snapshotViewModel.providerRows)
  menu.addMenuItem(createProviderRow(providerRow));
```

### Pattern 2: Use `PopupBaseMenuItem` / `St` Composition for Rows
**What:** Treat each provider row as a structured layout actor, not a text blob. Use a left icon slot, a content column, a header line, a compact bar, and one secondary label.

**When to use:** For provider rows, the summary row, and any secondary diagnostic row that needs layout control.

**Example:**
```js
// Source: https://gjs.guide/extensions/topics/popup-menu.html
const item = new PopupMenu.PopupMenuItem('Item Label', {
    reactive: true,
    style_class: 'my-menu-item',
});
item.sensitive = false;
```

**Research note:** The docs show `PopupBaseMenuItem` as the base class and `PopupMenuItem`/`PopupImageMenuItem` as concrete menu entries. For Phase 7, the recommended implementation is to keep using `PopupMenu` but build richer row actors with `St` children rather than multiline label text.

### Pattern 3: Ship an Extension Stylesheet and Style by Class
**What:** Move visual rules out of ad hoc inline strings and into `stylesheet.css`, using shell-specific classes for rows, icon slots, bars, labels, hover states, and severity accents.

**When to use:** For all stable design tokens and repeated visual rules. Reserve inline styles only for truly dynamic values such as computed fill widths if needed.

**Example:**
```css
/* Source: https://gjs.guide/extensions/overview/anatomy.html */
.agent-bar-provider-row {
  padding: 8px 12px;
}

.agent-bar-provider-row__meta {
  color: rgba(192, 201, 212, 0.78);
}
```

### Pattern 4: Resolve Provider Icons from the Installed Extension Path
**What:** Use the extension's own path/dir to resolve bundled assets, then pass them to `St.Icon` as a `Gio.Icon`.

**When to use:** For Claude and Codex row identity icons, and for any future packaged asset.

**Example:**
```js
// Source: Extension.path docs + Gio.FileIcon docs + St.Icon:gicon docs
// Inference: the JS constructor syntax follows normal GObject property construction.
const iconFile = Gio.File.new_for_path(`${this.path}/assets/codex-icon.png`);
const icon = new St.Icon({
    gicon: new Gio.FileIcon({file: iconFile}),
    icon_size: 16,
    fallback_icon_name: 'applications-system-symbolic',
});
```

### Anti-Patterns to Avoid

- **Multiline prose rows:** The current `formatRowLines()` pattern in `provider-row.js` creates exactly the reading-heavy menu the phase is trying to remove.
- **Indicator detail creep:** Do not move provider icons, per-provider bars, or verbose status text into the top bar.
- **Runtime asset coupling to `qbar/`:** Installed extensions must not assume the repo checkout exists next to the extension directory.
- **Inline-diagnostics overload:** Keep doctor commands, source strings, and updated timestamps out of the default provider scan path.
- **Color-only semantics:** Every degraded/error state still needs readable text or icon labels.
- **Relying on `ActorAlign.FILL` for bin growth:** GNOME 46 requires explicit `x-expand` / `y-expand` on `St.Bin` and subclasses.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Menu layout | A custom popup/menu system | GNOME Shell `PopupMenu` + rich menu items | Keeps keyboard/focus behavior, lifecycle, and shell integration standard |
| Visual styling | Dozens of ad hoc inline styles | Extension `stylesheet.css` + stable style classes | Easier theming, reviewability, and consistent spacing/color tokens |
| Provider icons | Runtime filesystem discovery or network fetches | Bundled `assets/` loaded through `Gio.FileIcon` | Reliable in installed extension zips and user-local extension dirs |
| Progress rendering | Cairo drawing by default | Simple `St` actor track/fill composition | Lower complexity and fewer GNOME-version rendering pitfalls |
| Diagnostics text | Raw backend messages repeated in each row | View-model-normalized short labels + footer/details area | Preserves glanceability and Phase 5 diagnostic readability |

**Key insight:** The shell already gives you the menu container, lifecycle, icon model, and CSS layer. The work in Phase 7 is information design plus careful composition, not inventing new infrastructure.

## Common Pitfalls

### Pitfall 1: Forgetting to Ship `stylesheet.css` and Assets
**What goes wrong:** The redesign looks correct in a repo checkout but loses styles/icons in the installed extension.
**Why it happens:** The current install script only copies `extension.js`, `metadata.json`, `panel`, `services`, `state`, and `utils`.
**How to avoid:** Add `stylesheet.css` and a new `assets/` directory to the extension source and to the install/packaging flow in the same change set.
**Warning signs:** Provider icons disappear after install, rows fall back to default popup styling, or design only works when run from the repo.

### Pitfall 2: Progress Layout Breakage on GNOME 46
**What goes wrong:** Bar tracks/fills do not expand or align the way they did in earlier shell examples.
**Why it happens:** GNOME 46 changed `St.Bin` expansion semantics; `ActorAlign.FILL` alone no longer causes expansion.
**How to avoid:** Set explicit `x-expand` / `y-expand` on any `St.Bin`-based track/fill actors and validate the layout in a live GNOME 46 session early.
**Warning signs:** The fill actor stays tiny, the bar does not stretch across the content width, or rows collapse unexpectedly.

### Pitfall 3: Reintroducing Text Noise Through Secondary Metadata
**What goes wrong:** The code technically adds bars and icons, but rows still read like paragraphs because diagnostics, timestamps, and source labels remain inline.
**Why it happens:** The current view model exposes many textual fields and the menu already has a habit of rendering them all.
**How to avoid:** Enforce one primary metric line and one secondary line in the row contract; push the rest into Details.
**Warning signs:** Rows wrap to three or more lines in healthy states or the menu requires reading instead of scanning.

### Pitfall 4: Color Becomes Decorative Instead of Informational
**What goes wrong:** The menu starts looking like a themed dashboard rather than a calm GNOME utility.
**Why it happens:** `qbar` uses distinct provider colors, and it is easy to over-apply them to surfaces, text, and borders.
**How to avoid:** Keep neutral surfaces dominant; reserve accent mostly for icon identity, bar fill, and issue emphasis.
**Warning signs:** Large colored backgrounds, colored paragraph text, or multiple competing accent hues in one row.

### Pitfall 5: No Live Shell Validation
**What goes wrong:** Node-based tests pass, but focus behavior, sizing, icon loading, or hover states are broken in GNOME Shell.
**Why it happens:** The current test setup is pure `vitest` in a Node environment, not a shell integration harness.
**How to avoid:** Treat nested-shell or real GNOME-session verification as a required phase gate, not optional polish.
**Warning signs:** The plan has unit tests only and no explicit GNOME 46 smoke pass.

## Code Examples

Verified patterns from official sources:

### Indicator Lifecycle
```js
// Source: https://gjs.guide/extensions/development/creating.html
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);
const icon = new St.Icon({
    icon_name: 'face-laugh-symbolic',
    style_class: 'system-status-icon',
});
this._indicator.add_child(icon);
Main.panel.addToStatusArea(this.uuid, this._indicator);
```

### Rich Popup Menu Items
```js
// Source: https://gjs.guide/extensions/topics/popup-menu.html
const menuItem = new PopupMenu.PopupMenuItem('Item Label', {
    reactive: true,
    style_class: 'my-menu-item',
});
menuItem.sensitive = false;
menu.addMenuItem(menuItem);
```

### File-Backed Icon Support
```js
// Source: https://gnome.pages.gitlab.gnome.org/gnome-shell/st/class.Icon.html
// Source: https://docs.gtk.org/gio/class.FileIcon.html
const icon = new St.Icon({
    gicon: someGioIcon,
    fallback_icon_name: 'dialog-information-symbolic',
});
```

### Shell-Only Stylesheet
```css
/* Source: https://gjs.guide/extensions/overview/anatomy.html */
.example-style {
  color: green;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Text-heavy `PopupMenuItem` rows | Structured `PopupBaseMenuItem`/`St` composition | Current GNOME extension practice; Phase 7 design contract on 2026-03-26 | Better glanceability and room for icons/bars without more prose |
| Repo-relative visual references | Packaged extension assets resolved from extension path | Required for installed extensions; reinforced by extension anatomy docs | Prevents broken icons/styles outside the repo checkout |
| Implicit `St.Bin` fill behavior | Explicit `x-expand` / `y-expand` on GNOME 46 | GNOME Shell 46 | Important for compact progress bars and row alignment |
| Summary prose blocks | Aggregate health ratio / issue count plus terse details area | Phase 7 UI-SPEC approved 2026-03-26 | Makes the panel/menu useful in one glance cycle |

**Deprecated/outdated:**
- Relying on multiline provider prose as the primary scan path.
- Assuming `ActorAlign.FILL` is enough to make `St.Bin` expand on GNOME 46.
- Treating raw backend error text as acceptable default row content.

## Open Questions

1. **What is the exact Copilot fallback icon treatment?**
   - What we know: `qbar/icons/` currently has Claude, Codex, and Amp only; the UI-SPEC explicitly calls for an in-extension fallback badge for Copilot.
   - What's unclear: whether the fallback should be a letter badge, a GitHub-flavored badge, or a symbolic icon plus label.
   - Recommendation: plan a tiny local badge component in `provider-row.js`/`stylesheet.css` and keep it neutral, text-readable, and non-branded.

2. **What is the simplest stable fill implementation for the compact progress bar in real GNOME Shell?**
   - What we know: `PopupBaseMenuItem`/`St` composition is standard, and GNOME 46 requires explicit expand properties.
   - What's unclear: whether the desired fill can be done cleanly with styled `St` actors alone or needs one allocation-aware helper for pixel width.
   - Recommendation: make a proof-of-concept the first implementation task, and keep the fallback option simple rather than escalating to Cairo immediately.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Test scripts and repo tooling | ✓ | v25.7.0 | — |
| npm | Registry/package inspection | ✓ | 11.12.0 | — |
| pnpm | Repo scripts (`build:backend`, `test:gnome`, install flow) | ✗ | — | None |
| GJS | Shell-side JS/runtime spot checks | ✓ | 1.86.0 | Static review only |
| `gnome-shell` CLI | Nested-shell manual validation | ✗ | — | None |
| `gnome-extensions` CLI | Enable/reload/manual extension verification | ✗ | — | None |
| Vitest CLI | Unit test execution | ✗ (global) | — | Run through repo package manager after dependencies are installed |

**Missing dependencies with no fallback:**
- `pnpm` for repo-standard install and test commands
- `gnome-shell` and `gnome-extensions` for live Phase 7 validation

**Missing dependencies with fallback:**
- Global `vitest` binary is absent, but the repo package can provide it once dependencies are installed

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `apps/gnome-extension/vitest.config.ts` |
| Quick run command | `pnpm --filter gnome-extension exec vitest run test/view-model.test.js --config vitest.config.ts` |
| Full suite command | `pnpm test:gnome` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| — | Aggregate indicator summary becomes compact and stateful (`Refreshing`, ratio, issue count, `Service`, `No data`) | unit | `pnpm --filter gnome-extension exec vitest run test/view-model.test.js --config vitest.config.ts` | ✅ |
| — | Provider row view model emits compact quota/progress/icon/secondary metadata fields | unit | `pnpm --filter gnome-extension exec vitest run test/view-model.test.js --config vitest.config.ts` | ✅ |
| — | Refresh action remains single-flight while loading | unit | `pnpm --filter gnome-extension exec vitest run test/polling-service.test.js --config vitest.config.ts` | ✅ |
| — | Styled row composition and packaged icon loading work in GNOME Shell 46 | manual smoke | `dbus-run-session gnome-shell --nested --wayland` then `gnome-extensions enable agent-bar-ubuntu@othavio.dev` | ❌ Wave 0 |
| — | Install flow ships `stylesheet.css` and `assets/` into the extension directory | script/integration | `bash scripts/install-ubuntu.sh` on a GNOME host, then inspect `~/.local/share/gnome-shell/extensions/agent-bar-ubuntu@othavio.dev/` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter gnome-extension exec vitest run test/view-model.test.js --config vitest.config.ts`
- **Per wave merge:** `pnpm test:gnome`
- **Phase gate:** Full extension tests plus one live GNOME 46 smoke pass before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] Extend `apps/gnome-extension/test/view-model.test.js` to cover aggregate ratio/issue copy, progress clamping, and secondary-line prioritization
- [ ] Add a pure helper test seam for provider row composition if `provider-row.js` grows non-trivial formatting logic
- [ ] Add a packaging/install assertion for `stylesheet.css` and `assets/` copy behavior
- [ ] Install `pnpm` so repo-standard test commands can run
- [ ] Reserve a GNOME 46 manual smoke checklist because Node tests cannot validate actual shell layout/theming

## Sources

### Primary (HIGH confidence)

- Local project sources:
  - `apps/gnome-extension/panel/indicator.js` - current indicator rendering boundary
  - `apps/gnome-extension/panel/menu-builder.js` - current menu section structure
  - `apps/gnome-extension/panel/provider-row.js` - current multiline row anti-pattern
  - `apps/gnome-extension/utils/view-model.js` - current snapshot/view-model boundary
  - `apps/gnome-extension/test/view-model.test.js` - existing extension test seam
  - `scripts/install-ubuntu.sh` - current install/package copy behavior
  - `qbar/src/theme.ts` and `qbar/snippets/waybar-style.css` - restrained accent and neutral surface references
- GJS Guide, "Anatomy of an Extension" - https://gjs.guide/extensions/overview/anatomy.html
- GJS Guide, "Extension (ESModule)" - https://gjs.guide/extensions/topics/extension.html
- GJS Guide, "Popup Menu" - https://gjs.guide/extensions/topics/popup-menu.html
- GJS Guide, "Getting Started" - https://gjs.guide/extensions/development/creating.html
- GJS Guide, "Port Extensions to GNOME Shell 46" - https://gjs.guide/extensions/upgrading/gnome-shell-46.html
- GJS Guide, "GNOME Shell Extensions Review Guidelines" - https://gjs.guide/extensions/review-guidelines/review-guidelines.html
- GNOME Shell `St.Icon` docs - https://gnome.pages.gitlab.gnome.org/gnome-shell/st/class.Icon.html
- GNOME Shell `St.BoxLayout` docs - https://gnome.pages.gitlab.gnome.org/gnome-shell/st/class.BoxLayout.html
- Gio `FileIcon` docs - https://docs.gtk.org/gio/class.FileIcon.html

### Secondary (MEDIUM confidence)

- npm package page for `vitest` current tag/date verification - https://www.npmjs.com/package/vitest?activeTab=versions

### Tertiary (LOW confidence)

- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - existing repo stack plus official GNOME Shell/Gio docs line up cleanly
- Architecture: MEDIUM - the main pattern is clear, but compact bar-fill behavior still needs live GNOME 46 validation
- Pitfalls: HIGH - directly supported by current code, install script behavior, and GNOME 46 upgrade notes

**Research date:** 2026-03-26
**Valid until:** 2026-04-25

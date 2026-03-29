---
phase: 11
slug: provider-independence-data
status: approved
shadcn_initialized: false
preset: none
created: 2026-03-29
---

# Phase 11 — UI Design Contract

> Visual and interaction contract for the GNOME extension and provider-selection CLI surfaces touched by Phase 11.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | GNOME Shell `St` + `PopupMenu` + `@clack/prompts` |
| Icon library | packaged SVG/PNG provider assets in `apps/gnome-extension/assets/` |
| Font | GNOME Shell default (Cantarell/system sans) |

---

## Spacing Scale

Declared values:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon inset, tight inline gaps |
| sm | 8px | Default chip/menu padding |
| md | 12px | Provider row inner spacing |
| lg | 16px | Menu section padding |
| xl | 24px | Visual separation between major groups |
| 2xl | 32px | Reserved for larger CLI prompt gaps |
| 3xl | 48px | Not expected in this phase |

Exceptions: Keep existing 6px/18px panel-density values where GNOME Shell layout already depends on them (indicator container spacing, icon box size).

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 12px | 400 | 1.4 |
| Label | 11px | 700 | 1.2 |
| Heading | 13px | 700 | 1.3 |
| Display | 14px | 700 | 1.2 |

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#282c34` | Indicator chips, menu surfaces |
| Secondary (30%) | `#21252b` | Popover body, recessed panels, empty states |
| Accent (10%) | `#61afef`, `#e5c07b`, `#98c379` | Provider identity only: Codex, Claude, Copilot |
| Destructive | `#e06c75` | Error states and destructive feedback only |

Accent reserved for: provider icon accents, provider edge markers, provider-specific highlight states. Never use provider accents for generic actions like Refresh or Save.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | Save provider selection |
| Empty state heading | No providers selected |
| Empty state body | Choose at least one provider with `agent-bar providers` to populate the topbar. |
| Error state | Could not refresh provider data. Run `agent-bar doctor` and try again. |
| Destructive confirmation | Hide provider from topbar: credentials stay stored, but the provider disappears from the panel until re-enabled. |

---

## Interaction Contract

- Indicator chips must render only the providers currently enabled in backend config, in config order.
- Known providers (`claude`, `codex`, `copilot`) must show packaged icons before any fallback badge is considered.
- Missing usage should show a neutral placeholder (`--%`) only for enabled providers that are still loading or unavailable; disabled providers should not reserve space.
- Relative timestamps should read naturally in the user's locale (for example, "2 hours ago"), while detailed/absolute labels should use locale-aware date formatting.
- Provider-selection CLI should present current enabled providers first and preserve order unless the user explicitly changes it.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | not required |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-03-29

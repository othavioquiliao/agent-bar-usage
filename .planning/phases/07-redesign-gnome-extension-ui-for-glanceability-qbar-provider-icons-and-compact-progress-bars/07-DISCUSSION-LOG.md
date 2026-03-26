# Phase 7: GNOME Extension UI Redesign - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-03-26T15:09:57Z
**Phase:** 07-redesign-gnome-extension-ui-for-glanceability-qbar-provider-icons-and-compact-progress-bars
**Areas discussed:** information density, progress visualization, iconography, indicator behavior, diagnostics placement

---

## Information Density

| Option | Description | Selected |
|--------|-------------|----------|
| Compact metric rows | Provider-focused rows with primary usage data and short supporting metadata | ✓ |
| Mixed text rows | Keep the current multi-line rows but trim a few lines | |
| Verbose diagnostic rows | Keep detailed strings visible inline for every provider | |

**User's choice:** Compact metric rows
**Notes:** [auto] Selected recommended default. Matches the user's explicit preference for less unnecessary text and more specific data in the menu.

---

## Progress Visualization

| Option | Description | Selected |
|--------|-------------|----------|
| Progress bars plus numbers | Compact horizontal quota bars with concise numeric values | ✓ |
| Numbers only | Show percent and used/limit without visual bars | |
| Status text only | Keep qualitative labels such as Healthy and Error as the primary signal | |

**User's choice:** Progress bars plus numbers
**Notes:** [auto] Selected recommended default. Matches the user's explicit request for progress bars and strategic use of color.

---

## Provider Iconography

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse qbar provider icons | Use the existing qbar provider assets in the GNOME extension menu | ✓ |
| Keep GNOME symbolic only | Continue using generic symbolic icons and text labels | |
| Full custom icon-led shell | Push custom branding into every indicator and menu surface | |

**User's choice:** Reuse qbar provider icons
**Notes:** [auto] Selected recommended default. Matches the user's explicit request to replace the current provider icon treatment with the qbar assets already in the repo.

---

## Indicator Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Calm aggregate summary | Keep the top bar compact and summarize overall state only | ✓ |
| Per-provider top-bar detail | Surface multiple provider details directly in the top bar | |
| Icon only | Remove most summary text and rely on a single icon | |

**User's choice:** Calm aggregate summary
**Notes:** [auto] Selected recommended default. Best fit for glanceability and for keeping the extension native to Ubuntu/GNOME rather than visually crowded.

---

## Diagnostics Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Secondary details area | Keep actionable diagnostics available, but visually secondary to usage monitoring | ✓ |
| Inline per-provider diagnostics | Show verbose errors and doctor guidance inside each provider row | |
| Separate diagnostics-only view | Move troubleshooting outside the main menu flow | |

**User's choice:** Secondary details area
**Notes:** [auto] Selected recommended default. Preserves the diagnostic value established in earlier phases without letting failure text dominate the menu.

---

## the agent's Discretion

- Exact top-bar wording and aggregate summary logic
- Exact GNOME composition primitives for richer provider rows
- Exact progress-bar spacing and host-theme adaptation
- Exact compact wording for secondary diagnostics

## Deferred Ideas

None.

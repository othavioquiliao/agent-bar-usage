---
phase: 4
slug: ubuntu-desktop-surface
status: complete
created: 2026-03-25
updated: 2026-03-25
---

# Phase 4 Research — Ubuntu Desktop Surface

## Objective

Research how to implement Phase 4: Ubuntu Desktop Surface.

Answer: what the team needs to know to plan a GNOME Shell extension for Ubuntu 24.04.4 LTS on top of the existing Node.js/TypeScript backend.

## Current State

- The backend contract already exists in `apps/backend` and is stable enough for UI consumption.
- Providers for Copilot, Codex CLI, and Claude CLI are already implemented and isolated by the backend coordinator.
- There is no `apps/gnome-extension/` app yet.
- There is no `04-CONTEXT.md` and no `04-UI-SPEC.md`, so planning must rely on project requirements, architecture notes, and GNOME extension constraints.

## Planning-Relevant Findings

### 1. GNOME Shell extension baseline is ESModule-first

- GNOME Shell extensions use ESModules on GNOME 45+.
- Ubuntu 24.04.4 LTS should be treated as a GNOME Shell 46-family target for planning purposes.
- The minimum required files are `metadata.json` and `extension.js`.
- `metadata.json` must declare a valid `uuid`, `name`, `description`, and `shell-version`.
- `shell-version` entries use the major version style for GNOME 40+.

Planning implication:
- The extension scaffold must start with ESModule-compatible files and metadata aligned with GNOME 46.
- Phase 4 should not waste time on legacy GNOME Shell compatibility paths.

### 2. The extension should stay thin

- The backend already owns provider-specific logic, refresh coordination, caching, config, secrets, formatting, and serialization.
- The GNOME extension only needs to call the backend, parse JSON, hold UI state, render rows, and trigger refreshes.
- The extension should not reimplement provider logic, cache policy, or diagnostics semantics.

Planning implication:
- The phase should preserve a hard boundary:
  - backend owns data truth
  - extension owns surface state and rendering

### 3. Use `Gio.Subprocess` for backend execution

- Official GJS guidance recommends `Gio.Subprocess` over low-level GLib spawn helpers.
- `Gio.Subprocess` supports safe async process execution, stdout/stderr capture, and cancellation.
- `communicate_utf8_async()` is the cleanest fit for one-shot backend calls returning JSON.
- `Gio.SubprocessLauncher` is useful when environment variables, cwd, or repeated command spawning need control.

Planning implication:
- The extension backend client should be implemented as a small `Gio.Subprocess` wrapper.
- Refresh requests should be non-blocking and cancellable.
- The phase should explicitly avoid shell-string-based execution when argv execution is possible.

### 4. The natural GNOME UI pattern is a top-bar indicator plus popup menu

- `PanelMenu.Button` is the correct shell primitive for a top-bar indicator.
- `PopupMenu` and `PopupMenuSection` are the right menu-building primitives for provider rows and actions.
- `St.Icon`, `St.Label`, and menu item types are sufficient for a v1 status menu.
- A detail-rich but compact popup is more aligned with GNOME Shell patterns than building a separate desktop app window in this phase.

Planning implication:
- The phase should target a top-bar indicator with popup sections rather than a separate GTK app.
- Provider rows, last-updated state, and refresh actions belong in popup sections composed from shell primitives.

### 5. Settings should use GNOME extension conventions

- If preferences are added, `prefs.js` is the supported extension entrypoint.
- GNOME extension settings typically use GSettings with schema IDs under `org.gnome.shell.extensions.*`.
- On modern GNOME Shell versions, schemas are compiled automatically when installed through `gnome-extensions`, but local dev still benefits from `glib-compile-schemas`.

Planning implication:
- Phase 4 can scaffold `prefs.js` and schema plumbing if needed, but should avoid over-expanding preferences in v1.
- The first UI phase should prefer hardcoded backend command discovery plus minimal extension settings, not a large settings surface.

### 6. Testability depends on separating shell code from pure modules

- Files importing `resource:///org/gnome/shell/*` are hard to validate in ordinary Node/Vitest.
- Pure JS modules that handle JSON parsing, view-model shaping, and time formatting can be tested with Vitest if they avoid shell-only imports.
- Shell integration code should stay thin and be covered with smoke/manual verification instead of pretending to be fully unit-testable in Node.

Planning implication:
- The extension architecture must separate:
  - shell-only code: `extension.js`, indicator/menu assembly
  - pure modules: backend client shaping, extension state, formatting helpers
- Phase 4 should establish that seam early so later tests stay cheap.

### 7. UI quality guardrails still matter without a formal UI-SPEC

- No `UI-SPEC.md` exists yet, so there is no formal design contract.
- The existing project rules still reject bland, boilerplate UI work.
- For a GNOME Shell extension, that means:
  - use GNOME-native structure first
  - keep information density tight
  - avoid cramming too much data into the panel label
  - make failure state legible but not noisy

Planning implication:
- The phase should prioritize an intentional menu hierarchy and state model over decoration.
- The first UI should support:
  - summary presence in panel
  - readable provider rows
  - clear refresh/error/updated-at affordances

## Recommended Phase Shape

The roadmap already gives the right three-plan decomposition:

1. `04-01` should establish the extension app, metadata, module layout, and a testable architecture seam.
2. `04-02` should implement the backend bridge, refresh lifecycle, state management, and polling.
3. `04-03` should build the actual panel/menu UI and refresh interactions on top of the bridge.

This order is important:

- without the scaffold, the bridge has nowhere stable to live
- without the bridge/state model, the menu risks coupling directly to process execution
- without both, the UI becomes hard to test and hard to evolve

## Risks and Constraints

### Risk: backend path resolution on real machines

The extension will need a predictable way to find the backend executable in local dev and installed setups.

Planning response:
- include backend command resolution as an explicit task in `04-02`
- ensure failures are shown as extension-level status, not silent no-op behavior

### Risk: overlapping refreshes

The extension can easily spam subprocesses if refresh is triggered by polling and user clicks at the same time.

Planning response:
- make polling/state a dedicated service
- define in-flight request handling and cancellation rules in `04-02`

### Risk: shell-only code swallowing errors

GNOME Shell extensions can fail noisily or silently if cleanup and signal disconnection are sloppy.

Planning response:
- `04-01` and `04-03` should require clean enable/disable lifecycle boundaries
- plan acceptance criteria should include explicit cleanup expectations

### Risk: over-designing prefs too early

Preferences can sprawl before the first useful panel surface exists.

Planning response:
- keep prefs optional or minimal in Phase 4
- defer extensive settings UX to later unless strictly needed for the first usable surface

## Validation Architecture

### Testing strategy

- Reuse `vitest` for pure extension modules that do not import GNOME Shell resources directly.
- Keep shell integration files thin and validate them with smoke checks plus manual GNOME Shell verification.
- Preserve backend contract verification during UI work, because the extension depends on stable backend JSON.

### Recommended validation split

- Pure JS/state/adapter modules:
  - Vitest
  - deterministic snapshot and state tests
- Shell integration modules:
  - file existence and metadata validation
  - manual enable/disable smoke on Ubuntu GNOME
  - targeted subprocess/error smoke checks

### Expected Wave 0 needs

- create `apps/gnome-extension/`
- add a dedicated test config or package script for pure extension modules
- establish at least one smoke-check command for extension metadata/layout validity

## Planning Recommendations

- Continue without `UI-SPEC.md` for this planning pass, but keep the menu structure and state model intentional.
- Make `04-01` responsible for setting up a testable seam, not just dropping extension files into the repo.
- Make `04-02` own subprocess execution, JSON parsing, polling, cancellation, and state transitions.
- Make `04-03` own indicator/menu rendering, refresh interaction, and user-facing error/readability behavior.
- Keep `prefs.js` and GSettings minimal unless the implementation discovers a hard requirement for configurable backend path or polling interval.

## External References

- GNOME JavaScript Guide, Anatomy of an Extension: https://gjs.guide/extensions/overview/anatomy.html
- GNOME JavaScript Guide, Port Extensions to GNOME Shell 46: https://gjs.guide/extensions/upgrading/gnome-shell-46.html
- GNOME JavaScript Guide, Preferences: https://gjs.guide/extensions/development/preferences.html
- GNOME JavaScript Guide, Subprocesses: https://gjs.guide/guides/gio/subprocesses.html
- GNOME JavaScript Guide, Popup Menu: https://gjs.guide/extensions/topics/popup-menu.html
- GNOME JavaScript Guide, St Widgets: https://gjs.guide/extensions/topics/st-widgets.html


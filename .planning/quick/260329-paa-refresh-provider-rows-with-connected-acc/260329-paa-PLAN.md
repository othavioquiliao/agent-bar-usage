# Quick Task 260329-paa Plan

## Goal

Refresh the GNOME provider rows so they show the current status header, connected account, usage with a progress bar, and token reset timing.

## Tasks

### 1. Extend the shared snapshot contract with connected account metadata

- Files: `packages/shared-contract/src/snapshot.ts`, backend provider helpers/adapters
- Action: add an optional `connected_account` field to `ProviderSnapshot`, update validation, and populate the field from provider-specific auth sources.
- Verify: rebuild `shared-contract` and run focused backend tests for Copilot, Claude, Codex, and snapshot cache compatibility.
- Done: provider snapshots can carry connected-account state without breaking cached snapshots that predate the field.

### 2. Feed connected account data from each provider path

- Files: Claude/Codex credential readers and adapters, Copilot usage fetcher
- Action: resolve a real account label when safely available, otherwise emit explicit `connected` or `missing` state and keep auth failures distinct from transient fetch failures.
- Verify: provider and credential-reader tests cover labeled, unlabeled, and missing-account scenarios.
- Done: backend responses consistently tell the UI whether an account is connected and, when possible, which one.

### 3. Rebuild the GNOME provider row layout

- Files: `apps/gnome-extension/utils/view-model.js`, `apps/gnome-extension/panel/provider-row-model.js`, `apps/gnome-extension/panel/provider-row.js`, `apps/gnome-extension/stylesheet.css`
- Action: replace the multiline plain-text row with a structured layout that keeps the existing header text, adds an account line, shows quota text plus a progress bar, and formats reset as relative plus absolute time.
- Verify: GNOME view-model and provider-row tests cover the new field order, fallbacks, and progress-bar visibility rules.
- Done: the dropdown row now matches the requested 4-info layout.

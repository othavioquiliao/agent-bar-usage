# Roadmap: Agent Bar Ubuntu

## Overview

The roadmap turns the existing `CodexBar` knowledge into a Linux-native Ubuntu product in five phases. The implementation stack is now fixed as a Node.js/TypeScript backend plus a GNOME Shell extension in GJS. The roadmap starts by stabilizing a backend contract, then adds Linux configuration and secrets, implements the first-wave providers, delivers the GNOME desktop surface, and finishes with diagnostics, installation, and operational hardening.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Backend Contract** - Define and implement the Linux-facing backend contract and refresh flow (completed 2026-03-25)
- [ ] **Phase 2: Linux Config & Secrets** - Persist backend settings and introduce Ubuntu-friendly secret handling
- [ ] **Phase 3: First-Wave Providers** - Deliver Copilot, Codex CLI, and Claude CLI adapters in the Node backend
- [ ] **Phase 4: Ubuntu Desktop Surface** - Expose provider state through a GNOME Shell extension in GJS
- [ ] **Phase 5: Delivery & Hardening** - Add diagnostics, installation guidance, packaging, and release-grade operational polish

## Phase Details

### Phase 1: Backend Contract
**Goal**: Deliver a Linux backend contract that produces stable provider snapshots and refresh metadata independent of any desktop shell
**Depends on**: Nothing (first phase)
**Requirements**: [BACK-01, BACK-02, BACK-03]
**Success Criteria** (what must be TRUE):
1. User can run the Ubuntu backend and receive structured JSON for enabled providers
2. User can refresh one provider or all providers without relying on any GNOME-specific code
3. Provider output clearly includes source mode, error state, and last refresh metadata
**Plans**: 3 plans

Plans:
- [x] 01-01: Scaffold the Node/TypeScript backend workspace and shared snapshot contract
- [x] 01-02: Implement the provider adapter runtime, refresh coordinator, and cache layer
- [x] 01-03: Implement CLI output modes, diagnostics, and backend contract tests

### Phase 2: Linux Config & Secrets
**Goal**: Introduce Ubuntu-native configuration and secret management for the Node backend without inheriting Apple-specific assumptions
**Depends on**: Phase 1
**Requirements**: [CONF-01, CONF-02, SECR-01]
**Success Criteria** (what must be TRUE):
1. User can enable or disable providers from a persistent Linux config file
2. User can change provider order and source-mode preferences and see them survive restarts
3. User credentials or session material are stored through a supported Linux secret strategy instead of plain-text defaults
**Plans**: 3 plans

Plans:
- [ ] 02-01: Design the backend config model and persistence format
- [ ] 02-02: Integrate libsecret or equivalent secret-store handling
- [ ] 02-03: Wire config and secret resolution into backend provider contexts

### Phase 3: First-Wave Providers
**Goal**: Ship the first Ubuntu-viable provider set in the Node backend with reliable fetch paths and clear failure behavior
**Depends on**: Phase 2
**Requirements**: [COP-01, CDX-01, CLD-01]
**Success Criteria** (what must be TRUE):
1. User can see Copilot usage on Ubuntu through the supported Linux auth/fetch path
2. User can see Codex usage on Ubuntu through a CLI-backed path
3. User can see Claude usage on Ubuntu through a CLI-backed path
4. Provider failures remain isolated so one broken provider does not collapse the full refresh cycle
**Plans**: 3 plans

Plans:
- [ ] 03-01: Implement Copilot Linux flow and snapshot mapping
- [ ] 03-02: Implement Codex CLI Linux flow and snapshot mapping
- [ ] 03-03: Implement Claude CLI Linux flow plus provider-level failure isolation

### Phase 4: Ubuntu Desktop Surface
**Goal**: Deliver the first Linux-native desktop surface as a GNOME Shell extension that makes the backend useful in daily Ubuntu workflows
**Depends on**: Phase 3
**Requirements**: [UI-01, UI-02, UI-03]
**Success Criteria** (what must be TRUE):
1. User can see provider state from a GNOME-friendly surface without opening a terminal
2. User can open a detail view that shows usage state, reset windows, and last-updated information
3. User can trigger a refresh from the UI and understand when a provider failed
**Plans**: 3 plans

Plans:
- [ ] 04-01: Scaffold the GNOME Shell extension for Ubuntu 24.04.4 LTS
- [ ] 04-02: Implement the backend-to-extension bridge and refresh polling model
- [ ] 04-03: Build the initial top-bar menu, detail view, and refresh interactions

### Phase 5: Delivery & Hardening
**Goal**: Make the Ubuntu v1 installable, diagnosable, and maintainable beyond a local prototype
**Depends on**: Phase 4
**Requirements**: [OPS-01, OPS-02, OPS-03]
**Success Criteria** (what must be TRUE):
1. User can inspect logs or diagnostics that explain provider failures and missing prerequisites
2. User can follow documented steps to install and launch the backend and desktop surface on Ubuntu
3. Developer can debug backend and UI separately without breaking the product contract
**Plans**: 3 plans

Plans:
- [ ] 05-01: Add operational diagnostics and failure-reporting surfaces
- [ ] 05-02: Write Ubuntu installation, setup, and troubleshooting docs for the Node backend and GNOME extension
- [ ] 05-03: Harden packaging, startup behavior, and end-to-end verification

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Backend Contract | 3/3 | Complete   | 2026-03-25 |
| 2. Linux Config & Secrets | 0/3 | Not started | - |
| 3. First-Wave Providers | 0/3 | Not started | - |
| 4. Ubuntu Desktop Surface | 0/3 | Not started | - |
| 5. Delivery & Hardening | 0/3 | Not started | - |

# Requirements: Agent Bar Ubuntu

**Defined:** 2026-03-25
**Core Value:** Ubuntu users can reliably see the current usage state of their AI providers from a Linux-native surface without depending on the macOS-specific CodexBar shell.

## v1 Requirements

### Backend Contract

- [x] **BACK-01**: User can run a Linux backend command and receive normalized JSON snapshots for enabled providers
- [x] **BACK-02**: User can refresh all enabled providers or one selected provider on demand
- [x] **BACK-03**: User can see provider-specific errors, source mode, and last refresh timestamp in backend output

### Configuration & Secrets

- [x] **CONF-01**: User can enable or disable providers from a Linux config file
- [x] **CONF-02**: User can persist provider order and source-mode preferences on Ubuntu
- [x] **SECR-01**: User can store and retrieve provider credentials or session material through a Linux-appropriate secret store

### Providers

- [ ] **COP-01**: User can view GitHub Copilot usage on Ubuntu through an API/device-flow-capable path
- [ ] **CDX-01**: User can view Codex usage on Ubuntu through a CLI-backed path
- [ ] **CLD-01**: User can view Claude usage on Ubuntu through a CLI-backed path

### Desktop Surface

- [ ] **UI-01**: User can see enabled provider status from a GNOME-friendly top-bar, tray, or equivalent Ubuntu-native surface
- [ ] **UI-02**: User can open a detailed menu showing provider usage state, reset windows, and last updated time
- [ ] **UI-03**: User can trigger manual refresh and understand refresh failures from the desktop surface

### Diagnostics & Delivery

- [ ] **OPS-01**: User can inspect logs or diagnostics that explain provider failures on Ubuntu
- [ ] **OPS-02**: User can install and launch the v1 stack on Ubuntu from documented steps
- [ ] **OPS-03**: User can run the backend and desktop surface independently for debugging and iteration

## v2 Requirements

### Additional Auth Paths

- **OAUTH-01**: User can view Codex usage on Ubuntu through an OAuth-backed path
- **OAUTH-02**: User can view Claude usage on Ubuntu through an OAuth-backed path

### Additional Providers & Surfaces

- **CURS-01**: User can view Cursor usage on Ubuntu through a stable Linux auth/session strategy
- **SURF-01**: User can use an additional Linux surface such as Waybar or AppIndicator without changing backend semantics

### Enhanced Product Depth

- **HIST-01**: User can review historical usage trends and pace from the Linux product

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full macOS UI parity with AppKit menu behaviors | The Ubuntu product is intentionally Linux-native, not a direct shell port |
| Browser-cookie parity for v1 | Linux browser/session handling is the least stable part of the portability story |
| Cursor in the first release | Higher implementation risk than Copilot, Codex CLI, and Claude CLI |
| Every provider already present in `CodexBar` | v1 should optimize for reliable value, not catalog breadth |
| WidgetKit/Sparkle-style feature parity | Apple-specific integrations do not move the Ubuntu core value |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BACK-01 | Phase 1 | Complete |
| BACK-02 | Phase 1 | Complete |
| BACK-03 | Phase 1 | Complete |
| CONF-01 | Phase 2 | Complete |
| CONF-02 | Phase 2 | Complete |
| SECR-01 | Phase 2 | Complete |
| COP-01 | Phase 3 | Pending |
| CDX-01 | Phase 3 | Pending |
| CLD-01 | Phase 3 | Pending |
| UI-01 | Phase 4 | Pending |
| UI-02 | Phase 4 | Pending |
| UI-03 | Phase 4 | Pending |
| OPS-01 | Phase 5 | Pending |
| OPS-02 | Phase 5 | Pending |
| OPS-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 after Phase 2 execution*

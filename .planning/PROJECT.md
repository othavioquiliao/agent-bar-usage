# Agent Bar Ubuntu

## What This Is

Agent Bar Ubuntu is a new Linux-native desktop product that surfaces AI provider usage for Ubuntu users in a way that feels similar in value to the provider visibility available around Claude, Codex, Copilot, and Cursor. It treats `CodexBar/` as a brownfield reference product and mirrors its provider-engine ideas, but the actual Ubuntu implementation will be rebuilt with a Node.js/TypeScript backend and a GNOME Shell extension in GJS instead of reusing Swift or porting the macOS app.

## Core Value

Ubuntu users can reliably see the current usage state of their AI providers from a Linux-native surface without depending on the macOS-specific CodexBar shell.

## Requirements

### Validated

- ✓ Multi-provider usage fetching already exists in the reference codebase through `CodexBarCore` descriptors and fetch plans — existing reference
- ✓ The current macOS shell is not directly portable and must be replaced with a Linux-native surface — existing
- ✓ The first-wave provider portability ranking is already understood: Copilot high confidence, Codex/Claude medium via CLI/OAuth, Cursor deferred — existing
- ✓ The chosen implementation stack is now fixed: Node.js/TypeScript backend plus GNOME Shell extension in GJS — decided

### Active

- [x] Build a Linux-native backend contract that can expose provider snapshots on Ubuntu — Validated in Phase 1: Backend Contract
- [x] Support first-wave providers for v1: Copilot, Codex via CLI, and Claude via CLI — Validated in Phase 3: First-Wave Providers
- [x] Provide Ubuntu-friendly configuration and secret handling instead of Apple-specific storage assumptions — Validated in Phase 2: Linux Config & Secrets
- [x] Deliver a first desktop surface for Ubuntu users through a GNOME Shell extension on Ubuntu 24.04.4 LTS — Validated in Phase 4: Ubuntu Desktop Surface
- [x] Ship enough diagnostics and packaging guidance that the Ubuntu version is debuggable and maintainable — Validated in Phase 5: Delivery & Hardening
- [x] Make all three providers work reliably from systemd service with node-pty PTY, GitHub Device Flow auth, and env capture — Validated in Phase 6: Provider Reliability

### Out of Scope

- Porting the AppKit/SwiftUI shell from `CodexBar` one-to-one — the existing shell is macOS-specific by design
- Full provider parity with the macOS app in v1 — browser-heavy and web-scraping parity would slow delivery without improving the core Linux value
- Cursor in the first release — Linux cookie/session handling is higher-risk and should be deferred
- Widget/update integrations equivalent to Sparkle or WidgetKit — not core to Ubuntu v1 and tightly coupled to Apple frameworks

## Context

The workspace already contains two strong inputs for this project. First, `CodexBar/` is a nested product repo with a proven provider model, fetch pipeline, CLI behavior, and Linux-oriented backend lessons. Second, `ubuntu-extension-analysis/` captures the architectural conclusion that the best Ubuntu approach is a CLI/backend-first design with a Linux-native shell on top.

This is therefore a brownfield initialization for a new product direction, not a greenfield invention. The existing codebase validates the provider abstraction and snapshot model, but the Ubuntu product will mirror those ideas in a new Node.js/TypeScript backend rather than reuse Swift modules directly. The desktop shell, updater, browser detection, and secret assumptions must be redesigned for Ubuntu. The most pragmatic v1 focuses on high-confidence providers and avoids browser-derived parity work until the Linux contract is stable.

## Constraints

- **Platform**: Ubuntu 24.04.4 LTS first, Linux-native shell — the product must feel native to Ubuntu instead of mimicking AppKit concepts
- **Backend stack**: Node.js + TypeScript — no Swift implementation in the Ubuntu product
- **Frontend stack**: GNOME Shell extension in GJS — no Electron or GTK app as the primary v1 surface
- **Architecture**: Reuse backend ideas from `CodexBar`, not Swift code directly — mirror the provider orchestration patterns in TypeScript
- **Scope**: v1 prioritizes Copilot, Codex CLI, and Claude CLI — these are the lowest-risk providers for Linux delivery
- **Secrets**: Apple Keychain assumptions are invalid — Linux secret storage must be intentional, likely via libsecret/GNOME Keyring
- **Portability**: Browser-cookie-dependent flows are secondary — Linux browser state is less uniform and more fragile
- **Maintainability**: The backend/frontend contract must stay independent from GNOME-extension specifics — this keeps other Linux surfaces viable later

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Treat `CodexBar/` as a reference backend, not the project shell | The reusable value is in `CodexBarCore` and `CodexBarCLI`, while the current shell is macOS-specific | ✓ Good |
| Rebuild the Ubuntu product without Swift | The user explicitly does not want Swift in the new implementation, and the reference repo is now conceptual input only | ✓ Good |
| Use Node.js/TypeScript for the backend | It offers the fastest path to provider adapters, CLI JSON contracts, and testable Linux automation | ✓ Good |
| Use a GNOME Shell extension in GJS for the primary UI | Ubuntu 24.04.4 LTS is GNOME-first, and the target surface is native top-bar integration | ✓ Good |
| Make Ubuntu a new root-level product direction | The workspace is already being used to analyze and plan the Linux version separately from the nested repo | — Pending |
| Target first-wave providers with transportable auth/data paths | Copilot, Codex CLI, and Claude CLI offer the highest confidence path to value on Linux | ✓ Good |
| Defer Cursor and browser-parity work | Cookie/session extraction is the highest-friction portability problem in the current analysis | ✓ Good |
| Use a Linux-native desktop surface instead of porting menu code | GNOME/AppIndicator/Waybar constraints differ enough that direct shell porting would be wrong | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-25 after selecting Node.js/TypeScript + GJS*

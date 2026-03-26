# Agent Bar Ubuntu

## What This Is

Agent Bar Ubuntu is now an archived `v1.0` Linux-native desktop product baseline that surfaces AI provider usage for Ubuntu users through a Node.js/TypeScript backend and a GNOME Shell extension in GJS. It still treats `CodexBar/` as a brownfield reference for provider-engine ideas, but the Ubuntu runtime, service, and shell integration are owned directly in this repo rather than ported from the macOS app.

## Core Value

Ubuntu users can reliably see the current usage state of their AI providers from a Linux-native surface without depending on the macOS-specific CodexBar shell.

## Current State

`v1.0` was archived on 2026-03-26 with the backend contract, Linux config and secrets, first-wave providers, and the first GNOME Shell surface in place. The archive intentionally preserves open delivery-hardening work instead of pretending it shipped complete.

Known carried-forward gaps:

- `OPS-01`: diagnostics and failure-reporting closure
- `OPS-02`: install and launch documentation closure
- `OPS-03`: backend-only and GNOME-only debug-loop closure

Real-world Ubuntu testing also showed that Copilot, Codex CLI, and Claude CLI are not yet reliable from the installed systemd-backed service path. That reliability work is now the immediate focus of Phase 6.

## Next Milestone Goals

- Make Copilot, Codex CLI, and Claude CLI reliable from the systemd service path
- Reduce installed-setup friction with better auth, environment capture, and doctor guidance
- Close the carried-forward `v1.0` delivery gaps without weakening the backend/extension contract

## Requirements

### Validated

- ✓ Multi-provider usage fetching already exists in the reference codebase through `CodexBarCore` descriptors and fetch plans — existing reference
- ✓ The current macOS shell is not directly portable and must be replaced with a Linux-native surface — existing
- ✓ The first-wave provider portability ranking is already understood: Copilot high confidence, Codex/Claude medium via CLI/OAuth, Cursor deferred — existing
- ✓ The chosen implementation stack is now fixed: Node.js/TypeScript backend plus GNOME Shell extension in GJS — decided
- ✓ Build a Linux-native backend contract that can expose provider snapshots on Ubuntu — v1.0
- ✓ Support first-wave providers for v1: Copilot, Codex via CLI, and Claude via CLI — v1.0
- ✓ Provide Ubuntu-friendly configuration and secret handling instead of Apple-specific storage assumptions — v1.0
- ✓ Deliver a first desktop surface for Ubuntu users through a GNOME Shell extension on Ubuntu 24.04.4 LTS — v1.0

### Active

- [ ] Close carried-forward `v1.0` gaps: `OPS-01`, `OPS-02`, and `OPS-03`
- [ ] Make all three providers work reliably from the installed systemd service path
- [ ] Add a lower-friction Copilot auth path for installed Ubuntu setups
- [ ] Capture enough user environment at install time to make provider CLIs and secrets usable from the service
- [ ] Define the post-reliability milestone requirements via `$gsd-new-milestone`

### Out of Scope

- Porting the AppKit/SwiftUI shell from `CodexBar` one-to-one — the existing shell is macOS-specific by design
- Full provider parity with the macOS app in v1 — browser-heavy and web-scraping parity would slow delivery without improving the core Linux value
- Cursor in the first release — Linux cookie/session handling is higher-risk and should be deferred
- Widget/update integrations equivalent to Sparkle or WidgetKit — not core to Ubuntu v1 and tightly coupled to Apple frameworks

## Context

The workspace contains two key inputs for this product direction. First, `CodexBar/` is a nested reference repo with a proven provider model, fetch pipeline, and CLI behavior. Second, `ubuntu-extension-analysis/` captured the decision that Ubuntu should be a CLI/backend-first design with a Linux-native shell on top.

That direction is now implemented as an archived `v1.0` baseline. Backend build/install flow, systemd runtime, and GNOME extension wiring all exist, but Phase 6 investigation showed three concrete production blockers: Codex and Claude still rely on a PTY strategy that fails under systemd, Copilot needs a first-class Linux auth flow, and the installed service needs better environment capture for PATH and secret-store access.

## Constraints

- **Platform**: Ubuntu 24.04.4 LTS first, Linux-native shell — the product must feel native to Ubuntu instead of mimicking AppKit concepts
- **Backend stack**: Node.js + TypeScript — no Swift implementation in the Ubuntu product
- **Frontend stack**: GNOME Shell extension in GJS — no Electron or GTK app as the primary v1 surface
- **Architecture**: Reuse backend ideas from `CodexBar`, not Swift code directly — mirror the provider orchestration patterns in TypeScript
- **Scope**: v1 prioritizes Copilot, Codex CLI, and Claude CLI — these are the lowest-risk providers for Linux delivery
- **Secrets**: Apple Keychain assumptions are invalid — Linux secret storage must be intentional, likely via libsecret/GNOME Keyring
- **Portability**: Browser-cookie-dependent flows are secondary — Linux browser state is less uniform and more fragile
- **Maintainability**: The backend/frontend contract must stay independent from GNOME-extension specifics — this keeps other Linux surfaces viable later
- **Installed runtime**: systemd user service is now part of the supported Ubuntu path, so provider flows must work without a controlling terminal
- **Native dependencies**: a backend native addon is acceptable when required to make CLI-backed providers reliable on Linux

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
| Archive `v1.0` with accepted gaps instead of holding the milestone open | The user explicitly preferred archival now, with Phase 5 debt and audit debt carried forward | ⚠ Revisit |
| Use `node-pty` for Codex and Claude service-mode reliability | The `script` wrapper fails without a controlling TTY under systemd | ✓ Good |
| Add a GitHub Device Flow auth command for Copilot | Installed Linux setups need a first-class token path instead of assuming env vars or external tooling | ✓ Good |

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
*Last updated: 2026-03-26 after archiving v1.0*

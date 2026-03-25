# Agent Bar Ubuntu

## What This Is

Agent Bar Ubuntu is a Linux-native desktop product that surfaces AI provider usage (Copilot, Codex, Claude) for Ubuntu users through a Node.js/TypeScript backend and a GNOME Shell extension in GJS. v1.0 ships a working end-to-end stack: backend service running under systemd, GNOME top-bar indicator, provider snapshot polling, and `agent-bar auth copilot` for zero-friction Copilot setup.

## Core Value

Ubuntu users can reliably see the current usage state of their AI providers from a Linux-native surface without depending on the macOS-specific CodexBar shell.

## Current State

**Shipped:** v1.0 Ubuntu v1 MVP (2026-03-25)

- Backend: Node.js/TypeScript, running as a systemd user service
- Providers: Copilot (GitHub API + Device Flow auth), Codex CLI, Claude CLI — all working from systemd via node-pty PTY
- Frontend: GNOME Shell extension (GJS), top-bar indicator, details view, manual refresh
- Config: XDG persistence + GNOME Keyring via `secret-tool`
- Auth: `agent-bar auth copilot` — GitHub Device Flow OAuth, token stored in Keyring
- Doctor: 8 prerequisite checks with actionable fix commands

**Known pre-release item:** `DEFAULT_CLIENT_ID` in `auth-command.ts` is a placeholder — requires a real GitHub OAuth App before public release.

## Requirements

### Validated

- ✓ Multi-provider usage fetching already exists in the reference codebase through `CodexBarCore` — existing reference
- ✓ The current macOS shell is not directly portable and must be replaced — existing
- ✓ The first-wave provider portability ranking is understood: Copilot high confidence, Codex/Claude via CLI — existing
- ✓ Implementation stack fixed: Node.js/TypeScript backend + GNOME Shell extension in GJS — decided
- ✓ Linux-native backend contract with provider snapshots and refresh metadata — v1.0 (Phase 1)
- ✓ Ubuntu-friendly config (XDG) and secret handling (secret-tool/Keyring) — v1.0 (Phase 2)
- ✓ First-wave providers: Copilot, Codex CLI, Claude CLI with isolation guarantees — v1.0 (Phase 3)
- ✓ GNOME Shell extension with top-bar surface, detail view, manual refresh — v1.0 (Phase 4)
- ✓ Diagnostics, install script, systemd service, independent debug paths — v1.0 (Phase 5)
- ✓ Provider reliability from systemd: node-pty PTY, Device Flow auth, env capture — v1.0 (Phase 6)

### Active (v1.1 candidates)

- [ ] Register a real GitHub OAuth App and replace `DEFAULT_CLIENT_ID` placeholder before public release
- [ ] Expand provider support: Cursor (Linux cookie/session strategy deferred from v1)
- [ ] Add additional Linux surfaces: Waybar or AppIndicator without changing backend semantics
- [ ] OAuth-backed paths for Codex and Claude (OAUTH-01, OAUTH-02)
- [ ] Historical usage trends (HIST-01)

### Out of Scope

| Feature | Reason |
|---------|--------|
| Full macOS UI parity with AppKit menu behaviors | Ubuntu product is intentionally Linux-native |
| Browser-cookie parity for v1 | Linux browser/session handling is unstable — deferred |
| Cursor in the first release | Higher implementation risk than Copilot, Codex CLI, Claude CLI |
| Every provider in `CodexBar` | v1 optimizes for reliable value, not catalog breadth |
| WidgetKit/Sparkle-style feature parity | Apple-specific — not relevant to Ubuntu |

## Context

**v1.0 shipped:** 6 phases, 14 plans, ~8.000 LOC TypeScript/JavaScript, 72 commits, 2026-03-25.

The product proved that the CLI-first backend architecture (Node.js + systemd) combined with a GNOME Shell extension in GJS is a viable Ubuntu-native stack. The `node-pty` approach for PTY allocation in headless systemd services is the key enabler for Codex and Claude CLI providers. The Device Flow OAuth pattern is the right path for Copilot — no browser cookie hacks needed.

Next milestone should focus on: registering a real OAuth App, production hardening, and potentially expanding provider or surface coverage.

## Constraints

- **Platform**: Ubuntu 24.04.4 LTS first, Linux-native shell
- **Backend stack**: Node.js + TypeScript
- **Frontend stack**: GNOME Shell extension in GJS
- **Architecture**: Provider contract stays independent from GNOME-extension specifics
- **Secrets**: Linux secret storage via libsecret/GNOME Keyring only
- **Portability**: Browser-cookie-dependent flows remain secondary

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Treat `CodexBar/` as a reference backend, not the shell | Reusable value is in the provider abstraction patterns, not the Swift code | ✓ Good |
| Rebuild the Ubuntu product without Swift | User requirement; Swift is macOS-specific in this stack | ✓ Good |
| Use Node.js/TypeScript for the backend | Fastest path to provider adapters, CLI JSON contracts, testable Linux automation | ✓ Good |
| Use a GNOME Shell extension in GJS | Ubuntu 24.04.4 LTS is GNOME-first; native top-bar integration is the target surface | ✓ Good |
| Target first-wave providers with transportable auth | Copilot, Codex CLI, Claude CLI offer highest confidence on Linux | ✓ Good |
| Defer Cursor and browser-parity | Cookie/session extraction is the highest-friction portability problem | ✓ Good — still valid |
| Use node-pty instead of `script -qec` for PTY allocation | `script` fails in systemd services (no controlling terminal); node-pty calls forkpty() directly | ✓ Good |
| GitHub Device Flow OAuth for Copilot | No browser cookie dependency; same flow as `gh auth login`; works from any environment | ✓ Good |
| Capture env vars in systemd override at install time | Service inherits user PATH, tokens, and DBUS_SESSION_BUS_ADDRESS without manual configuration | ✓ Good |
| Register real GitHub OAuth App before public release | Placeholder client_id is acceptable for development but required before shipping | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-25 after v1.0 milestone completion*

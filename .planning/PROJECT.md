# Agent Bar Ubuntu

## What This Is

Agent Bar Ubuntu is a Linux-native desktop product that surfaces AI provider usage (Copilot, Codex, Claude) for Ubuntu users through a Bun/TypeScript backend and a GNOME Shell extension in GJS. It now ships a modular provider architecture, restart-safe cached usage snapshots, interactive lifecycle/TUI commands, and a validated GitHub Device Flow path for Copilot setup.

## Core Value

Ubuntu users can reliably see the current usage state of their AI providers from a Linux-native surface without depending on the macOS-specific CodexBar shell.

## Current State

**Shipped:** v1.0 Ubuntu v1 MVP (2026-03-25), v1.1 Provider Reliability (2026-03-26), v2.0 Refactor & Polish (2026-03-29)

- Backend: Bun + TypeScript, running as a systemd user service with Bun-native subprocess and Unix socket IPC
- Providers: Copilot, Codex CLI, and Claude CLI exposed through a registry-driven provider contract with no cross-provider imports
- Data: restart-safe XDG cache, TTL/deduplicated snapshot persistence, service-owned auto-refresh, and locale-aware user-facing timestamps
- Frontend: GNOME Shell extension (GJS), top-bar indicator, details view, dynamic provider ordering, packaged provider assets
- CLI/TUI: manual command parsing, Biome baseline, interactive `setup/remove/update/uninstall`, provider selection, rich terminal quota cards, and TTY-aware doctor/menu/login flows
- Auth: `agent-bar auth copilot` and Provider Login TUI backed by a validated GitHub OAuth App client ID plus GNOME Keyring storage

## Next Milestone

Not defined yet. Start with `$gsd-new-milestone` when you want to choose the next scope.

**Reference codebase:** `/home/othavio/Work/agent-bar-omarchy/` — padrões a espelhar: cache com TTL, settings versionadas, @clack/prompts para TUI, Biome para lint, minimal deps

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
- ✓ GNOME extension UI redesign: packaged assets, compact rows, progress bars — v1.1 (Phase 7)
- ✓ Bun runtime migration, Bun-native PTY/subprocess work, and Unix socket IPC — v2.0 (Phase 8)
- ✓ TypeScript lifecycle commands for setup, remove, update, and uninstall — v2.0 (Phase 9)
- ✓ Manual CLI parsing plus Biome baseline and inline validation — v2.0 (Phase 10)
- ✓ Fully independent provider modules, provider selection CLI, file-backed cache, and locale-aware formatting — v2.0 (Phase 11)
- ✓ Interactive TUI menu, rich terminal quota display, TTY-aware doctor/login flows, and real GitHub OAuth App registration — v2.0 (Phase 12)

### Active

- [ ] Define the next milestone scope
- [ ] Decide whether the next priority is provider expansion, additional Linux surfaces, historical usage, or compiled distribution

### Out of Scope

| Feature | Reason |
|---------|--------|
| Full macOS UI parity with AppKit menu behaviors | Ubuntu product is intentionally Linux-native |
| Browser-cookie parity | Linux browser/session handling is unstable — deferred |
| Cursor provider | Higher implementation risk — defer until v2.0 providers are stable |
| Amp provider | Not in scope for this milestone — focus on refactoring existing 3 |
| Waybar surface | Keeping GNOME extension as sole surface for now |
| Historical usage trends | Defer to v2.1+ — focus on architecture and reliability first |
| OAuth-backed paths for Codex and Claude | Defer to v2.1+ — CLI paths work |

## Context

**v1.0 shipped:** 6 phases, 14 plans, ~8.000 LOC TypeScript/JavaScript, 72 commits, 2026-03-25.
**v1.1 shipped:** 2 phases, 5 plans — provider reliability + GNOME UI redesign, 2026-03-26.

The product proved that the CLI-first backend architecture (Node.js + systemd) combined with a GNOME Shell extension in GJS is a viable Ubuntu-native stack. The Device Flow OAuth pattern is the right path for Copilot — no browser cookie hacks needed.

**v2.0 outcome:** The codebase now follows the intended architecture much more closely: Bun runtime, registry-driven providers, file-backed cache, versioned settings, @clack/prompts terminal UX, and Biome as the quality baseline. The GNOME extension remained the unique Ubuntu-native surface while the backend contract became cleaner and more restart-safe.

**Development note:** Dev machine is NOT Ubuntu. Target platform is Ubuntu-only.

## Constraints

- **Platform**: Ubuntu 24.04.4 LTS first, Linux-native shell
- **Backend stack**: Bun + TypeScript (migrating from Node.js in v2.0)
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
| Use a fixed 3-provider mini-strip in the GNOME top bar for fast usage visibility | User preference favors at-a-glance percentages over an aggregated label; backend contract already exposes enough data | ✓ Good |
| Register real GitHub OAuth App before public release | Placeholder client_id is acceptable for development but required before shipping | ✓ Good |
| Migrate runtime from Node.js to Bun | Matches reference codebase patterns, faster runtime, fewer deps | ✓ Good |
| Remove Commander and Zod | Manual CLI parsing + inline validation, like agent-bar-omarchy | ✓ Good |
| TypeScript-based setup/remove/update commands | Bash installer is monolithic and untestable | ✓ Good |
| Centralize providers behind metadata-driven registry and config-backed selection | Reduces coupling and makes GNOME/CLI surfaces consume the same provider ordering truth | ✓ Good |
| Persist snapshots to XDG cache and hydrate service state on startup | Avoids cold-start empty data and makes refresh behavior restart-safe | ✓ Good |
| Use TTY-aware `@clack/prompts` flows for menu, doctor, and provider login | Gives CLI surfaces a higher-quality UX without regressing JSON/plain-text automation | ✓ Good |

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
*Last updated: 2026-03-29 after v2.0 milestone completion*

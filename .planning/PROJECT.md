# Agent Bar Ubuntu

## What This Is

Agent Bar Ubuntu is a Linux-native desktop product that surfaces AI provider usage (Copilot, Codex, Claude) for Ubuntu users through a Node.js/TypeScript backend and a GNOME Shell extension in GJS. v1.0 ships a working end-to-end stack: backend service running under systemd, GNOME top-bar indicator, provider snapshot polling, and `agent-bar auth copilot` for zero-friction Copilot setup.

## Core Value

Ubuntu users can reliably see the current usage state of their AI providers from a Linux-native surface without depending on the macOS-specific CodexBar shell.

## Current State

**Shipped:** v1.0 Ubuntu v1 MVP (2026-03-25), v1.1 Provider Reliability (2026-03-26)

- Backend: Node.js/TypeScript, running as a systemd user service
- Providers: Copilot (GitHub API + Device Flow auth), Codex CLI, Claude CLI — all working from systemd via node-pty PTY
- Frontend: GNOME Shell extension (GJS), top-bar indicator, details view, manual refresh
- Frontend polish: One Dark Pro-inspired top-bar refresh with a centered 3-provider mini-strip and provider-specific visual assets
- Config: XDG persistence + GNOME Keyring via `secret-tool`
- Auth: `agent-bar auth copilot` — GitHub Device Flow OAuth, token stored in Keyring
- Doctor: 8 prerequisite checks with actionable fix commands

**Known pre-release item:** `DEFAULT_CLIENT_ID` in `auth-command.ts` is a placeholder — requires a real GitHub OAuth App before public release.

## Current Milestone: v2.0 Refactor & Polish

**Goal:** Refatorar o Agent Bar Ubuntu para uma arquitetura modular e eficiente inspirada no agent-bar-omarchy, migrando para Bun, eliminando code slop, e entregando uma experiência de onboarding/update/CLI de qualidade.

**Target features:**
- Migração do runtime de Node.js para Bun
- Providers 100% independentes — sem acoplamento entre Copilot, Codex e Claude
- CLI para escolher quais providers exibir na topbar do GNOME
- Comandos `setup`, `remove` (mantém chaves), `update` (prioridade máxima)
- Auto-refresh periódico dos dados de uso
- Ícones existentes (SVG/PNG) integrados corretamente na extensão
- UI melhorada: formatação de datas, horas, porcentagens
- Remoção de Commander e Zod — CLI parsing manual, validação inline
- Setup/remove/update em TypeScript (não bash monolítico)
- Pesquisa de alternativas ao node-pty compatíveis com Bun
- Fix de bugs óbvios e limpeza geral do código

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

### Active (v2.0)

- [ ] Migrate runtime from Node.js to Bun
- [ ] Fully independent provider modules — zero coupling between Copilot, Codex, Claude
- [ ] CLI provider selection for GNOME topbar display
- [ ] TypeScript-based `setup` command (replaces bash installer)
- [ ] TypeScript-based `remove` command (removes code, preserves secrets/keys)
- [ ] TypeScript-based `update` command (reliable version updates — highest priority)
- [ ] Periodic auto-refresh of provider usage data
- [ ] Proper icon integration from existing SVG/PNG assets
- [ ] UI polish: date/time formatting, percentage display, data presentation
- [ ] Remove Commander dependency — manual CLI parsing
- [ ] Remove Zod dependency — inline validation
- [ ] Research and implement Bun-compatible PTY alternative (replacing node-pty)
- [ ] Fix obvious bugs and code quality issues throughout codebase
- [ ] Register a real GitHub OAuth App and replace `DEFAULT_CLIENT_ID` placeholder

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

**v2.0 direction:** The codebase has accumulated significant technical debt ("code slop"). The sibling project `agent-bar-omarchy` demonstrates a far cleaner architecture with the same goals: 2 production deps, Bun runtime, manual CLI parsing, file-based cache with TTL, versioned settings, @clack/prompts TUI, Biome linting. v2.0 will refactor agent-bar-usage to mirror these patterns while keeping its unique GNOME extension surface.

**Key technical consideration:** node-pty (native Node.js addon for PTY) may not be compatible with Bun. v2.0 must research Bun-native PTY alternatives or hybrid solutions for Codex/Claude CLI execution from systemd.

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
| Register real GitHub OAuth App before public release | Placeholder client_id is acceptable for development but required before shipping | — Pending |
| Migrate runtime from Node.js to Bun | Matches reference codebase patterns, faster runtime, fewer deps | — Pending |
| Remove Commander and Zod | Manual CLI parsing + inline validation, like agent-bar-omarchy | — Pending |
| TypeScript-based setup/remove/update commands | Bash installer is monolithic and untestable | — Pending |

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
*Last updated: 2026-03-28 after milestone v2.0 initialization*

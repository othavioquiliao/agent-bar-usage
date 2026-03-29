# Milestones

## v2.0 Refactor & Polish (Shipped: 2026-03-29)

**Phases completed:** 5 phases, 15 plans, 12 tasks

**Key accomplishments:**

- Migrar toda infraestrutura de runtime de Node.js para Bun: tsconfig bundler resolution, bun-types, bunfig.toml, scripts bun run, shebang bun, systemd sem NODE_ENV
- All subprocess APIs (child_process.spawn, node-pty) replaced with Bun.spawn across subprocess.ts, interactive-command.ts, and codex-appserver-fetcher.ts
- Service daemon and client IPC layer migrated from Node.js net module to Bun.listen/Bun.connect with same newline-delimited JSON protocol
- @clack/prompts dependency, XDG-aware install paths, dependency detection, and versioned settings with atomic writes and migration support
- Interactive @clack/prompts setup and update lifecycle commands replacing bash installer with dependency check, systemd service management, GNOME extension copy, and git-based update flow
- Remove and uninstall lifecycle commands with GNOME Keyring secret clearing, systemd cleanup, and Commander registration for all four lifecycle commands
- Zod was removed from shared-contract and backend config/runtime validation without changing the externally observable validation semantics.
- The backend CLI no longer depends on Commander; it dispatches manually, suggests near matches, and prints a structured help screen.
- Biome is now the active quality baseline, and the workspace manifests/lockfiles fully reflect the Commander and Zod removal.
- Phase 11 started by collapsing provider wiring to an explicit minimal contract and exposing provider order/visibility through a config-backed CLI flow.
- The backend now owns restart-safe cached provider data and periodic refresh behavior instead of treating snapshots as process-local state.
- Phase 11 closed with the user-visible integration work: timestamps are locale-aware, copilot uses packaged assets, and the GNOME topbar no longer reserves dead slots for disabled providers.
- Phase 12 started by turning the CLI into a real interactive entrypoint instead of a help-only shell.
- Plan 02 delivered the visual payoff of the new TUI by replacing plain quota text with provider cards, ANSI accents, and Unicode progress bars.
- Plan 03 finished the implementable Phase 12 work and closed the OAuth dependency by validating a registered GitHub OAuth App client ID against the live device-flow endpoint.

**Archive:** `.planning/milestones/v2.0-ROADMAP.md` · `.planning/milestones/v2.0-REQUIREMENTS.md` · `.planning/milestones/v2.0-MILESTONE-AUDIT.md` · `.planning/milestones/v2.0-phases/`

---

## v1.1 Provider Reliability (Shipped: 2026-03-26)

**Phases completed:** 2 phases, 5 plans

**Key accomplishments:**

- Replaced brittle `script -qec` execution with `node-pty`-backed provider reliability for headless systemd sessions.
- Added GitHub Device Flow auth, GNOME Keyring writes, and actionable doctor checks for Copilot provisioning.
- Redesigned the GNOME extension UI around compact rows, packaged provider assets, progress bars, and an aggregate-first indicator.

**Archive:** `.planning/milestones/v1.1-ROADMAP.md` · `.planning/milestones/v1.1-REQUIREMENTS.md` · `.planning/milestones/v1.1-phases/`

---

## v1.0 Ubuntu v1 MVP (Shipped: 2026-03-25)

**Phases completed:** 6 phases, 14 plans
**Code:** ~8.000 LOC TypeScript/JavaScript (75 arquivos)
**Commits:** 72
**Timeline:** 2026-03-25 (single-day execution)
**Requirements:** 15/15 v1 complete

**Key accomplishments:**

- Backend Contract: Node/TypeScript workspace with shared snapshot contract, provider runtime, refresh coordinator, and JSON/text CLI output
- Linux Config & Secrets: XDG config persistence, `secret-tool` primary + env fallback, wired into provider contexts
- First-Wave Providers: Copilot (GitHub API + token resolution), Codex CLI, and Claude CLI adapters with isolation — provider failure never collapses the full envelope
- Ubuntu Desktop Surface: GNOME Shell extension with top-bar indicator, backend bridge + polling, details view, manual refresh, and error visibility
- Delivery & Hardening: Doctor command, install script, systemd service, diagnostics CLI, independent backend/extension debug paths
- Provider Reliability: `node-pty` PTY infrastructure (replaces broken `script -qec` in systemd), GitHub Device Flow OAuth for Copilot, systemd env capture, actionable doctor checks

**Archive:** `.planning/milestones/v1.0-ROADMAP.md` · `.planning/milestones/v1.0-REQUIREMENTS.md` · `.planning/milestones/v1.0-phases/`

---

# Milestones

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

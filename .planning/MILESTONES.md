# Milestones

## v1.1 Provider Reliability (Shipped: 2026-03-26)

**Phases completed:** 2 phases, 5 plans, 14 tasks
**Archive:** [v1.1-ROADMAP.md](./milestones/v1.1-ROADMAP.md)

**Key accomplishments:**

- Shared node-pty execution for Codex and Claude CLI fetchers with structured PTY failure mapping and regression coverage
- GitHub device-flow Copilot auth, systemd env propagation, and actionable runtime diagnostics for Ubuntu installs
- Packaged GNOME Shell stylesheet, bundled Claude/Codex provider assets, and a two-mode Wave 0 verifier for installed extension payloads
- Compact GNOME indicator and provider-row view models with aggregate health copy, quota-first row fields, and targeted Vitest verification
- Structured GNOME provider rows with packaged icons, compact quota progress bars, terse details, and an approved aggregate-only panel indicator

**Archive notes:**

- No formal `v1.1` milestone audit was archived before completion.
- No milestone-scoped `REQUIREMENTS.md` source file existed at archive time; requirements were reconstructed into [v1.1-REQUIREMENTS.md](./milestones/v1.1-REQUIREMENTS.md).
- Human Ubuntu-host verification was explicitly waived by user approval from an Arch machine; follow-up evidence remains in `06-HUMAN-UAT.md`.

---

## v1.0 Agent Bar Ubuntu (Archived: 2026-03-26)

**Status:** Archived at user request with accepted gaps
**Scope:** 5 phases, 15 plans, 27 tasks
**Timeline:** 2026-03-25 -> 2026-03-26

**Key accomplishments:**

- Established the Node.js/TypeScript backend and shared snapshot contract for the Linux product baseline.
- Delivered refresh orchestration, cache behavior, and CLI JSON/text output over a normalized provider envelope.
- Added XDG-backed configuration and `secret-tool`-based secret resolution for Ubuntu-friendly persistence.
- Shipped the first provider set for Copilot, Codex CLI, and Claude CLI with isolated failure handling.
- Built the first GNOME Shell extension surface with provider details, refresh actions, and backend error visibility.
- Captured the next milestone around provider reliability after real systemd-service testing exposed PTY, token, and environment gaps.

**Known gaps accepted into the next milestone:**

- `OPS-01`: diagnostics and failure-reporting closure
- `OPS-02`: install and launch documentation closure
- `OPS-03`: backend-only and GNOME-only debug-loop closure
- No formal `v1.0` milestone audit was archived before completion

---

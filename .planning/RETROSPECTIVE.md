# Retrospective: Agent Bar Ubuntu

## Milestone: v1.0 — Ubuntu v1 MVP

**Shipped:** 2026-03-25
**Phases:** 6 | **Plans:** 14 | **Commits:** 72

### What Was Built

- Node.js/TypeScript backend with provider runtime, refresh coordinator, and JSON/text CLI
- XDG config persistence + GNOME Keyring secret storage via `secret-tool`
- Copilot (GitHub API), Codex CLI, and Claude CLI provider adapters with isolation
- GNOME Shell extension: top-bar indicator, backend bridge, polling, details view, manual refresh
- systemd service, install script, doctor command, prerequisite checks
- `node-pty` PTY infrastructure replacing broken `script -qec` in headless services
- `agent-bar auth copilot` via GitHub Device Flow OAuth with GNOME Keyring storage
- Systemd env override (`env.conf`) captured at install time

### What Worked

- **Backend-first architecture:** Building the provider contract independently of the GNOME surface was the right call — it made testing easier and kept the extension thin
- **Phase isolation:** Each phase had clear inputs/outputs — no cross-phase breakage despite fast execution
- **Provider isolation envelope:** The decision to make provider failures non-collapsing paid off immediately in Phase 6 debugging
- **gsd-tools plan fidelity:** Plans were detailed enough that executors didn't need to make major decisions — just execute
- **node-pty approach:** Straightforward fix once the root cause (no PTY in systemd) was understood; prebuilt binaries for Linux x64 meant no compilation issues in practice

### What Was Inefficient

- REQUIREMENTS.md not updated after Phase 5 execution — required manual fix at milestone completion
- STATE.md progress counters fell out of sync when phases were archived mid-session
- Phase 5 was marked complete in ROADMAP but had no SUMMARY files — tracking inconsistency needed investigation

### Patterns Established

- `script -qec` PTY allocation is unreliable in systemd; `node-pty` via `forkpty()` is the correct pattern for headless interactive CLIs
- GitHub Device Flow (RFC 8628) is the right auth pattern for desktop tools without a browser dependency
- Systemd drop-in overrides (`~/.config/systemd/user/<svc>.d/env.conf`) are the correct way to pass user env to services
- Doctor commands should always emit fix commands, not diagnostic commands

### Key Lessons

- Plan phases 5 and 6 together when "hardening" and "reliability" are logically adjacent — they share deployment concerns
- Keep REQUIREMENTS.md updated at phase boundaries, not only at milestone completion
- Register OAuth App IDs early in the process; a placeholder works for dev but blocks release readiness

### Cost Observations

- Model: Sonnet 4.6 throughout
- Sessions: 1 continuous session for the full milestone
- Notable: All 6 phases in a single day — wave-based parallel execution in phases 3–6 enabled rapid delivery

---

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases | 6 |
| Plans | 14 |
| LOC (TS/JS) | ~8.000 |
| Commits | 72 |
| Duration | 1 day |
| Test coverage | 44 tests, 13 files |

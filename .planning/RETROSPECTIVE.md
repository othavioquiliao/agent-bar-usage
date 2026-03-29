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

## Milestone: v2.0 — Refactor & Polish

**Shipped:** 2026-03-29
**Phases:** 5 | **Plans:** 15 | **Commits:** not normalized

### What Was Built

- Bun runtime migration for backend execution, subprocesses, PTY flows, and Unix socket IPC
- TypeScript lifecycle commands for setup, remove, update, and uninstall
- Manual CLI routing, Biome-based quality baseline, and inline runtime validation
- Independent provider registry, config-backed provider selection, file-backed cache, and service hydration/auto-refresh
- Interactive terminal menu, provider login guidance, rich quota cards, and TTY-aware doctor presenter
- Registered GitHub OAuth App client ID validated against the live device-flow endpoint

### What Worked

- **Reference-driven refactor:** mirroring the `agent-bar-omarchy` architectural patterns kept the milestone focused and reduced design churn
- **Phase sequencing:** runtime -> lifecycle -> CLI -> providers -> TUI was the right dependency chain, and each phase unlocked the next cleanly
- **Verification discipline:** broad regression runs after Phase 11 and Phase 12 caught integration regressions before they compounded
- **Explicit blocker handling:** recording the OAuth placeholder as a real requirement blocker prevented fake completion and made the closeout honest

### What Was Inefficient

- Milestone closeout lagged behind implementation; summaries, verification, and state docs had to be reconciled after the code was already done
- The completion tool archived snapshots but still required manual curation of `ROADMAP.md`, `PROJECT.md`, and next-step state
- Dirty worktree context made commit/tag automation unsafe to run blindly

### Patterns Established

- File-backed cache plus startup hydration is the right reliability pattern for local CLI + daemon products
- Provider-independent contracts and config-backed ordering let the CLI and GNOME surfaces evolve without cross-provider edits
- TTY-aware presentation layers should preserve plain-text/JSON fallbacks instead of replacing them

### Key Lessons

- Treat external credentials like OAuth App registration as first-class release requirements, not postscript chores
- Close `.planning/` artifacts immediately after execution while context is still fresh
- Keep milestone completion tooling narrow; AI review is still needed for product-level documents

### Cost Observations

- Sessions: multiple focused sessions across 2026-03-28 and 2026-03-29
- Notable: the largest risk was not implementation complexity but keeping milestone-state documents synchronized with executed work

---

## Cross-Milestone Trends

| Metric | v1.0 | v2.0 |
|--------|------|------|
| Phases | 6 | 5 |
| Plans | 14 | 15 |
| LOC (TS/JS) | ~8.000 | n/a |
| Commits | 72 | n/a |
| Duration | 1 day | 2 days |
| Test coverage | 44 tests, 13 files | 138 backend tests + GNOME extension suite |

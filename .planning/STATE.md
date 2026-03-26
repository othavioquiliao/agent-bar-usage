---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Provider Reliability
status: Ready to execute
stopped_at: Completed 07-01-PLAN.md
last_updated: "2026-03-26T16:17:36.292Z"
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 5
  completed_plans: 2
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-26)

**Core value:** Ubuntu users can reliably see the current usage state of their AI providers from a Linux-native surface without depending on the macOS-specific CodexBar shell.
**Current focus:** Phase 07 — redesign-gnome-extension-ui-for-glanceability-qbar-provider-icons-and-compact-progress-bars

## Current Position

Phase: 07 (redesign-gnome-extension-ui-for-glanceability-qbar-provider-icons-and-compact-progress-bars) — EXECUTING
Plan: 3 of 3

## Performance Metrics

**Velocity:**

- Total plans completed: 12
- Archived milestone: v1.0 (12/15 plans closed, 3 accepted gaps)
- Average duration: 24 min
- Total execution time: 4.8 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Backend Contract | 3 | 94 min | 31 min |
| 2. Linux Config & Secrets | 3 | 114 min | 38 min |
| 3. First-Wave Providers | 3 | 39 min | 13 min |
| 4. Ubuntu Desktop Surface | 3 | 43 min | 14 min |

**Recent Trend:**

- Last 5 plans: 5/5 complete
- Trend: Improving

| Phase 07 P01 | 4 | 3 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Treat `CodexBar/` as a reference backend, not the Ubuntu shell
- [Stack]: Rebuild the Ubuntu product without Swift
- [Stack]: Use Node.js/TypeScript for the backend
- [Stack]: Use a GNOME Shell extension in GJS for the frontend
- [Init]: Prioritize Copilot, Codex CLI, and Claude CLI for v1
- [Init]: Defer Cursor and browser-parity work until after the Linux contract is stable
- [Phase 2]: Use XDG config persistence with JSON for v1
- [Phase 2]: Use `secret-tool` as the primary persistent Linux secret-store boundary
- [Phase 2]: Keep env-based secret resolution as explicit fallback for development and CI
- [Phase 2]: Runtime provider selection now honors config order/enablement by default
- [Phase 2]: Secret resolution happens before adapter execution with provider-level error isolation
- [Phase 3]: Copilot path is an API-token adapter with env-first token resolution
- [Phase 3]: Codex and Claude paths are CLI-backed adapters with structured failure mapping
- [Phase 3]: Provider isolation behavior is explicitly validated and kept envelope-safe
- [Phase 4]: Manual refresh is gated while a refresh is in flight so repeated clicks do not overlap backend requests.
- [Phase 4]: The GNOME surface consumes normalized snapshot view models instead of reaching into subprocess or backend concerns.
- [Milestone]: `v1.0` was archived with accepted `OPS-01`/`OPS-02`/`OPS-03` gaps at user request
- [Phase 6]: Replace the `script` PTY wrapper with `node-pty` for service-mode Codex and Claude usage
- [Phase 6]: Add GitHub Device Flow auth plus environment capture for Copilot and installed systemd setups
- [Phase 07]: Package Phase 7 stylesheet and provider icons inside the GNOME extension instead of resolving qbar assets from the repo at runtime
- [Phase 07]: Split Wave 0 verification into source-only and post-install modes so packaging checks do not require GNOME host binaries before install

### Roadmap Evolution

- Phase 7 added: Redesign GNOME extension UI for glanceability, qbar provider icons, and compact progress bars

### Pending Todos

None yet.

### Blockers/Concerns

- Copilot, Codex CLI, and Claude CLI are not yet reliable from the installed systemd service path
- Provider token/session prerequisites may vary per machine and must map to structured provider-level failures
- Browser-cookie-based parity work remains intentionally deferred

## Session Continuity

Last session: 2026-03-26T16:17:06.507Z
Stopped at: Completed 07-01-PLAN.md
Resume file: None

---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Provider Reliability
status: Milestone archived — ready to define next milestone
stopped_at: Archived milestone v1.1
last_updated: "2026-03-26T17:14:54.000Z"
progress:
  total_phases: 2
  completed_phases: 2
  total_plans: 5
  completed_plans: 5
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-26)

**Core value:** Ubuntu users can reliably see the current usage state of their AI providers from a Linux-native surface without depending on the macOS-specific CodexBar shell.
**Current focus:** Planning next milestone

## Current Position

Phase: None active
Plan: Milestone archived

## Performance Metrics

**Velocity:**

- Total plans completed: 17
- Archived milestones: v1.0 and v1.1
- Average duration: 23 min
- Total execution time: 4.9 hours

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
| Phase 07 P02 | 2 min | 2 tasks | 4 files |
| Phase 07 P03 | 10 min | 3 tasks | 7 files |
| Phase 06 P01 | 6 min | 3 tasks | 8 files |
| Phase 06 P02 | 2 min | 3 tasks | 10 files |

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
- [Phase 07]: Keep the normalized snapshot seam intact while adding the Phase 7 compact row and indicator fields.
- [Phase 07]: Preserve legacy row aliases during the contract transition so Phase 7 rendering can migrate incrementally.
- [Phase 07]: Keep each provider row to identity, status, quota/progress, and one short secondary line while moving actionable command text to Details.
- [Phase 07]: Keep the panel indicator aggregate-only with one icon and one short label instead of adding per-provider strips.
- [Phase 07]: Treat the resumed human checkpoint response approved as the required live GNOME Shell sign-off for Task 3.
- [Phase 06]: Use node-pty as the single PTY execution path for service-mode Codex and Claude fetchers.
- [Phase 06]: Keep the shared PTY runner aligned with SubprocessError semantics so existing provider error mapping continues to work.
- [Phase 06]: Copilot auth resolves its GitHub OAuth client id from --client-id or AGENT_BAR_GITHUB_CLIENT_ID so the flow is testable before a production app id is registered.
- [Phase 06]: Doctor treats node-pty and the systemd env drop-in as first-class runtime prerequisites and suggests direct fix commands instead of verification commands.

### Roadmap Evolution

- Phase 7 added: Redesign GNOME extension UI for glanceability, qbar provider icons, and compact progress bars

### Pending Todos

None yet.

### Blockers/Concerns

- Live service verification still depends on local provider configuration and tokens being present on each machine
- Provider token/session prerequisites may vary per machine and must map to structured provider-level failures
- Browser-cookie-based parity work remains intentionally deferred
- Next milestone scope and requirements have not been defined yet

## Session Continuity

Last session: 2026-03-26T17:14:54.000Z
Stopped at: Archived milestone v1.1
Resume file: None

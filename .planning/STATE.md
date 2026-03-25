---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Milestone complete
stopped_at: Completed 06-02-PLAN.md (auth command + install env + doctor)
last_updated: "2026-03-25T22:44:59.874Z"
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-25)

**Core value:** Ubuntu users can reliably see the current usage state of their AI providers from a Linux-native surface without depending on the macOS-specific CodexBar shell.
**Current focus:** Phase 06 — provider-reliability

## Current Position

Phase: 06
Plan: Not started

## Performance Metrics

**Velocity:**

- Total plans completed: 12
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

| Phase 06-provider-reliability P01 | 10 | 5 tasks | 8 files |
| Phase 06 P02 | 3 | 9 tasks | 9 files |

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
- [Phase 06-provider-reliability]: node-pty replaces script -qec: creates real kernel PTY via forkpty(), works from systemd with no controlling terminal
- [Phase 06-provider-reliability]: PtyUnavailableError is non-retryable: surfaces clear build instructions when native addon compilation fails
- [Phase 06-provider-reliability]: GitHub Device Flow: same flow as gh auth login — user gets a code, opens browser, authorizes, done
- [Phase 06-provider-reliability]: systemd-env check is warn (not error): service can still work via env var fallbacks
- [Phase 06-provider-reliability]: storeSecretViaSecretTool separate from SecretToolStore: write surface isolated from read path

### Pending Todos

None yet.

### Blockers/Concerns

- Provider token/session prerequisites may vary per machine and must map to structured provider-level failures
- Browser-cookie-based parity work remains intentionally deferred

## Session Continuity

Last session: 2026-03-25T22:41:12.579Z
Stopped at: Completed 06-02-PLAN.md (auth command + install env + doctor)
Resume file: None

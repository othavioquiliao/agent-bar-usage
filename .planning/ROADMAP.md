# Roadmap: Agent Bar Ubuntu

## Overview

Agent Bar Ubuntu now has an archived `v1.0` baseline and one planned follow-up milestone focused on making the installed runtime reliable for daily Ubuntu use.

## Milestones

- ✅ **v1.0 Agent Bar Ubuntu** — [archive](./milestones/v1.0-ROADMAP.md) (archived 2026-03-26; 5 phases, 15 plans; accepted gaps: `OPS-01`, `OPS-02`, `OPS-03`)
- 🚧 **v1.1 Provider Reliability** — Phase 6 (planned)

## Active Phases

- [ ] **Phase 6: Provider Reliability** - Make all 3 providers work reliably from systemd service with minimal user friction (planned 2026-03-26)

### Phase 6: Provider Reliability
**Goal**: Make all three providers work reliably for any user with minimal friction, both from the CLI and from the systemd background service
**Depends on**: v1.0 archived baseline
**Requirements**: Fresh milestone requirements not yet defined; carries forward `OPS-01`, `OPS-02`, and `OPS-03`
**Plans**: 2 plans

Plans:
- [ ] 06-01: Replace the `script` PTY wrapper with `node-pty` for Codex and Claude service-mode usage
- [ ] 06-02: Add Copilot auth flow, service environment capture, and actionable doctor guidance

## Progress

| Scope | Plans Complete | Status | Updated |
|-------|----------------|--------|---------|
| v1.0 Agent Bar Ubuntu | 12/15 archived | Archived with accepted gaps | 2026-03-26 |
| 6. Provider Reliability | 0/2 | Planned | 2026-03-26 |

---
phase: 5
slug: delivery-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `vitest` for backend and pure GNOME modules + manual Ubuntu service/extension smoke checks |
| **Config file** | `apps/backend/vitest.config.ts`, `apps/gnome-extension/vitest.config.ts` |
| **Quick run command** | `pnpm --filter backend test` or `pnpm --filter gnome-extension test` depending on the task scope |
| **Full suite command** | `pnpm --filter backend test && pnpm --filter gnome-extension test` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the narrowest relevant workspace suite for the files touched
- **After every plan wave:** Run `pnpm --filter backend test && pnpm --filter gnome-extension test`
- **Before `$gsd-verify-work`:** Both suites must be green and one documented install/service smoke pass must be completed
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | OPS-01 | unit/CLI smoke | `pnpm --filter backend test` | ✅ partial | ⬜ pending |
| 5-01-02 | 01 | 1 | OPS-01 | unit/view-model | `pnpm --filter gnome-extension test` | ✅ partial | ⬜ pending |
| 5-02-01 | 02 | 2 | OPS-02 | install/smoke | `./scripts/install-ubuntu.sh --verify` | ❌ W0 | ⬜ pending |
| 5-02-02 | 02 | 2 | OPS-02 | docs/command smoke | `test -f docs/ubuntu-install.md && test -f docs/ubuntu-troubleshooting.md` | ❌ W0 | ⬜ pending |
| 5-03-01 | 03 | 2 | OPS-03 | service/integration | `systemctl --user status agent-bar.service` | ❌ W0 | ⬜ pending |
| 5-03-02 | 03 | 2 | OPS-03 | unit/smoke | `pnpm --filter backend test && pnpm --filter gnome-extension test` | ✅ partial | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/backend/test/` coverage for diagnostics commands, service client behavior, and prerequisite classification
- [ ] `apps/gnome-extension/test/` coverage for prerequisite/failure rendering beyond the current generic backend error footer
- [ ] `scripts/install-ubuntu.sh` or equivalent verification harness for the supported setup flow
- [ ] Manual verification checklist for service startup, journald inspection, and GNOME extension reload/debug flow

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The supported install flow produces a working backend service and enabled extension on Ubuntu | OPS-02 | requires a real Ubuntu desktop/session environment | Run the documented installer on a clean Ubuntu setup, complete any prerequisite prompts, then confirm backend service status is healthy and the GNOME indicator appears |
| GNOME diagnostics clearly distinguish missing prerequisites from generic backend failures | OPS-01 | requires visual and wording judgment in the shell UI | Trigger one missing-prerequisite condition and one runtime failure, open the menu, and confirm the details surface explains what is missing and what command to run next |
| Backend and GNOME surface can be debugged independently without contract drift | OPS-03 | requires interactive service + shell iteration | Validate backend JSON/text commands without the extension running, then reload/disable/enable the extension while the service remains healthy and confirm the UI still consumes the same snapshot contract |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

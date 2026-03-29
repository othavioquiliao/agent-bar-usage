---
phase: 8
slug: bun-runtime-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) / bun:test (target) |
| **Config file** | apps/backend/vitest.config.ts |
| **Quick run command** | `bun test` |
| **Full suite command** | `bun test --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test`
- **After every plan wave:** Run `bun test --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | RUNTIME-01 | integration | `bun run apps/backend/src/cli.ts usage --json` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | RUNTIME-04 | integration | `bun run apps/backend/src/cli.ts --help` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 1 | RUNTIME-02 | unit | `bun test interactive-command` | ✅ | ⬜ pending |
| 08-02-02 | 02 | 1 | RUNTIME-03 | unit | `bun test service-runtime` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Verify `bun test` runs existing test suite without errors
- [ ] Confirm node-pty tests can be adapted to Bun.Terminal
- [ ] Confirm service socket tests can be adapted to Bun.listen

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| systemd service starts with Bun | RUNTIME-01 | Requires Ubuntu + systemd | Start service, verify `systemctl --user status agent-bar` shows active |
| GNOME extension reads from Bun backend | RUNTIME-03 | Requires GNOME Shell | Open extension menu, verify provider data appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

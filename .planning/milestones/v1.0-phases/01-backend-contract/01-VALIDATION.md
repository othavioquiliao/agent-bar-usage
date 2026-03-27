---
phase: 1
slug: backend-contract
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `apps/backend/vitest.config.ts` |
| **Quick run command** | `pnpm --filter backend test -- contract cache-refresh` |
| **Full suite command** | `pnpm --filter backend test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter backend test -- contract cache-refresh`
- **After every plan wave:** Run `pnpm --filter backend test`
- **Before `$gsd-verify-work`:** Full backend test suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | BACK-01 | unit/integration | `pnpm --filter backend test -- contract` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | BACK-02 | integration | `pnpm --filter backend test -- cache-refresh` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 2 | BACK-03 | unit/integration | `pnpm --filter backend test -- output-parity snapshot-mapping` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/backend/test/contract.test.ts` — contract shape and request parsing coverage for `BACK-01`
- [ ] `apps/backend/test/cache-refresh.test.ts` — TTL and forced refresh coverage for `BACK-02`
- [ ] `apps/backend/test/output-parity.test.ts` — JSON/text parity coverage for `BACK-03`
- [ ] `apps/backend/test/snapshot-mapping.test.ts` — normalized snapshot mapping coverage

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Human-readable output is understandable and aligned with JSON | BACK-03 | Readability judgment is still partly human | Run `agent-bar usage --provider codex` and `agent-bar usage --provider codex --json` against synthetic or stubbed data and compare the same status/source/error story |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 2
slug: linux-config-secrets
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `apps/backend/vitest.config.ts` |
| **Quick run command** | `pnpm --filter backend test -- config-loader secret-store provider-context` |
| **Full suite command** | `pnpm --filter backend test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter backend test -- config-loader secret-store`
- **After every plan wave:** Run `pnpm --filter backend test`
- **Before `$gsd-verify-work`:** Full backend test suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | CONF-01 | unit/integration | `pnpm --filter backend test -- config-loader` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 1 | SECR-01 | unit/integration | `pnpm --filter backend test -- secret-store` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 2 | CONF-02 | integration | `pnpm --filter backend test -- provider-context` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/backend/test/config-loader.test.ts` — XDG path resolution, JSON parsing, and provider config validation coverage for `CONF-01`
- [ ] `apps/backend/test/secret-store.test.ts` — `secret-tool` bridge plus env fallback behavior for `SECR-01`
- [ ] `apps/backend/test/provider-context.test.ts` — precedence/order/source-mode/secret injection coverage for `CONF-02`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `config dump` output is readable and exposes the effective order/settings without leaking secret values | CONF-01, CONF-02 | Human-readable UX judgment | Run `agent-bar config dump` against a sample config and confirm that enabled state, source mode, and provider order are clear while raw secret values stay hidden |
| Missing secret-store access degrades predictably | SECR-01 | Desktop keyring availability is environment-dependent | Simulate a missing `secret-tool` or missing keyring and verify provider-level errors stay isolated |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 3
slug: first-wave-providers
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `apps/backend/vitest.config.ts` |
| **Quick run command** | `pnpm --filter backend test -- copilot-provider codex-provider claude-provider provider-isolation` |
| **Full suite command** | `pnpm --filter backend test` |
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run provider-targeted tests for the touched adapter
- **After every plan wave:** Run `pnpm --filter backend test`
- **Before `$gsd-verify-work`:** Full backend suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | COP-01 | unit/integration | `pnpm --filter backend test -- copilot-provider` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 1 | CDX-01 | unit/integration | `pnpm --filter backend test -- codex-provider` | ❌ W0 | ⬜ pending |
| 3-03-01 | 03 | 2 | CLD-01 | unit/integration | `pnpm --filter backend test -- claude-provider` | ❌ W0 | ⬜ pending |
| 3-03-02 | 03 | 2 | CLD-01 | integration | `pnpm --filter backend test -- provider-isolation` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/backend/test/copilot-provider.test.ts` — API token flow and snapshot mapping coverage for `COP-01`
- [ ] `apps/backend/test/codex-provider.test.ts` — CLI parse/failure mapping coverage for `CDX-01`
- [ ] `apps/backend/test/claude-provider.test.ts` — CLI parse/failure mapping coverage for `CLD-01`
- [ ] `apps/backend/test/provider-isolation.test.ts` — one-provider-failure isolation coverage

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Provider output is understandable in human text mode | COP-01, CDX-01, CLD-01 | readability judgment | Run `agent-bar usage --provider <id>` for each provider and confirm status/source/error fields are coherent |
| Missing local CLI dependency messaging is actionable | CDX-01, CLD-01 | depends on local CLI install state | Simulate missing `codex` or `claude` binary and confirm provider-level structured errors are clear |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

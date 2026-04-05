---
phase: 13
slug: critical-security-stability-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 + bun:test (dual) |
| **Config file** | `apps/backend/vitest.config.ts` |
| **Quick run command** | `cd apps/backend && bun run vitest run --config vitest.config.ts` |
| **Full suite command** | `cd apps/backend && bun run vitest run --config vitest.config.ts && bun test test/service-runtime.test.ts test/settings.test.ts` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/backend && bun run vitest run --config vitest.config.ts`
- **After every plan wave:** Run `cd apps/backend && bun run vitest run --config vitest.config.ts && bun test test/service-runtime.test.ts test/settings.test.ts`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | SEC-01 | T-13-01 | `Bun.spawn` array form prevents shell injection | unit | `bun run vitest run test/commands/auth-command.test.ts -x` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | STAB-02 | T-13-03 | Atomic write survives crash mid-write | unit | `bun run vitest run test/atomic-write.test.ts -x` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 1 | SEC-02 | T-13-02 | `.catch` handlers log errors to stderr | unit | `bun test test/service-runtime.test.ts` | ❌ W0 | ⬜ pending |
| 13-02-02 | 02 | 1 | STAB-03 | — | Global handlers log + exit on fatal | unit | `bun test test/service-runtime.test.ts` | ❌ W0 | ⬜ pending |
| 13-02-03 | 02 | 1 | STAB-05 | T-13-04 | Per-provider timeout via Promise.race | unit | `bun run vitest run test/coordinator-timeout.test.ts -x` | ❌ W0 | ⬜ pending |
| 13-02-04 | 02 | 1 | STAB-06 | — | Codex appserver timeout = 15s | unit | `bun run vitest run test/providers/codex/codex-appserver-fetcher.test.ts -x` | ✅ | ⬜ pending |
| 13-03-01 | 03 | 2 | STAB-01 | — | `destroy()` called on removed actors | manual-only | N/A — requires GNOME Shell session | ❌ manual | ⬜ pending |
| 13-03-02 | 03 | 2 | STAB-04 | T-13-04 | Backend-client 15s timeout + force_exit | manual-only | N/A — requires GJS runtime | ❌ manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/backend/test/atomic-write.test.ts` — stubs for STAB-02 (write, rename, cleanup on error)
- [ ] Expand `test/service-runtime.test.ts` — covers STAB-03 (global handlers log + exit)
- [ ] Expand `test/commands/auth-command.test.ts` — covers SEC-01 (verify openBrowser uses Bun.spawn not exec)
- [ ] New `test/coordinator-timeout.test.ts` — covers STAB-05 (provider timeout via Promise.race)

*Existing infrastructure covers STAB-06 (codex-appserver-fetcher.test.ts exists).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `_render()` calls `destroy()` on removed actors | STAB-01 | Requires live GNOME Shell session with Clutter | 1. Load extension 2. Open Looking Glass (`lg`) 3. Check actor count before/after 10 re-renders 4. Count must not grow |
| Backend-client timeout kills subprocess | STAB-04 | Requires GJS runtime with GLib event loop | 1. Mock slow backend (sleep 30) 2. Start extension 3. Verify subprocess killed after 15s 4. Verify error shown in indicator |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

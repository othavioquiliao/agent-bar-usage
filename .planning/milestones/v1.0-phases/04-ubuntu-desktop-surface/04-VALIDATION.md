---
phase: 4
slug: ubuntu-desktop-surface
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `vitest` for pure extension modules + manual GNOME Shell smoke checks |
| **Config file** | `apps/backend/vitest.config.ts` exists; `apps/gnome-extension` test config is a Wave 0 deliverable |
| **Quick run command** | `pnpm --filter backend test -- output-parity contract && pnpm --filter gnome-extension test` |
| **Full suite command** | `pnpm --filter backend test && pnpm --filter gnome-extension test` |
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run the narrowest relevant backend/extension verify command
- **After every plan wave:** Run `pnpm --filter backend test && pnpm --filter gnome-extension test`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | UI-01 | structure/smoke | `test -f apps/gnome-extension/metadata.json && test -f apps/gnome-extension/extension.js` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 1 | UI-01 | unit | `pnpm --filter gnome-extension test` | ❌ W0 | ⬜ pending |
| 4-02-01 | 02 | 1 | UI-03 | unit/integration | `pnpm --filter gnome-extension test -- backend-client polling-service` | ❌ W0 | ⬜ pending |
| 4-03-01 | 03 | 2 | UI-01 | unit/smoke | `pnpm --filter gnome-extension test -- indicator menu-builder` | ❌ W0 | ⬜ pending |
| 4-03-02 | 03 | 2 | UI-02 | manual/integration | `pnpm --filter backend exec node --import tsx src/cli.ts usage --json` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/gnome-extension/package.json` — scripts for extension verification
- [ ] `apps/gnome-extension/vitest.config.ts` or equivalent test entry — pure-module extension tests
- [ ] `apps/gnome-extension/test/` — initial pure-module coverage for state/backend bridge helpers
- [ ] `apps/gnome-extension/metadata.json` and `apps/gnome-extension/extension.js` — baseline shell artifacts

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Panel indicator appears in GNOME top bar and cleans up on disable | UI-01 | requires a real GNOME Shell session | Install the unpacked extension locally, enable it, confirm the indicator appears once, then disable it and confirm cleanup |
| Provider detail rows are readable and reflect backend status/error state | UI-02 | visual/readability judgment | Open the panel menu with mixed provider states and confirm usage, reset, updated-at, and error text are understandable |
| Manual refresh is understandable to the user when the backend fails | UI-03 | requires interactive shell behavior | Trigger refresh with a failing backend path or missing provider prerequisites and confirm the menu reflects failure without freezing |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending


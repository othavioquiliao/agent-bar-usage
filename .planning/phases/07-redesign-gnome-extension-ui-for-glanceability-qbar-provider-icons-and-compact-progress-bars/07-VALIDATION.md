---
phase: 7
slug: redesign-gnome-extension-ui-for-glanceability-qbar-provider-icons-and-compact-progress-bars
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-26
---

# Phase 7 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 |
| **Config file** | `apps/gnome-extension/vitest.config.ts` |
| **Quick run command** | `pnpm --filter gnome-extension exec vitest run test/view-model.test.js --config vitest.config.ts` |
| **Full suite command** | `pnpm test:gnome` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter gnome-extension exec vitest run test/view-model.test.js --config vitest.config.ts`
- **After every plan wave:** Run `pnpm test:gnome`
- **Before `$gsd-verify-work`:** Full extension tests plus one live GNOME 46 smoke pass must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 0 | UI redesign summary contract | unit | `pnpm --filter gnome-extension exec vitest run test/view-model.test.js --config vitest.config.ts` | ✅ | ⬜ pending |
| 7-01-03 | 01 | 0 | Install payload and GNOME smoke prerequisites | script/preflight | `bash scripts/verify-gnome-wave0.sh` | ✅ planned | ⬜ pending |
| 7-02-01 | 02 | 1 | Compact provider row view model and progress semantics | unit | `pnpm --filter gnome-extension exec vitest run test/view-model.test.js --config vitest.config.ts` | ✅ | ⬜ pending |
| 7-02-02 | 02 | 1 | Refresh remains single-flight while loading | unit | `pnpm --filter gnome-extension exec vitest run test/polling-service.test.js --config vitest.config.ts` | ✅ | ⬜ pending |
| 7-03-01 | 03 | 2 | Packaged stylesheet and assets ship in install flow | integration/script | `bash scripts/install-ubuntu.sh` on a GNOME host, then inspect ~/.local/share/gnome-shell/extensions/agent-bar-ubuntu@othavio.dev/` | ❌ W0 | ⬜ pending |
| 7-03-02 | 03 | 2 | Styled provider rows and icons render correctly in GNOME Shell 46 | manual smoke | `dbus-run-session gnome-shell --nested --wayland`, then `gnome-extensions enable agent-bar-ubuntu@othavio.dev` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending - ✅ green - ❌ red - ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/gnome-extension/test/view-model.test.js` - cover aggregate ratio/issue summary, progress clamping, and secondary-line prioritization
- [ ] `apps/gnome-extension/test/provider-row.test.js` or equivalent pure seam - cover row composition rules if `provider-row.js` gains non-trivial helper logic
- [ ] source-tree preflight for `stylesheet.css`, packaged `assets/`, and no repo-relative icon fallback
- [ ] post-install assertion for `stylesheet.css` and packaged `assets/` copy behavior
- [ ] local `pnpm` availability so repo-standard GNOME extension test commands can actually run
- [ ] GNOME 46 smoke checklist covering icon loading, compact row layout, progress bars, and refresh-state behavior

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Provider rows remain scannable inside a real GNOME Shell popup | UI redesign summary contract | Node tests cannot validate shell spacing, focus, or popup clipping | Install the extension on GNOME 46, open the menu with healthy and failing provider snapshots, and confirm the provider list is the primary scan target while summary/details/action remain secondary |
| Packaged icons resolve from the installed extension instead of the repo checkout | Packaged asset strategy | File-backed icon loading depends on installed extension paths | After install, disconnect the repo checkout path from the running extension context and confirm Claude/Codex icons still render |
| Progress bars expand and align correctly on GNOME 46 | Compact progress visualization | `St.Bin` expansion behavior changed in GNOME 46 and is shell-specific | Validate one healthy and one error-state provider row in a GNOME 46 session; confirm bars size correctly and do not collapse |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

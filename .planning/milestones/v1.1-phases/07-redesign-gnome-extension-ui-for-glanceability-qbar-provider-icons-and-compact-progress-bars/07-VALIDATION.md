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
| **Quick run command** | `pnpm --filter gnome-extension exec vitest run test/view-model.test.js test/provider-row.test.js test/polling-service.test.js --config vitest.config.ts` |
| **Full suite command** | `pnpm test:gnome` |
| **Estimated runtime** | ~25 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task-specific command from the map below, keeping the default targeted smoke suite under 30 seconds: `pnpm --filter gnome-extension exec vitest run test/view-model.test.js test/provider-row.test.js test/polling-service.test.js --config vitest.config.ts`
- **After every plan wave:** Run `pnpm test:gnome`
- **Before `$gsd-verify-work`:** Full extension tests plus one live GNOME 46 smoke pass must be green
- **Max feedback latency:** 25 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 0 | UI redesign summary contract | unit | `pnpm --filter gnome-extension exec vitest run test/view-model.test.js --config vitest.config.ts` | ✅ | ⬜ pending |
| 7-01-02 | 01 | 0 | Install/runtime wiring for stylesheet and assets | static | `rg -n "load_stylesheet|unload_stylesheet|stylesheet\\.css|assets|panel|services|state|utils" apps/gnome-extension/extension.js scripts/install-ubuntu.sh` | ✅ | ⬜ pending |
| 7-01-03 | 01 | 0 | Source-tree preflight before install | script/preflight | `bash scripts/verify-gnome-wave0.sh --source-only` | ✅ planned | ⬜ pending |
| 7-02-01 | 02 | 1 | Compact provider row view model and progress semantics | unit | `pnpm --filter gnome-extension exec vitest run test/view-model.test.js --config vitest.config.ts` | ✅ | ⬜ pending |
| 7-02-02 | 02 | 1 | Refresh remains single-flight while loading | unit | `pnpm --filter gnome-extension exec vitest run test/polling-service.test.js --config vitest.config.ts` | ✅ | ⬜ pending |
| 7-03-01 | 03 | 2 | Structured provider-row layout and progress rendering seam | unit | `pnpm --filter gnome-extension exec vitest run test/provider-row.test.js test/polling-service.test.js --config vitest.config.ts` | ✅ planned | ⬜ pending |
| 7-03-02 | 03 | 2 | Aggregate-only top-bar indicator contract | static | `rg -n "buildIndicatorSummaryViewModel|rebuildMenu|_label\\.visible|system-status-icon" apps/gnome-extension/panel/indicator.js` | ✅ | ⬜ pending |
| 7-03-03 | 03 | 2 | Post-install payload verification after extension install | integration/script | `pnpm install:ubuntu && bash scripts/verify-gnome-wave0.sh --post-install` | ✅ planned | ⬜ pending |

*Status: ⬜ pending - ✅ green - ❌ red - ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/gnome-extension/test/view-model.test.js` - cover aggregate ratio/issue summary, progress clamping, and secondary-line prioritization
- [ ] `apps/gnome-extension/test/provider-row.test.js` or equivalent pure seam - cover row composition rules if `provider-row.js` gains non-trivial helper logic
- [ ] source-tree preflight for `stylesheet.css`, packaged `assets/`, and no repo-relative icon fallback
- [ ] post-install assertion for `stylesheet.css` and packaged `assets/` copy behavior
- [ ] local `pnpm` availability so repo-standard GNOME extension test commands can actually run
- [ ] GNOME binary availability check moved to post-install/manual verification instead of source-only preflight
- [ ] GNOME 46 smoke checklist covering icon loading, compact row layout, progress bars, and refresh-state behavior

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Provider rows remain scannable inside a real GNOME Shell popup | UI redesign summary contract | Node tests cannot validate shell spacing, focus, or popup clipping | Install the extension on GNOME 46, open the menu with healthy and failing provider snapshots, and confirm the provider list is the primary scan target while summary/details/action remain secondary |
| Packaged icons resolve from the installed extension instead of the repo checkout | Packaged asset strategy | File-backed icon loading depends on installed extension paths | After `pnpm install:ubuntu` and `bash scripts/verify-gnome-wave0.sh --post-install`, confirm Claude/Codex icons still render from `~/.local/share/gnome-shell/extensions/agent-bar-ubuntu@othavio.dev/assets/` without any repo-relative fallback |
| Progress bars expand and align correctly on GNOME 46 | Compact progress visualization | `St.Bin` expansion behavior changed in GNOME 46 and is shell-specific | After install and post-install verification, validate one healthy and one error-state provider row in a GNOME 46 session; confirm bars size correctly and do not collapse |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

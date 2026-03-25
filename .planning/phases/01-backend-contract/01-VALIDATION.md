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
| **Framework** | Swift Testing |
| **Config file** | `CodexBar/Package.swift` |
| **Quick run command** | `cd CodexBar && swift test --filter 'CodexBarLinuxTests|PlatformGatingTests'` |
| **Full suite command** | `cd CodexBar && swift test` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd CodexBar && swift test --filter 'CodexBarLinuxTests|PlatformGatingTests'`
- **After every plan wave:** Run `cd CodexBar && swift test`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | BACK-01 | integration | `cd CodexBar && swift test --filter 'CodexBarLinuxTests|PlatformGatingTests'` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | BACK-02 | integration | `cd CodexBar && swift test --filter 'CodexBarLinuxTests|PlatformGatingTests'` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 2 | BACK-03 | integration | `cd CodexBar && swift test --filter 'CodexBarLinuxTests|PlatformGatingTests'` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `CodexBar/TestsLinux/UbuntuBackendContractTests.swift` — contract and cache semantics for `BACK-01` and `BACK-02`
- [ ] `CodexBar/Tests/CodexBarTests/UbuntuBackendFormatterTests.swift` — dual-output and diagnostics coverage for `BACK-03`
- [ ] `CodexBar/Tests/CodexBarTests/UbuntuBackendSnapshotMappingTests.swift` — normalized snapshot mapping coverage

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Human-readable output is understandable and aligned with JSON | BACK-03 | Readability judgment is still partly human | Run the backend in text and JSON modes for one provider and compare that the same status/source/error story is conveyed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

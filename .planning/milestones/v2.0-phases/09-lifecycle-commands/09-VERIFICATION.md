---
phase: 09-lifecycle-commands
verified: 2026-03-28T21:45:00Z
status: passed
score: 5/5 must-haves verified
gaps: []
---

# Phase 9: Lifecycle Commands Verification Report

**Phase Goal:** Users can install, remove, update, and fully uninstall Agent Bar through interactive TypeScript commands that manage systemd, GNOME extension, and settings safely
**Verified:** 2026-03-28T21:45:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running `agent-bar setup` installs the CLI symlink, systemd service, and GNOME extension with interactive prompts | VERIFIED | `setup.ts` (210 lines) implements full flow: dependency check, CLI wrapper creation, systemd service+env override, tmpfiles.d, systemctl reload/enable/restart, GNOME extension copy+enable, PATH warning. Uses @clack/prompts (intro, confirm, spinner, note, log, outro). CLI `--help` shows `setup` command. |
| 2 | Running `agent-bar remove` removes all installed files but leaves GNOME Keyring secrets intact | VERIFIED | `remove.ts` calls `runUninstall({ force: true, preserveSecrets: true, preserveSettings: true })`. Uninstall code conditionally skips secret-tool clear when `preserveSecrets: true`. CLI `--help` shows `remove` command. |
| 3 | Running `agent-bar update` pulls latest code, rebuilds, and restarts the systemd service without manual intervention | VERIFIED | `update.ts` (205 lines) implements: git repo check, dirty state check, fetch, behind count, incoming commits display, confirm, `pull --ff-only`, `bun install`, `systemctl daemon-reload + restart`, GNOME extension re-copy. CLI `--help` shows `update` command. |
| 4 | Running `agent-bar uninstall` removes everything including secrets after explicit user confirmation | VERIFIED | `uninstall.ts` (199 lines) with `initialValue: false` on p.confirm, stops/disables systemd service, removes all files via `removePathIfExists`, clears GNOME Keyring secrets via `secret-tool clear service agent-bar account copilot` (both attributes specified). CLI `--help` shows `uninstall` command. |
| 5 | Settings file includes a version field and migrates automatically when schema changes across updates | VERIFIED | `settings-schema.ts` exports `CURRENT_VERSION = 1`, `Settings` interface with `version: number`, `DEFAULT_SETTINGS`. `settings.ts` implements `normalizeSettings` (migration trigger on version < CURRENT_VERSION), `loadSettings` (async with auto-save on normalization diff), `saveSettings` (atomic write via temp+rename), `loadSettingsSync`. 7 passing tests cover all behaviors. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/backend/src/lifecycle/paths.ts` | Centralized install path constants and getInstallPaths() | VERIFIED | 68 lines. Exports APP_NAME, GNOME_EXT_UUID, REPO_ROOT, EXT_ITEMS, ENV_VARS_TO_CAPTURE, InstallPaths interface, getInstallPaths(). XDG env var fallbacks present. |
| `apps/backend/src/lifecycle/dependency-check.ts` | Pre-flight dependency detection with install hints | VERIFIED | 32 lines. Exports DependencyCheck interface, REQUIRED_DEPS (bun, secret-tool, gnome-extensions), checkDependencies(). Imports resolveCommandInPath from subprocess.ts. |
| `apps/backend/src/settings/settings-schema.ts` | Settings interface, defaults, and version constant | VERIFIED | 9 lines. Exports CURRENT_VERSION=1, Settings interface, DEFAULT_SETTINGS. |
| `apps/backend/src/settings/settings.ts` | Versioned settings load/save/normalize/migrate with atomic writes | VERIFIED | 78 lines. Exports loadSettings, loadSettingsSync, saveSettings, normalizeSettings, getSettingsPath. Uses Bun.file/Bun.write for I/O, temp+rename for atomic writes. |
| `apps/backend/src/lifecycle/setup.ts` | Interactive setup command with @clack/prompts | VERIFIED | 210 lines. Exports runSetup with SetupDependencies DI interface. Full install flow with dependency check, CLI wrapper, systemd, tmpfiles, GNOME extension. |
| `apps/backend/src/lifecycle/update.ts` | Interactive update command with @clack/prompts | VERIFIED | 205 lines. Exports runUpdate with UpdateDependencies DI interface. Git fetch/pull --ff-only, bun install, service restart, extension re-copy. |
| `apps/backend/src/lifecycle/remove.ts` | Remove command preserving secrets and settings | VERIFIED | 20 lines. Exports runRemove as thin wrapper calling runUninstall with force:true, preserveSecrets:true, preserveSettings:true. |
| `apps/backend/src/lifecycle/uninstall.ts` | Uninstall command with full cleanup including secrets | VERIFIED | 199 lines. Exports runUninstall and UninstallOptions. initialValue:false confirmation, systemd stop/disable, file removal, GNOME Keyring secret clearing. |
| `apps/backend/src/commands/lifecycle-command.ts` | Commander registration for all four lifecycle commands | VERIFIED | 66 lines. Exports registerLifecycleCommands. Registers setup, update, remove, uninstall with thin action wrappers using process.exitCode. |
| `apps/backend/src/cli.ts` | Updated CLI entry point importing lifecycle commands | VERIFIED | Line 9 imports registerLifecycleCommands, line 80 calls registerLifecycleCommands(program). |
| `apps/backend/package.json` | @clack/prompts dependency | VERIFIED | `"@clack/prompts": "^1.1.0"` present in dependencies. |
| `apps/backend/test/settings.test.ts` | Settings test suite | VERIFIED | 111 lines. 7 tests covering normalize, load, save, round-trip, sync load. All 7 pass with `bun test`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| settings.ts | settings-schema.ts | `import { Settings, DEFAULT_SETTINGS, CURRENT_VERSION }` | WIRED | Line 3 of settings.ts |
| dependency-check.ts | subprocess.ts | `import { resolveCommandInPath }` | WIRED | Line 1 of dependency-check.ts |
| paths.ts | node:os | `homedir()` | WIRED | Line 2 import, line 48 usage |
| setup.ts | paths.ts | `import { getInstallPaths, REPO_ROOT, EXT_ITEMS, ENV_VARS_TO_CAPTURE, APP_NAME, GNOME_EXT_UUID }` | WIRED | Lines 27-33 |
| setup.ts | dependency-check.ts | `import { checkDependencies }` | WIRED | Line 25 |
| setup.ts | subprocess.ts | `import { runSubprocess }` | WIRED | Line 24 |
| update.ts | subprocess.ts | `import { runSubprocess, SubprocessError }` | WIRED | Line 23 |
| update.ts | paths.ts | `import { getInstallPaths, REPO_ROOT, EXT_ITEMS, GNOME_EXT_UUID }` | WIRED | Lines 25-29 |
| remove.ts | uninstall.ts | `import { runUninstall }` with force:true, preserveSecrets:true | WIRED | Line 11, called at line 14 |
| lifecycle-command.ts | setup.ts | `import { runSetup }` | WIRED | Line 9 |
| lifecycle-command.ts | update.ts | `import { runUpdate }` | WIRED | Line 10 |
| lifecycle-command.ts | remove.ts | `import { runRemove }` | WIRED | Line 11 |
| lifecycle-command.ts | uninstall.ts | `import { runUninstall }` | WIRED | Line 12 |
| cli.ts | lifecycle-command.ts | `import { registerLifecycleCommands }` + call | WIRED | Line 9 import, line 80 call |

### Data-Flow Trace (Level 4)

Not applicable -- lifecycle commands are interactive CLI flows that operate on the filesystem and system services, not data-rendering components.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CLI shows all 4 lifecycle commands | `bun run src/cli.ts --help` | setup, update, remove, uninstall all listed | PASS |
| Settings tests pass | `bun test test/settings.test.ts` | 7 pass, 0 fail | PASS |
| TypeScript compiles (phase 9 files) | `bun x tsc --noEmit 2>&1 \| grep lifecycle\|settings` | No errors in phase 9 files | PASS |
| No process.exit() in lifecycle code | grep scan | No matches found | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LIFE-01 | 09-02 | `agent-bar setup` installs CLI symlink, systemd service, GNOME extension via TypeScript with @clack/prompts | SATISFIED | setup.ts implements full install flow with @clack/prompts (intro, confirm, spinner, note, log, outro). Registered as `setup` command in CLI. |
| LIFE-02 | 09-03 | `agent-bar remove` removes all installed files but explicitly preserves GNOME Keyring secrets | SATISFIED | remove.ts calls runUninstall with preserveSecrets:true, preserveSettings:true. Registered as `remove` command in CLI. |
| LIFE-03 | 09-02 | `agent-bar update` pulls latest code, rebuilds, restarts systemd service, re-copies GNOME extension | SATISFIED | update.ts implements git fetch/pull --ff-only, bun install, systemctl restart, GNOME extension re-copy. Registered as `update` command in CLI. |
| LIFE-04 | 09-03 | `agent-bar uninstall` removes everything including GNOME Keyring secrets with explicit confirmation | SATISFIED | uninstall.ts with initialValue:false, systemd stop/disable, file removal, secret-tool clear with service+account. Registered as `uninstall` command in CLI. |
| DATA-04 | 09-01 | Settings are versioned with migration logic and atomic writes (temp file + rename) | SATISFIED | settings-schema.ts defines CURRENT_VERSION=1 with Settings interface. settings.ts implements normalizeSettings with migration trigger, saveSettings with Bun.write(tmp)+rename. 7 tests passing. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No anti-patterns found in phase 9 files. No TODOs, no process.exit(), no sudo in execution code, no stub implementations, no placeholder returns, no empty handlers. |

Note: Pre-existing TypeScript errors exist in `prerequisite-checks.ts` (node-pty) and `auth-command.test.ts` (Bun type mismatch) but these are unrelated to phase 9 and predate this phase's work.

### Human Verification Required

### 1. Full Setup Flow on Clean System

**Test:** Run `agent-bar setup` on a system where Agent Bar is not yet installed.
**Expected:** Interactive prompts appear. CLI wrapper created at `~/.local/bin/agent-bar`. Systemd service installed, enabled, and running. GNOME extension copied and enabled.
**Why human:** Requires a live Ubuntu system with systemd, GNOME Shell, and the full filesystem. Cannot verify systemd/GNOME interaction programmatically.

### 2. Update Flow with Real Git Remote

**Test:** Run `agent-bar update` when origin/master has new commits.
**Expected:** Shows incoming commits, confirms, pulls --ff-only, runs bun install, restarts service, re-copies extension.
**Why human:** Requires a real git remote with diverged history and a running systemd service.

### 3. Remove vs Uninstall Secret Preservation

**Test:** Store a Copilot token via `agent-bar auth copilot`, then run `agent-bar remove`. Check if GNOME Keyring still has the secret. Then run `agent-bar uninstall` and verify secret is cleared.
**Expected:** After remove: secret preserved. After uninstall: secret cleared.
**Why human:** Requires GNOME Keyring with actual stored secrets and `secret-tool` binary.

### 4. Uninstall Confirmation Default

**Test:** Run `agent-bar uninstall` and immediately press Enter without changing the selection.
**Expected:** Uninstall is cancelled (initialValue: false means default is "No").
**Why human:** Requires interactive terminal with @clack/prompts rendering.

### Gaps Summary

No gaps found. All 5 success criteria from ROADMAP.md are verified against the actual codebase. All 5 requirements (LIFE-01, LIFE-02, LIFE-03, LIFE-04, DATA-04) are satisfied with substantive implementations. All artifacts exist, are substantive (no stubs), and are fully wired through the CLI entry point. Behavioral spot-checks confirm the CLI registers all four commands and settings tests pass.

Minor observation: Plan 03 SUMMARY incorrectly lists commit `c09a0af` for Task 1 (uninstall/remove) but the actual commit is `801fef5` -- this is a documentation inaccuracy that does not affect the code.

---

_Verified: 2026-03-28T21:45:00Z_
_Verifier: Claude (gsd-verifier)_

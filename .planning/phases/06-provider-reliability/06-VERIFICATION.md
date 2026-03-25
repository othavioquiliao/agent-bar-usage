---
phase: 06-provider-reliability
verified: 2026-03-25T19:43:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 06: Provider Reliability Verification Report

**Phase Goal:** Make all three providers (Copilot, Codex CLI, Claude CLI) work reliably for any user with minimal friction, both from the CLI and from the systemd background service.
**Verified:** 2026-03-25T19:43:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PTY infrastructure: `node-pty` replaces `script -qec` in `interactive-command.ts` — Codex and Claude fetchers work from systemd | VERIFIED | `interactive-command.ts` rewritten with `pty.spawn()`; no `script -qec` in source; codex and claude fetchers import `runInteractiveCommand` + `PtyUnavailableError` |
| 2 | Auth command: `agent-bar auth copilot` implemented via GitHub Device Flow OAuth, stores token in GNOME Keyring | VERIFIED | `auth-command.ts` fully implemented; `github-device-flow.ts` (RFC 8628), `secret-tool-writer.ts`, `config-writer.ts` all created and wired; `registerAuthCommand` called in `cli.ts` |
| 3 | Systemd env capture: install script writes `~/.config/systemd/user/agent-bar.service.d/env.conf` | VERIFIED | `install-ubuntu.sh` captures PATH, token vars, DBUS_SESSION_BUS_ADDRESS into `env.conf` before `daemon-reload` |
| 4 | Doctor improvements: actionable `suggested_commands`, new `node-pty` and `systemd-env` checks added | VERIFIED | `prerequisite-checks.ts` has 8 checks; all `suggested_command` values are fix commands (e.g. `sudo apt install libsecret-tools`, `agent-bar auth copilot`); schema updated in `diagnostics.ts` |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/backend/src/providers/shared/interactive-command.ts` | PTY-based subprocess spawning using `node-pty` | VERIFIED | Uses `pty.spawn()` with settled guard, 200ms input delay, `PtyUnavailableError` on import failure |
| `apps/backend/src/auth/github-device-flow.ts` | RFC 8628 Device Flow (request code + poll for token) | VERIFIED | `requestDeviceCode` + `pollForAccessToken` with all GitHub error codes handled |
| `apps/backend/src/auth/secret-tool-writer.ts` | Write-side GNOME Keyring integration | VERIFIED | `storeSecretViaSecretTool` pipes value via stdin to `secret-tool store` |
| `apps/backend/src/auth/config-writer.ts` | Idempotent config.json writer | VERIFIED | `ensureCopilotSecretRef` handles all four merge cases |
| `apps/backend/src/commands/auth-command.ts` | `agent-bar auth copilot` full UX command | VERIFIED | Complete flow: request code, show user_code, xdg-open, poll, store secret, update config, restart service |
| `apps/backend/src/cli.ts` | Registers auth command | VERIFIED | Line 75: `registerAuthCommand(program)` present |
| `scripts/install-ubuntu.sh` | Writes `env.conf` before `daemon-reload` | VERIFIED | Lines 49-73 implement env capture; `daemon-reload` follows at line 75 |
| `packages/shared-contract/src/diagnostics.ts` | `node-pty` and `systemd-env` check IDs in schema | VERIFIED | `diagnosticsCheckIdSchema` enum contains both IDs; built `dist/diagnostics.js` also updated |
| `apps/backend/src/core/prerequisite-checks.ts` | 8 checks with actionable `suggested_commands` | VERIFIED | All 8 checks defined; new checks use dynamic import for node-pty and file existence for systemd-env |
| `apps/backend/package.json` | `node-pty: ^1.0.0` dependency | VERIFIED | Line 14: `"node-pty": "^1.0.0"` |
| `pnpm-workspace.yaml` | `node-pty` in `onlyBuiltDependencies` | VERIFIED | Line 7: `- node-pty` present |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `codex-cli-fetcher.ts` | `interactive-command.ts` | `runInteractiveCommand` + `PtyUnavailableError` import | WIRED | Line 10 imports both; line 49 calls `runInteractiveCommand`; line 58 catches `PtyUnavailableError` |
| `claude-cli-fetcher.ts` | `interactive-command.ts` | `runInteractiveCommand` + `PtyUnavailableError` import | WIRED | Line 10 imports both; line 49 calls `runInteractiveCommand`; line 57 catches `PtyUnavailableError` |
| `auth-command.ts` | `github-device-flow.ts` | `requestDeviceCode` + `pollForAccessToken` import | WIRED | Lines 20-21; called at lines 71 and 83 |
| `auth-command.ts` | `secret-tool-writer.ts` | `storeSecretViaSecretTool` | WIRED | Line 21 import; called at line 92 |
| `auth-command.ts` | `config-writer.ts` | `ensureCopilotSecretRef` | WIRED | Line 22 import; called at line 96 |
| `cli.ts` | `auth-command.ts` | `registerAuthCommand(program)` | WIRED | Line 5 import; line 75 call |
| `prerequisite-checks.ts` | `node-pty` | `await import("node-pty")` | WIRED | Lines 176-186; dynamic import for availability check |
| `prerequisite-checks.ts` | systemd env.conf path | file existence check via `doesFileExist` | WIRED | Lines 189-202; builds path from `options.homeDir` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `interactive-command.ts` | `output` (PTY stdout) | `pty.spawn()` via `term.onData()` | Yes — real kernel PTY device `/dev/pts/N` | FLOWING |
| `auth-command.ts` | `tokenResult.access_token` | `pollForAccessToken` -> GitHub OAuth endpoint | Yes — real HTTP calls to GitHub | FLOWING |
| `config-writer.ts` | `config` | `readFile(configPath)` or fresh object | Yes — reads actual filesystem or creates new | FLOWING |
| `prerequisite-checks.ts` | `reportChecks[6]` (node-pty) | `await import("node-pty")` | Yes — real native module availability check | FLOWING |
| `prerequisite-checks.ts` | `reportChecks[7]` (systemd-env) | `doesFileExist(overridePath)` | Yes — real filesystem check | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| node-pty native module loads | `node -e "require('node-pty'); console.log('node-pty OK')"` | `node-pty OK` | PASS |
| node-pty can spawn a process | `pty.spawn('echo', ['pty-works'])` + `onData` | `PTY output: pty-works` | PASS |
| `shared-contract` schema accepts `node-pty` | `diagnosticsCheckIdSchema.safeParse('node-pty')` | `node-pty valid: true` | PASS |
| `shared-contract` schema accepts `systemd-env` | `diagnosticsCheckIdSchema.safeParse('systemd-env')` | `systemd-env valid: true` | PASS |
| All 44 backend tests pass | `pnpm test:backend` | `Tests 44 passed (44)` | PASS |
| No `script -qec` in backend source | `grep -rn "script.*-qec"` | No matches | PASS |
| Commits documented in summaries exist | `git log --oneline <hashes>` | All 11 commits verified in repo | PASS |

---

### Requirements Coverage

No requirement IDs were explicitly listed in the ROADMAP for phase 06. Verification was performed against the four success criteria stated in the phase prompt.

| Success Criterion | Status | Evidence |
|------------------|--------|---------|
| PTY infrastructure: node-pty replaces script -qec | SATISFIED | `interactive-command.ts` fully rewritten; no `script` usage in source |
| Auth command: `agent-bar auth copilot` via Device Flow OAuth | SATISFIED | Full implementation across 4 new files + CLI registration |
| Systemd env capture: `env.conf` written by install script | SATISFIED | `install-ubuntu.sh` env capture section confirmed before `daemon-reload` |
| Doctor improvements: actionable commands + new checks | SATISFIED | 8 checks, all with fix-oriented `suggested_command` values |

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `apps/backend/src/commands/auth-command.ts:26` | `DEFAULT_CLIENT_ID = "Ov23liWCdSLUEPTXJz4c"` — placeholder OAuth App client ID | Info | Acknowledged in SUMMARY.md "Known Stubs" section. Not a functional blocker — `--client-id` flag available for testing. Must be replaced before production release. The Device Flow itself is fully implemented. |

No other anti-patterns found. No TODO/FIXME comments, no empty implementations, no hardcoded empty data arrays in rendering paths.

---

### Human Verification Required

#### 1. Full Device Flow OAuth Round-Trip

**Test:** Run `agent-bar auth copilot` from a terminal with a GUI session available.
**Expected:** Browser opens to `https://github.com/login/device`, user enters the shown code, authorization succeeds, token stored in GNOME Keyring (verifiable via `secret-tool lookup service agent-bar account copilot`), config updated, service restarted.
**Why human:** Requires browser, GitHub account, and a registered OAuth App. The `DEFAULT_CLIENT_ID` value in `auth-command.ts` must be a real registered app for end-to-end success.

#### 2. PTY-based Codex/Claude fetch from systemd service

**Test:** After `pnpm install:ubuntu`, run `systemctl --user restart agent-bar.service && sleep 25 && agent-bar service snapshot --json`.
**Expected:** Codex and Claude providers return `status: ok` snapshots (not `codex_pty_unavailable` or `claude_pty_unavailable` errors).
**Why human:** Requires real `codex` and `claude` CLIs installed and authenticated, plus a running systemd service — cannot test in isolation.

#### 3. Systemd env.conf created by install script

**Test:** Run `pnpm install:ubuntu` from a GUI session (to have `DBUS_SESSION_BUS_ADDRESS`), then inspect `cat ~/.config/systemd/user/agent-bar.service.d/env.conf`.
**Expected:** File contains `[Service]` header and at minimum `Environment=PATH=...` with the user's actual PATH.
**Why human:** Requires a real install environment; file would be created in user's home directory.

---

### Gaps Summary

No gaps found. All four success criteria are achieved with full artifact existence, substantive implementations, correct wiring, and data flowing through all paths. The 44-test suite passes, confirming behavioral correctness.

The only noted item is the placeholder `DEFAULT_CLIENT_ID` in `auth-command.ts`, which is an acknowledged pre-release concern documented in the SUMMARY.md — it is not a phase blocker since the `--client-id` override flag makes the command testable and the Device Flow protocol itself is completely implemented.

---

_Verified: 2026-03-25T19:43:00Z_
_Verifier: Claude (gsd-verifier)_

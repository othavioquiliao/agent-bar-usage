---
status: partial
phase: 06-provider-reliability
source: [06-VERIFICATION.md]
started: 2026-03-26T17:02:16Z
updated: 2026-03-26T17:04:54Z
---

## Current Test

user approved continuation without running the Ubuntu-host checklist from this Arch machine

## Tests

### 1. Installed service resolves Codex and Claude through node-pty
expected: After `pnpm install:ubuntu`, the service can execute the CLI-backed providers without the old `script` wrapper failure mode. Provider errors, if any, should be auth/session/data related rather than `script`/PTY bootstrap failures.
result: [pending]

### 2. Copilot device flow stores token and wires backend config
expected: `agent-bar auth copilot --client-id <id>` shows the device code, completes authorization, stores the token in GNOME Keyring, writes or updates the Copilot `secretRef`, and restarts the service or skips restart cleanly.
result: [pending]

### 3. Install-time env capture and doctor diagnostics work on the Ubuntu host
expected: `pnpm install:ubuntu` writes `~/.config/systemd/user/agent-bar.service.d/env.conf`; `agent-bar doctor --json` reports actionable checks, and `node-pty` / `systemd-env` are healthy once prerequisites are installed.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

- 2026-03-26: Manual Ubuntu-host verification was waived by explicit user approval. Keep this file open as follow-up evidence until someone runs the checklist on a real target machine.

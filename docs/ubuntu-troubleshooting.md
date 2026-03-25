# Ubuntu Troubleshooting

## Extension shows "Backend error"

The extension can't communicate with the backend service.

```bash
# 1. Is the service running?
systemctl --user status agent-bar.service

# 2. Does the socket exist?
ls /run/user/1000/agent-bar/service.sock

# 3. If socket is missing, restart the service
systemctl --user restart agent-bar.service

# 4. Test the snapshot
time agent-bar service snapshot --json
# Should be < 1 second (cached), not 22 seconds (timeout/fallback)

# 5. If the service keeps crashing, check logs
journalctl --user -u agent-bar.service --no-pager | tail -20
```

Common causes:
- Socket file was cleaned by tmpfiles. Fix: `pnpm install:ubuntu` (reinstalls tmpfiles protection).
- Service binary is outdated. Fix: `pnpm install:ubuntu` (rebuilds and restarts).
- Module not found errors. Fix: `pnpm install && pnpm install:ubuntu`.

## Extension shows provider errors

The backend is reachable but individual providers are failing.

```bash
agent-bar doctor --json
```

| Error | Cause | Fix |
|---|---|---|
| `copilot_token_missing` | No GitHub token in environment | Set `GITHUB_TOKEN` env var (see README) |
| `codex_cli_failed` | Codex CLI not found or script wrapper failed | Ensure `codex` is on PATH, run `codex login` |
| `claude_cli_failed` | Claude CLI not found or script wrapper failed | Ensure `claude` is on PATH |
| `secret-tool` missing | `libsecret-tools` not installed | `sudo apt install libsecret-tools` |

## Extension doesn't appear in topbar

```bash
# Check extension state
gnome-extensions info agent-bar-ubuntu@othavio.dev

# If "Not installed": reinstall
pnpm install:ubuntu
# Then logout/login

# If "ERROR": check GNOME Shell logs
journalctl --user -b | grep "agent-bar" | tail -10
```

## Service won't start

```bash
# Check logs
journalctl --user -u agent-bar.service --no-pager | tail -20

# Common: "Cannot find module" or "ERR_MODULE_NOT_FOUND"
# Fix: rebuild
pnpm install && pnpm install:ubuntu
```

## `agent-bar: command not found`

```bash
# Check if wrapper exists
ls -la ~/.local/bin/agent-bar

# Check if ~/.local/bin is in PATH
echo $PATH | tr ':' '\n' | grep local/bin

# If missing from PATH, add to ~/.bashrc or ~/.zshrc:
export PATH="$HOME/.local/bin:$PATH"

# Reinstall
pnpm install:ubuntu
```

## Socket keeps disappearing

```bash
# Check tmpfiles protection
cat ~/.config/user-tmpfiles.d/agent-bar.conf
# Should show: d %t/agent-bar 0775 - - -

# If missing
pnpm install:ubuntu
```

## Snapshot takes 20+ seconds

The service socket is missing or the service isn't responding. The CLI falls back to direct provider fetching which is slow.

```bash
# Restart the service to recreate the socket
systemctl --user restart agent-bar.service

# Verify socket exists
ls /run/user/1000/agent-bar/service.sock

# Test speed (should be < 1 second)
time agent-bar service snapshot --json
```

## Refresh button doesn't work

The extension's polling service might have a stale state. Try:

1. Logout/login (full GNOME Shell restart)
2. If still broken: `systemctl --user restart agent-bar.service`, then logout/login

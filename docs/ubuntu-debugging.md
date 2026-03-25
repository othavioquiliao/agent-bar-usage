# Ubuntu Debugging

## Logs

### Service logs (backend)

```bash
# Follow live
journalctl --user -u agent-bar.service -f

# Last 50 lines
journalctl --user -u agent-bar.service --no-pager | tail -50

# Since boot
journalctl --user -u agent-bar.service -b --no-pager
```

### GNOME Shell logs (extension)

```bash
# Extension errors
journalctl --user -b | grep "agent-bar"

# All GNOME Shell errors
journalctl --user -b | grep "gnome-shell.*Error"

# Unhandled promise rejections from the extension
journalctl --user -b | grep "Unhandled promise"
```

## Running the service in foreground

Useful for seeing real-time output from the backend:

```bash
# Stop the background service
systemctl --user stop agent-bar.service

# Run in foreground
agent-bar service run

# You'll see: "agent-bar service listening on /run/user/1000/agent-bar/service.sock"
# Ctrl+C to stop

# Restart the background service when done
systemctl --user start agent-bar.service
```

## Testing the data flow

```bash
# 1. Service status (instant, checks socket)
agent-bar service status --json

# 2. Cached snapshot (should be < 1 second)
time agent-bar service snapshot --json

# 3. Fresh snapshot (triggers all provider fetches, can take 20+ seconds)
time agent-bar service refresh --json

# 4. Direct CLI (bypasses the service entirely)
agent-bar usage --json --diagnostics

# 5. Diagnostics
agent-bar doctor --json
```

## Inspecting the socket

```bash
# Does the socket file exist?
ls -la /run/user/1000/agent-bar/service.sock

# Is something listening?
ss -xlp | grep agent-bar

# Which process holds it?
lsof -U | grep agent-bar
```

## Extension state

```bash
# Is the extension installed and enabled?
gnome-extensions info agent-bar-ubuntu@othavio.dev

# Expected:
#   Habilitada: Sim
#   Estado: ACTIVE

# List all extensions
gnome-extensions list
```

## Checking installed files match source

```bash
# Compare installed extension with source
diff ~/.local/share/gnome-shell/extensions/agent-bar-ubuntu@othavio.dev/extension.js \
     apps/gnome-extension/extension.js

# If different, reinstall
pnpm install:ubuntu
```

## Useful environment checks

```bash
# Node.js version used by the wrapper
head -3 ~/.local/bin/agent-bar

# GNOME Shell version
gnome-shell --version

# Session type (Wayland vs X11)
echo $XDG_SESSION_TYPE

# GNOME Shell process PATH (may differ from your terminal)
cat /proc/$(pgrep -f gnome-shell | head -1)/environ 2>/dev/null | tr '\0' '\n' | grep ^PATH=
```

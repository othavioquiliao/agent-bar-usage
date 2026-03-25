---
summary: "Recommended direction for turning CodexBar knowledge into an Ubuntu provider extension architecture."
read_when:
  - Planning the Ubuntu implementation
  - Choosing the shell architecture for Linux
  - Deciding what to keep, rewrite, or defer
---

# Ubuntu Extension Direction

## 1. Main conclusion

CodexBar is a strong backend reference and a weak desktop-port candidate.

That means the Ubuntu effort should not aim to recreate the macOS app structure one-to-one.
It should instead extract or mirror the reusable backend ideas and attach them to a Linux-native shell.

## 2. What should be reused conceptually

### Reuse directly or mirror closely

- provider descriptor model
- provider fetch pipeline and strategy pattern
- common snapshot models
- source-mode concept: `auto`, `cli`, `oauth`, `api`, `web`
- refresh orchestration logic
- CLI-oriented backend entrypoints
- PTY runner approach for interactive CLIs

### Use as reference, not as-is

- settings UI
- menu bar layout
- merged-menu UX
- login dialogs
- widget/update integrations

## 3. What should be replaced on Ubuntu

The following should be considered non-portable for the Linux desktop shell:

- `NSStatusBar` / `NSStatusItem`
- `NSMenu`
- `NSAlert`
- Sparkle
- WidgetKit
- WebKit offscreen scraping
- Apple Keychain interaction
- macOS-specific browser profile detection

## 4. Recommended Ubuntu architecture

### Option A: CLI-first backend plus Linux shell

This is the most pragmatic path.

Architecture:

1. backend executable
   - reuse or mirror the `CodexBarCLI` behavior
   - expose JSON output per provider
2. Linux desktop surface
   - GNOME Shell extension, AppIndicator, or Waybar module
   - poll backend JSON on an interval
3. optional settings app
   - separate config/editor UI

Benefits:

- shortest path to visible value
- easy debugging from terminal
- simpler provider integration testing
- allows the backend to mature independently

### Option B: local daemon plus UI clients

This is the cleaner long-term architecture.

Architecture:

1. local daemon/service
   - owns provider refresh state
   - caches snapshots
   - manages auth/session state
2. UI clients
   - GNOME extension
   - TUI
   - Waybar module
   - status app

Benefits:

- one refresh engine for multiple frontends
- less repeated polling
- cleaner secret/session ownership

Tradeoff:

- more work up front

## 5. Best shell choice for Ubuntu

For Ubuntu specifically, the most natural first shell is:

- GNOME Shell extension if the goal is top-bar native integration

Strong secondary options:

- AppIndicator-based tray app
- Waybar module if targeting tiling/Wayland workflows

### Practical recommendation

If the primary audience is standard Ubuntu desktop users:

- build a small backend service or CLI
- build a GNOME Shell extension on top of it

If the first goal is fastest delivery:

- start with a CLI plus Waybar/AppIndicator integration
- add GNOME Shell UX later

## 6. Suggested implementation phases

### Phase 1: backend baseline

- define Ubuntu-side snapshot schema
- reuse or mirror the CodexBar provider descriptor pattern
- implement JSON output for:
  - Copilot
  - Codex CLI
  - Claude CLI

### Phase 2: Linux-native settings and secrets

- add config file handling
- choose secret storage strategy
  - GNOME Keyring
  - libsecret
  - encrypted file fallback
- support provider enablement/order/source selection

### Phase 3: first desktop surface

- implement GNOME Shell extension or AppIndicator
- show:
  - provider status
  - percent remaining/used
  - reset windows
  - last updated

### Phase 4: richer auth paths

- add Copilot device flow in Linux UI
- add Codex OAuth if stable
- add Claude OAuth if stable

### Phase 5: hard providers and parity work

- evaluate Cursor support
- evaluate browser-cookie access on Linux
- explicitly decide whether browser-derived features are worth the maintenance cost

## 7. Risks that should be planned early

### Browser/session access

Linux browser state is less uniform.
Anything depending on cookie extraction will be more fragile than the macOS equivalent.

### Secret storage

Apple Keychain assumptions do not transfer.
This must be redesigned intentionally.

### Desktop integration model

GNOME extensions, tray indicators, and Waybar modules each have different UX and lifecycle constraints.
The backend contract should stay independent from the frontend choice.

### Provider parity pressure

Trying to match CodexBar feature-for-feature too early will slow the project.
The first Linux version should prioritize robust providers over full parity.

## 8. Final recommendation

Build the Ubuntu product around the backend ideas, not around the macOS app shape.

The most defensible v1 is:

- backend/CLI engine
- GNOME-oriented shell
- first-wave providers:
  - Copilot
  - Codex via CLI
  - Claude via CLI

Then expand to OAuth and only later revisit browser-dependent providers such as Cursor.

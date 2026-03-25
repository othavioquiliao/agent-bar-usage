# Ubuntu Install

This install path assumes a local checkout of the repository and a working `pnpm` toolchain.

## Prerequisites

- Ubuntu with a user systemd session
- `node` on `PATH`
- `pnpm` on `PATH`
- `secret-tool` available if you want credential-backed providers to resolve cleanly

## Install

1. Run `pnpm install` at the repository root.
2. Build the backend bundle with `pnpm build:backend`.
3. Install the launcher and user service with `pnpm install:ubuntu`.

The installer writes:

- `~/.local/bin/agent-bar`
- `~/.config/systemd/user/agent-bar.service`

## Verify

- `agent-bar doctor --json`
- `agent-bar service status --json`
- `agent-bar service snapshot --json`
- `pnpm verify:ubuntu`

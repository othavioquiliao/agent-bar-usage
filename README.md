# agent-bar usage

agent-bar usage is the Ubuntu-facing runtime for the Agent Bar project. It combines a Node.js/TypeScript backend, a local service process, and a GNOME Shell extension so Ubuntu users can inspect provider usage and diagnose prerequisites from a Linux-native surface.

This repository is organized for Ubuntu 24.04.4 LTS first. It is not a macOS port. The backend, service, and diagnostics flow are built specifically around Linux conventions such as user systemd, `secret-tool`, and GNOME integration.

## What You Get

- A backend CLI that can fetch provider usage snapshots.
- A local service mode that exposes snapshot and status calls over a Unix socket.
- A `doctor` command that reports missing prerequisites and runtime health.
- A GNOME Shell extension that prefers the local backend service when available.
- Ubuntu install, verification, troubleshooting, and debugging scripts.

## Repository Layout

- `apps/backend` contains the Node.js/TypeScript backend, service runtime, and tests.
- `apps/gnome-extension` contains the GNOME Shell extension and its view-model logic.
- `packages/shared-contract` contains the schema shared between backend and frontend.
- `scripts/` contains Ubuntu install and verification helpers.
- `docs/` contains install, troubleshooting, and debugging guides.
- `packaging/` contains the systemd user unit used by the Ubuntu install path.

## Requirements

- Ubuntu 24.04.4 LTS or a comparable GNOME-based Linux desktop.
- `node` on `PATH`.
- `pnpm` on `PATH`.
- `systemd --user` available for your desktop session.
- `secret-tool` installed if you want the credential-backed provider path to work cleanly.

## Onboarding

If you are new to the repo, start here:

1. Read this README end to end.
2. Run `pnpm install` at the repository root.
3. Build the backend with `pnpm build:backend`.
4. Install the Ubuntu service wrapper with `pnpm install:ubuntu`.
5. Verify the install with `pnpm verify:ubuntu`.
6. Run `agent-bar doctor --json` if anything looks wrong.

The installation flow is intentionally local and explicit. It does not depend on a package registry or a cloud install step.

## Quick Start

```bash
pnpm install
pnpm build:backend
pnpm install:ubuntu
agent-bar doctor --json
agent-bar service status --json
agent-bar service snapshot --json
```

## Installation

The Ubuntu install path is documented in [docs/ubuntu-install.md](docs/ubuntu-install.md). The short version is:

- Build the backend bundle.
- Install the launcher wrapper to `~/.local/bin/agent-bar`.
- Install the user systemd unit to `~/.config/systemd/user/agent-bar.service`.
- Enable and start the user service.

The install script is `scripts/install-ubuntu.sh`. It also builds the backend before wiring the wrapper and service unit.

## Verification

Use the verification script after installation:

```bash
pnpm verify:ubuntu
```

It checks:

- `agent-bar` is on `PATH`.
- `agent-bar.service` is active in the user session.
- `agent-bar doctor --json` returns a valid diagnostics report.
- `agent-bar service status --json` returns a valid service status payload.
- `agent-bar service snapshot --json` returns a valid snapshot envelope.

## Common Commands

- `pnpm build:backend` builds the backend into `apps/backend/dist`.
- `pnpm --filter backend test` runs the backend test suite.
- `pnpm --filter gnome-extension test` runs the GNOME extension test suite.
- `pnpm install:ubuntu` installs the Ubuntu service wrapper and systemd unit.
- `pnpm verify:ubuntu` validates the install and runtime contract.
- `agent-bar usage --json` fetches a usage snapshot through the backend CLI.
- `agent-bar usage --json --diagnostics` includes provider diagnostics in the output.
- `agent-bar doctor --json` checks prerequisites, config, and runtime health.
- `agent-bar service run` starts the local service in the foreground.
- `agent-bar service status --json` reports the current service state.
- `agent-bar service snapshot --json` fetches a snapshot from the service.
- `agent-bar service refresh --json` forces a fresh snapshot from the service.

## Diagnostics

The `doctor` command is the fastest way to debug setup problems. It reports:

- Whether the backend config file exists.
- Whether `secret-tool` is on `PATH`.
- Whether `codex` is on `PATH`.
- Whether `claude` is on `PATH`.
- Whether a Copilot token source is configured.
- Whether the local backend service is running.

If the GNOME extension encounters a backend issue, it now surfaces a diagnostics summary and suggests `agent-bar doctor --json` as the next command.

## Service Model

The backend supports both direct CLI usage and a local Unix socket service.

- The socket path is resolved from `XDG_RUNTIME_DIR` when available.
- The service exposes `status`, `snapshot`, and `refresh` requests.
- The GNOME extension prefers the service path when `agent-bar` is installed on `PATH`.
- The CLI still works as a fallback when the service is unavailable.

## Troubleshooting

- Use [docs/ubuntu-troubleshooting.md](docs/ubuntu-troubleshooting.md) for install and runtime issues.
- Use [docs/ubuntu-debugging.md](docs/ubuntu-debugging.md) for logs and foreground service debugging.
- Run `systemctl --user status agent-bar.service` if the service does not start.
- Run `journalctl --user -u agent-bar.service -f` to follow service logs.
- Run `agent-bar doctor --json` before changing anything else.

## Development

- Backend code lives in `apps/backend`.
- GNOME extension code lives in `apps/gnome-extension`.
- Shared schemas live in `packages/shared-contract`.
- The backend build output is generated into `apps/backend/dist`.

Typical local development flow:

1. Edit code.
2. Run `pnpm --filter backend test`.
3. Run `pnpm --filter gnome-extension test`.
4. Run `pnpm build:backend` if you changed backend runtime code.
5. Re-run `pnpm verify:ubuntu` if you changed install or service behavior.

## Testing

```bash
pnpm --filter backend test
pnpm --filter gnome-extension test
pnpm build:backend
pnpm verify:ubuntu
```

The backend suite covers the contract, diagnostics, and service runtime. The GNOME suite covers backend invocation resolution, state transitions, and view-model rendering.

## Additional Docs

- [Ubuntu install](docs/ubuntu-install.md)
- [Ubuntu troubleshooting](docs/ubuntu-troubleshooting.md)
- [Ubuntu debugging](docs/ubuntu-debugging.md)

## Notes

- This repository is currently optimized for Ubuntu delivery, not general-purpose packaging.
- The local service is part of the supported path, not an implementation detail.
- The shared contract is what keeps the backend CLI, service mode, and GNOME extension aligned.

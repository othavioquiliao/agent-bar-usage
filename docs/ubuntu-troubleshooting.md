# Ubuntu Troubleshooting

## Service is not active

- Run `systemctl --user status agent-bar.service`
- Run `agent-bar service status --json`
- Check whether `~/.local/bin/agent-bar` exists and is executable

## Missing prerequisites

- Run `agent-bar doctor --json`
- If the report shows `secret-tool` as missing, install the `libsecret-tools` package on Ubuntu
- If the report shows `codex-cli` or `claude-cli` as missing, add those binaries to `PATH`

## Snapshot fetch fails

- Run `agent-bar service snapshot --json`
- Rebuild the backend with `pnpm build:backend`
- Reinstall the launcher with `pnpm install:ubuntu`

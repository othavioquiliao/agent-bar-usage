# Ubuntu Debugging

## Follow logs

- `journalctl --user -u agent-bar.service -f`
- `systemctl --user status agent-bar.service --no-pager`

## Run the backend in the foreground

- `agent-bar service run`
- `agent-bar service status --json`

## Check diagnostics

- `agent-bar doctor --json`
- `agent-bar service snapshot --json`
- `agent-bar service refresh --json`

## Notes

- `doctor` reports missing prerequisites and service readiness.
- The service snapshot path is the same data source the GNOME extension uses when it prefers the local backend service.

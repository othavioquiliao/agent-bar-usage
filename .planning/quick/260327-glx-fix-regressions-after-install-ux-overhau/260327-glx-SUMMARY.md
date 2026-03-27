# Quick Task 260327-glx Summary

**Completed:** 2026-03-27  
**Code commit:** `ea661b2`

## Outcome

- Restored GitHub Device Flow request handling to use form-encoded POST bodies and accept both `expired_token` and `token_expired`.
- Made `agent-bar auth copilot` surface the manual setup guide when polling fails, and aligned the browser-open prompt with the actual interaction order.
- Updated the Claude adapter to honor explicit `cli` mode, use the API path only when allowed, and fall back to the CLI path from `auto` mode when API fetches fail.
- Updated the Codex adapter to keep `app-server` as the preferred `auto` strategy while falling back to the PTY path on failure, and reclassified `app-server` snapshots as CLI-backed.
- Added regression coverage for the auth contract changes and the adapter source/fallback behavior.

## Verification

- `pnpm --filter backend test`
- `pnpm --filter gnome-extension test`

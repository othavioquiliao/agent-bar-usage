# Handoff: Phase 6 — Provider Reliability

## Status

**Planning complete. Implementation not started.**

All research, user decisions, and detailed plans are documented. Ready for execution.

## What was done in this session

### Bugs fixed (already committed to working tree, not yet committed to git)

These fixes were implemented during the debugging session that led to Phase 6 planning:

1. **tsconfig.build.json** — Added `"noEmit": false` and `"rootDir": "src"` to `apps/backend/tsconfig.build.json`. The build was silently producing zero files because the base config has `noEmit: true`.

2. **shared-contract build** — Created `packages/shared-contract/tsconfig.build.json` and updated its `package.json` to export compiled JS from `dist/`. The backend's compiled JS couldn't import raw `.ts` files at runtime.

3. **Build chain** — Updated root `package.json` to chain `build:shared` before `build:backend`.

4. **GNOME extension import** — Changed `import { Main }` to `import * as Main` in `extension.js`. GNOME Shell 46 modules must be imported as namespaces.

5. **GObject.registerClass** — Wrapped `Indicator` class with `GObject.registerClass()` and changed `constructor`/`super` to `_init`/`super._init` in `panel/indicator.js`.

6. **PATH fallback** — Added `~/.local/bin/agent-bar` fallback in `extension.js` for when GNOME Shell has no PATH.

7. **Service socket cache** — Added snapshot caching + warmup-on-start to `service-server.ts`. Previously every request re-fetched all providers (22 seconds).

8. **Unhandled rejection** — Removed `throw error` from polling-service.js `.catch()` block.

9. **Install script** — Added GNOME extension installation, `systemctl restart` (not just `enable --now`), and tmpfiles.d protection for the socket directory.

10. **Documentation** — Rewrote README.md, ubuntu-install.md, ubuntu-troubleshooting.md, ubuntu-debugging.md. Created CONTRIBUTING.md.

### Current working state

| Component | Status |
|---|---|
| Backend build | Working (`pnpm build:backend`) |
| Install script | Working (`pnpm install:ubuntu`) |
| systemd service | Running, socket present, cached snapshots |
| GNOME extension | Loading, communicating with backend, shows provider status |
| Copilot provider | Error: `copilot_token_missing` (no token configured) |
| Codex provider | Error: `codex_cli_failed` (script PTY fails without TTY) |
| Claude provider | Error: `claude_cli_failed` (script PTY fails without TTY) |

## What needs to be done

### Etapa 1: node-pty + fetcher refactor (06-01-PLAN.md)

**Scope**: Replace `script -qec` wrapper with `node-pty` in `interactive-command.ts`. Update Codex fetcher to use shared module. Add `PtyUnavailableError` handling to both fetchers.

**Files to touch**:
- `apps/backend/package.json` — add node-pty dependency
- `pnpm-workspace.yaml` — add node-pty to onlyBuiltDependencies
- `apps/backend/src/providers/shared/interactive-command.ts` — **rewrite** (core change)
- `apps/backend/src/providers/codex/codex-cli-fetcher.ts` — simplify to use runInteractiveCommand
- `apps/backend/src/providers/claude/claude-cli-fetcher.ts` — add PtyUnavailableError catch

**Estimated effort**: Medium. The rewrite is well-scoped and the signature doesn't change.

**Risk**: node-pty compilation. Mitigated by PtyUnavailableError with instructions.

### Etapa 2: auth + env + doctor (06-02-PLAN.md)

**Scope**: Create `agent-bar auth copilot` command (Device Flow OAuth → GNOME Keyring). Add env capture to install script. Improve doctor with actionable suggestions.

**Files to create**:
- `apps/backend/src/auth/github-device-flow.ts`
- `apps/backend/src/auth/secret-tool-writer.ts`
- `apps/backend/src/auth/config-writer.ts`
- `apps/backend/src/commands/auth-command.ts`

**Files to modify**:
- `apps/backend/src/cli.ts` — register auth command
- `scripts/install-ubuntu.sh` — env capture section
- `packages/shared-contract/src/diagnostics.ts` — new check IDs
- `apps/backend/src/core/prerequisite-checks.ts` — new checks + better suggestions

**Estimated effort**: Medium-high. The Device Flow is well-documented but has multiple moving parts (HTTP polling, secret-tool, config writer, service restart).

**Risk**: Needs a GitHub OAuth App client_id. Use `--client-id` flag for testing.

## Execution order

```
1. Etapa 1 first (unblocks Codex + Claude)
2. Etapa 2 second (unblocks Copilot + improves DX)
3. Run pnpm install:ubuntu after both
4. Logout/login to reload extension
5. agent-bar auth copilot to configure Copilot
6. agent-bar doctor --json to verify everything
```

## Key architectural decisions

| Decision | Rationale |
|---|---|
| node-pty over script/expect/socat | Creates real kernel PTYs; works from systemd; single dependency fixes both providers |
| Dynamic import for node-pty | Graceful fallback if native compilation fails |
| GitHub Device Flow over PAT/gh-reuse | Zero-friction UX; no pre-existing tool required; standard OAuth |
| GNOME Keyring (secret-tool) for token | Secure, persistent, already integrated in the backend |
| Env capture at install time | Automatic; captures PATH, tokens, DBUS in one shot |
| Doctor as fix-suggestion engine | Users run one command and know exactly what to do |

## Files reference

All planning documents for this phase:
- `06-CONTEXT.md` — problem analysis, investigation findings, user decisions
- `06-01-PLAN.md` — Etapa 1: node-pty + fetcher refactor (detailed implementation)
- `06-02-PLAN.md` — Etapa 2: auth + env + doctor (detailed implementation)
- `HANDOFF.md` — this file

## Environment info

| Item | Value |
|---|---|
| OS | Ubuntu 24.04.4 LTS |
| GNOME Shell | 46.0 |
| GJS | 1.80.2 |
| Node.js | 24.14.0 (nvm) |
| pnpm | 10.17.1 |
| Session type | Wayland |
| Repo root | `/home/larissa/Documentos/projects/agent-bar-usage` |

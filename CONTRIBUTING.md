# Contributing

## Getting started

```bash
git clone <repo-url>
cd agent-bar-usage
pnpm install
pnpm build:backend
pnpm test:backend
pnpm test:gnome
```

## Project overview

This is a pnpm monorepo with three packages:

| Package | Language | Runtime | Purpose |
|---|---|---|---|
| `apps/backend` | TypeScript | Node.js | CLI, service, provider fetchers |
| `apps/gnome-extension` | JavaScript | GJS (GNOME Shell) | Topbar indicator and menu |
| `packages/shared-contract` | TypeScript | Both | Zod schemas shared between backend and extension |

The shared contract is the coupling point. Both backend and extension must agree on the snapshot, request, and diagnostics schemas.

## Development workflow

1. Edit code
2. Run tests: `pnpm test:backend` and/or `pnpm test:gnome`
3. Build: `pnpm build:backend` (also builds shared-contract)
4. Install locally: `pnpm install:ubuntu`
5. Restart GNOME Shell (Wayland: logout/login) to pick up extension changes
6. Verify: `pnpm verify:ubuntu`

## Build system

The build chain has a dependency order:

```
shared-contract (build first) -> backend (depends on shared-contract)
```

`pnpm build:backend` handles this automatically (runs `build:shared` first).

Both packages override `"noEmit": true` from the root `tsconfig.base.json` with `"noEmit": false` in their `tsconfig.build.json`. This is intentional: the base config is for IDE type-checking, the build configs produce actual JS output.

## Backend tips

- Entry point: `apps/backend/src/cli.ts`
- Commands are registered in `apps/backend/src/commands/`
- Providers live in `apps/backend/src/providers/<name>/`
- The service server is in `apps/backend/src/service/service-server.ts`
- Tests use vitest: `apps/backend/test/`
- The service caches the last snapshot and warms the cache on startup

### Adding a new CLI command

1. Create the command file in `apps/backend/src/commands/`
2. Register it in `cli.ts`
3. Add tests

### Adding a new provider

1. Create `apps/backend/src/providers/<name>/` with:
   - `<name>-adapter.ts` — implements the provider adapter interface
   - `<name>-fetcher.ts` — fetches usage data
   - `<name>-parser.ts` — parses the raw response
2. Add the provider ID to `packages/shared-contract/src/request.ts` (`providerIdSchema`)
3. Wire the adapter into the backend coordinator
4. Add tests and rebuild: `pnpm build:backend`

## GNOME extension tips

The extension runs inside GNOME Shell's process (GJS runtime, not Node.js).

### Key differences from Node.js

- **Imports**: GI bindings (`gi://GObject`, `gi://St`, `gi://Gio`) and GNOME Shell modules (`resource:///org/gnome/shell/ui/...`)
- **GObject classes**: Any class extending a GObject subclass (like `PanelMenu.Button`) MUST use `GObject.registerClass()` with `_init()` instead of `constructor()`
- **No build step**: Extension files are plain `.js` copied directly to the extensions directory
- **Main import**: Use `import * as Main from "resource:///org/gnome/shell/ui/main.js"` (namespace import, NOT destructured)
- **Testing**: `vitest` with mocked GJS APIs for unit tests, then live testing by installing and restarting GNOME Shell

### Extension architecture

```
extension.js          Entry point (enable/disable lifecycle)
panel/indicator.js    Topbar button (GObject.registerClass required)
panel/menu-builder.js Dropdown menu construction
panel/provider-row.js Individual provider rows
services/backend-client.js  Subprocess communication with agent-bar CLI
services/polling-service.js  30-second polling + state management
state/extension-state.js     State transitions (idle -> loading -> ready/error)
utils/view-model.js          State -> UI view model mapping
utils/backend-command.js     Resolves agent-bar binary path
utils/json.js                JSON parsing
utils/time.js                Time formatting
```

### Debugging the extension

```bash
# GNOME Shell logs
journalctl --user -b | grep "agent-bar"

# Extension state
gnome-extensions info agent-bar-ubuntu@othavio.dev

# After changes: reinstall and restart
pnpm install:ubuntu
# logout/login
```

## Shared contract tips

- Schemas are defined with Zod in `packages/shared-contract/src/`
- The package exports compiled JS (not raw TS) via `dist/`
- After editing schemas, rebuild: `pnpm build:shared` (or `pnpm build:backend` which includes it)
- Both backend and extension must stay compatible with the schema

## Common gotchas

| Gotcha | Explanation |
|---|---|
| Build produces no files | `tsconfig.build.json` must have `"noEmit": false` to override the base config |
| Extension shows SyntaxError | GNOME Shell modules must be imported with `import * as X` (namespace), not `import { X }` (destructured) |
| "Tried to construct without GType" | Classes extending GObject subclasses need `GObject.registerClass()` |
| Socket disappears | The tmpfiles.d config must be installed to protect `/run/user/$UID/agent-bar/` |
| Snapshot takes 20+ seconds | The service socket is missing — `systemctl --user restart agent-bar.service` |
| Extension changes not visible | GNOME Shell (Wayland) requires logout/login to reload extensions |
| GNOME Shell has no PATH | The extension includes a fallback to `~/.local/bin/agent-bar` for PATH-less environments |

## Code style

- TypeScript: strict mode, ESM (`"type": "module"`)
- Extension JS: plain ESM, no transpilation
- Tests: vitest with `@test` style
- No linter enforced yet — follow existing patterns

## Commit messages

Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.

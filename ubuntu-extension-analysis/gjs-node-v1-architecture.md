---
summary: "Concrete v1 architecture for the chosen Ubuntu stack: GJS frontend plus Node.js/TypeScript backend."
read_when:
  - Starting implementation after stack selection
  - Defining workspace structure and module boundaries
  - Designing the JSON contract between backend and GNOME extension
---

# GJS + Node.js v1 Architecture

## 1. Chosen stack

### Backend

- Node.js 22 LTS
- TypeScript
- `commander` for CLI parsing
- `zod` for contract validation
- `pino` for logging
- `vitest` for backend tests

### Frontend

- GNOME Shell extension
- GJS
- GNOME Shell APIs: `St`, `Gio`, `GLib`, `GObject`, `Main`, `PanelMenu`, `PopupMenu`

### Contract boundary

- local CLI execution
- JSON as the canonical machine-readable contract
- text output as a human-readable formatter over the same backend model

## 2. High-level architecture

```text
GNOME Shell Extension (GJS)
        |
        | spawn_subprocess + JSON
        v
Node.js/TypeScript Backend CLI
        |
        +-- config loader
        +-- secret resolver
        +-- provider registry
        +-- refresh coordinator
        +-- snapshot cache
        +-- formatters/serializers
```

The extension should stay thin. It asks the backend for state, renders it, and triggers refresh.
Provider-specific logic, cache policy, diagnostics, and auth/session handling stay in the backend.

## 3. Recommended workspace layout

```text
agent-bar-usage/
├── apps/
│   ├── backend/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── cli.ts
│   │   │   ├── commands/
│   │   │   │   └── usage-command.ts
│   │   │   ├── core/
│   │   │   │   ├── backend-coordinator.ts
│   │   │   │   ├── provider-registry.ts
│   │   │   │   ├── provider-adapter.ts
│   │   │   │   └── refresh-policy.ts
│   │   │   ├── providers/
│   │   │   │   ├── copilot/
│   │   │   │   ├── codex-cli/
│   │   │   │   └── claude-cli/
│   │   │   ├── cache/
│   │   │   │   └── snapshot-cache.ts
│   │   │   ├── config/
│   │   │   │   ├── config-loader.ts
│   │   │   │   └── backend-request.ts
│   │   │   ├── formatters/
│   │   │   │   └── text-formatter.ts
│   │   │   ├── serializers/
│   │   │   │   └── snapshot-serializer.ts
│   │   │   ├── utils/
│   │   │   │   ├── subprocess.ts
│   │   │   │   ├── time.ts
│   │   │   │   └── errors.ts
│   │   │   └── index.ts
│   │   └── test/
│   │       ├── contract.test.ts
│   │       ├── cache-refresh.test.ts
│   │       ├── output-parity.test.ts
│   │       └── snapshot-mapping.test.ts
│   └── gnome-extension/
│       ├── metadata.json
│       ├── extension.js
│       ├── panel/
│       │   ├── indicator.js
│       │   ├── menu-builder.js
│       │   └── provider-row.js
│       ├── services/
│       │   ├── backend-client.js
│       │   └── polling-service.js
│       ├── state/
│       │   └── extension-state.js
│       ├── utils/
│       │   ├── json.js
│       │   └── time.js
│       └── prefs.js
├── packages/
│   └── shared-contract/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── snapshot.ts
│           ├── diagnostics.ts
│           ├── request.ts
│           └── index.ts
├── package.json
├── tsconfig.base.json
└── pnpm-workspace.yaml
```

## 4. Backend module boundaries

### `packages/shared-contract`

Owns only stable types and schemas:

- snapshot envelope
- provider snapshot
- refresh request
- diagnostics shape
- output enums and status enums

This package is the source of truth for contract evolution.

### `apps/backend/src/core`

Owns runtime orchestration:

- provider registry
- adapter interface
- refresh coordinator
- source-mode resolution
- failure isolation

### `apps/backend/src/providers`

One folder per provider. Each provider exports:

- descriptor metadata
- availability checks
- fetch implementation
- mapping from raw provider result to normalized contract

### `apps/backend/src/cache`

Owns short-lived cache behavior:

- cache keys by provider and source mode
- TTL policy
- forced refresh bypass

### `apps/backend/src/formatters`

Owns human-readable output.
It must render from normalized contract models only.

## 5. Frontend module boundaries

### `services/backend-client.js`

Owns subprocess execution:

- spawn backend CLI
- capture stdout/stderr
- parse JSON
- surface backend failures cleanly

### `services/polling-service.js`

Owns refresh schedule:

- periodic reads
- manual refresh calls
- debounce/avoid overlapping requests

### `panel/indicator.js`

Owns top-bar indicator:

- icon state
- summary label
- menu open/close integration

### `panel/menu-builder.js`

Owns provider rows and action menu:

- provider status rows
- last updated
- refresh action
- error display

The GNOME extension should never know provider-specific fetch details.

## 6. Provider adapter interface

The backend should standardize providers behind one interface:

```ts
export interface ProviderAdapter {
  id: ProviderId;
  isAvailable(context: ProviderContext): Promise<boolean>;
  fetch(context: ProviderContext): Promise<NormalizedProviderSnapshot>;
}
```

For more advanced fallback behavior, adapters can expose an internal strategy list, but the public coordinator should still operate on one normalized result shape.

## 7. Initial JSON contract

### Request

```json
{
  "providers": ["copilot", "codex", "claude"],
  "source_mode_override": "auto",
  "force_refresh": false,
  "include_diagnostics": false,
  "ttl_seconds": 30
}
```

### Response envelope

```json
{
  "schema_version": "1",
  "generated_at": "2026-03-25T13:52:13Z",
  "providers": [
    {
      "provider": "copilot",
      "status": "ok",
      "source": "api",
      "updated_at": "2026-03-25T13:51:58Z",
      "usage": {
        "kind": "quota",
        "used": 42,
        "limit": 100,
        "percent_used": 42
      },
      "reset_window": {
        "resets_at": "2026-03-26T00:00:00Z",
        "label": "daily"
      },
      "error": null
    }
  ]
}
```

### Snapshot fields

- `provider`: stable provider id
- `status`: `ok`, `degraded`, `error`, `unavailable`
- `source`: `auto`, `cli`, `oauth`, `api`, `web`
- `updated_at`: when this provider snapshot was last refreshed
- `usage`: normalized usage payload when available
- `reset_window`: reset metadata when available
- `error`: structured error object when the provider failed
- `diagnostics`: optional nested debug block

### Error shape

```json
{
  "code": "cli_not_found",
  "message": "codex executable was not found in PATH",
  "retryable": false
}
```

### Diagnostics shape

```json
{
  "attempts": [
    {
      "strategy": "codex-cli",
      "available": true,
      "duration_ms": 184,
      "error": null
    }
  ]
}
```

## 8. CLI shape

Recommended v1 commands:

```bash
agent-bar usage --json
agent-bar usage --provider copilot --json
agent-bar usage --provider codex --refresh --json
agent-bar usage --diagnostics --json
agent-bar usage
```

Rules:

- JSON is the real integration contract
- text output must come from the same normalized model
- `--refresh` bypasses cache
- `--diagnostics` adds nested diagnostics only on demand

## 9. Why this architecture fits v1

- It keeps the GNOME extension thin and stable
- It makes provider logic testable without GNOME
- It allows future daemonization without changing the contract
- It preserves the useful ideas from CodexBar without carrying Swift into the new codebase

## 10. Recommended first implementation order

1. Create the workspace and shared contract package
2. Implement backend CLI contract and cache coordinator
3. Implement `Copilot`, `Codex CLI`, and `Claude CLI` adapters
4. Build the GNOME Shell extension against synthetic JSON first
5. Connect the extension to the real backend

# Architecture Research

**Domain:** Linux-native AI provider usage monitor (Bun backend + GNOME Shell extension)
**Researched:** 2026-03-28
**Confidence:** HIGH

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    GNOME Shell Extension (GJS)                          │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────────────┐ │
│  │  Indicator   │  │ PollingService│  │   BackendClient              │ │
│  │  (top bar)   │  │ (timer loop)  │  │   (Gio.Subprocess → CLI)    │ │
│  └──────┬───────┘  └───────┬───────┘  └──────────────┬───────────────┘ │
│         │                  │                         │                 │
│         │    state push    │    fetchUsageSnapshot()  │                 │
│         ├──────────────────┤                         │                 │
│         │                  │                         │                 │
├─────────┴──────────────────┴─────────────────────────┴─────────────────┤
│                       IPC Boundary                                     │
│               Gio.Subprocess → `agent-bar usage --json`                │
│               (stdout JSON pipe, no socket dependency)                 │
├────────────────────────────────────────────────────────────────────────┤
│                    Backend Service (Bun + TypeScript)                   │
│                                                                        │
│  ┌─────────────┐  ┌─────────────────────┐  ┌───────────────────────┐  │
│  │  CLI Router  │  │  BackendCoordinator │  │  File-based Cache     │  │
│  │  (manual     │  │  (orchestration)    │  │  (XDG_CACHE_HOME)     │  │
│  │   parsing)   │  │                     │  │                       │  │
│  └──────┬───────┘  └────────┬────────────┘  └───────────────────────┘  │
│         │                   │                                          │
│  ┌──────┴───────┐  ┌────────┴────────────────────────────────────────┐ │
│  │  Lifecycle   │  │           Provider Registry                     │ │
│  │  Commands    │  │                                                 │ │
│  │  setup       │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐      │ │
│  │  remove      │  │  │ Copilot  │  │  Codex   │  │  Claude  │      │ │
│  │  update      │  │  │ (HTTP)   │  │ (PTY/API)│  │ (PTY/API)│      │ │
│  │  doctor      │  │  └──────────┘  └──────────┘  └──────────┘      │ │
│  │  auth        │  │                                                 │ │
│  └──────────────┘  └────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────┐  ┌────────────────────┐  ┌───────────────────┐  │
│  │  Settings         │  │  Secret Store      │  │  Config Loader   │  │
│  │  (XDG, versioned) │  │  (secret-tool/env) │  │  (XDG)           │  │
│  └──────────────────┘  └────────────────────┘  └───────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│                    systemd User Service                                │
│              ExecStart=~/.local/bin/agent-bar service run              │
│              (long-running daemon with Unix socket server)             │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| CLI Router | Parse argv, dispatch to command handlers | Manual switch/case parsing (no Commander) |
| BackendCoordinator | Orchestrate provider fetch, cache, envelope assembly | Stateless coordinator, receives registry + cache |
| Provider Registry | Register and resolve provider adapters | Map-backed ordered collection |
| Provider Adapter | Self-contained fetch logic per AI provider | Each provider is a standalone module with `isAvailable()` + `getQuota()` |
| File-based Cache | Per-provider TTL cache with deduplication | JSON files in XDG_CACHE_HOME, Bun.file() API |
| Settings | User preferences with version migration | JSON in XDG_CONFIG_HOME, normalize-on-read |
| Secret Store | Resolve provider credentials | secret-tool (Keyring) or env var lookup |
| Service Server | Long-running daemon with Unix socket | Bun.serve() with unix option or net.createServer |
| Lifecycle Commands | setup / remove / update / doctor / auth | TypeScript modules, @clack/prompts TUI |
| GNOME Extension | Top-bar indicator, polling, detail menu | GJS, Gio.Subprocess, St widgets |
| BackendClient | Extension's bridge to backend CLI | Gio.SubprocessLauncher + communicate_utf8_async |
| PollingService | Timer-based auto-refresh with retry backoff | setInterval + exponential retry delays |

## Recommended Project Structure

```
agent-bar-usage/
├── apps/
│   ├── backend/                    # Bun + TypeScript backend
│   │   ├── src/
│   │   │   ├── cli.ts              # Manual CLI router (entry point)
│   │   │   ├── providers/
│   │   │   │   ├── types.ts        # Provider + ProviderQuota interfaces
│   │   │   │   ├── registry.ts     # Provider registration + resolution
│   │   │   │   ├── copilot/
│   │   │   │   │   ├── index.ts    # CopilotProvider class (self-contained)
│   │   │   │   │   └── token.ts    # Token resolution (secret-tool/env)
│   │   │   │   ├── codex/
│   │   │   │   │   ├── index.ts    # CodexProvider class (self-contained)
│   │   │   │   │   └── parser.ts   # CLI output parser
│   │   │   │   └── claude/
│   │   │   │       ├── index.ts    # ClaudeProvider class (self-contained)
│   │   │   │       ├── api.ts      # HTTP API fetcher
│   │   │   │       └── parser.ts   # CLI output parser
│   │   │   ├── cache.ts            # File-based cache with TTL + deduplication
│   │   │   ├── config.ts           # Static config (paths, timeouts, thresholds)
│   │   │   ├── settings.ts         # User settings with version migration
│   │   │   ├── coordinator.ts      # Fetch orchestration across providers
│   │   │   ├── service/
│   │   │   │   ├── server.ts       # Unix socket service daemon
│   │   │   │   ├── client.ts       # Socket client for CLI → daemon queries
│   │   │   │   └── socket-path.ts  # XDG_RUNTIME_DIR path resolution
│   │   │   ├── commands/
│   │   │   │   ├── setup.ts        # TypeScript-based installer
│   │   │   │   ├── remove.ts       # Uninstall (preserves secrets)
│   │   │   │   ├── update.ts       # Version update
│   │   │   │   ├── auth.ts         # GitHub Device Flow OAuth
│   │   │   │   └── doctor.ts       # Prerequisite checks
│   │   │   ├── formatters/
│   │   │   │   ├── json.ts         # --json output
│   │   │   │   └── text.ts         # Human-readable terminal output
│   │   │   ├── secrets/
│   │   │   │   ├── store.ts        # SecretResolver interface + orchestration
│   │   │   │   ├── secret-tool.ts  # GNOME Keyring via secret-tool
│   │   │   │   └── env.ts          # Environment variable fallback
│   │   │   └── utils/
│   │   │       ├── subprocess.ts   # Bun.spawn() wrapper
│   │   │       └── pty.ts          # Bun.Terminal wrapper for interactive CLIs
│   │   ├── test/                   # bun:test test files
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── gnome-extension/            # GNOME Shell extension (GJS)
│       ├── panel/                   # Top-bar UI components
│       │   ├── indicator.js
│       │   ├── provider-row.js
│       │   └── progress-bar.js
│       ├── services/
│       │   ├── backend-client.js    # Gio.Subprocess → CLI bridge
│       │   └── polling-service.js   # Auto-refresh timer
│       ├── state/
│       │   └── extension-state.js   # Immutable state transitions
│       ├── utils/
│       │   ├── backend-command.js   # CLI invocation builder
│       │   ├── json.js
│       │   ├── time.js
│       │   └── view-model.js
│       ├── assets/                  # SVG/PNG provider icons
│       └── test/                    # Vitest tests
│
├── packaging/
│   ├── systemd/user/
│   │   └── agent-bar.service       # systemd user service unit
│   └── tmpfiles.d/
│       └── agent-bar.conf          # Runtime directory creation
│
├── package.json                     # Workspace root
├── pnpm-workspace.yaml             # Workspace members
└── tsconfig.base.json              # Shared compiler options
```

### Structure Rationale

- **`apps/backend/src/providers/<name>/`:** Each provider is a directory containing everything it needs. No provider imports from another provider. The `types.ts` at `providers/` level defines the contract, individual providers implement it. This is the core architectural change from v1.
- **`apps/backend/src/commands/`:** Lifecycle commands (setup, remove, update, auth, doctor) are standalone modules that import from shared utilities but never from each other. Each is a self-contained script with its own CLI entry behavior.
- **`apps/backend/src/service/`:** The daemon layer stays separate from the CLI command layer. The service wraps the coordinator, the CLI can either invoke the coordinator directly or communicate with the service through the socket.
- **No `packages/shared-contract`:** The shared-contract package with Zod schemas is eliminated. The backend defines plain TypeScript interfaces; the GNOME extension consumes JSON output through subprocess stdout. The contract boundary is the CLI JSON output format, not a shared npm package.

## Architectural Patterns

### Pattern 1: Self-Contained Provider Module

**What:** Each provider is a class implementing a minimal interface (`Provider`) with `id`, `name`, `cacheKey`, `isAvailable()`, and `getQuota()`. The provider owns its own credential lookup, HTTP/PTY fetching, response parsing, and error handling. Zero imports from other providers.

**When to use:** Always. This is the foundational pattern for provider independence.

**Trade-offs:**
- PRO: Adding or removing a provider is a single directory add/delete + one line in the registry.
- PRO: Provider bugs are fully isolated -- a Claude API change cannot break Copilot.
- CON: Some duplication across providers (timeout handling, error wrapping). This is acceptable -- shared utilities exist for cross-cutting concerns, but each provider decides whether to use them.

**Example:**
```typescript
// providers/types.ts -- the ONLY shared contract
export interface QuotaWindow {
  remaining: number;       // 0-100 percentage remaining
  resetsAt: string | null; // ISO timestamp
}

export interface ProviderQuota {
  provider: string;
  displayName: string;
  available: boolean;
  error?: string;
  primary?: QuotaWindow;
  secondary?: QuotaWindow;
  meta?: Record<string, string>;
}

export interface Provider {
  readonly id: string;
  readonly name: string;
  readonly cacheKey: string;
  isAvailable(): Promise<boolean>;
  getQuota(): Promise<ProviderQuota>;
}

// providers/copilot/index.ts -- self-contained
import type { Provider, ProviderQuota } from '../types';
import { resolveToken } from './token';

export class CopilotProvider implements Provider {
  readonly id = 'copilot';
  readonly name = 'Copilot';
  readonly cacheKey = 'copilot-usage';

  async isAvailable(): Promise<boolean> {
    return (await resolveToken()) !== null;
  }

  async getQuota(): Promise<ProviderQuota> {
    // All Copilot-specific logic is here
    // No imports from claude/ or codex/
  }
}
```

### Pattern 2: File-Based Cache with TTL + Deduplication

**What:** Cache entries are individual JSON files stored in `$XDG_CACHE_HOME/agent-bar/`. Each file contains `{ data, fetchedAt, expiresAt }`. A `getOrFetch()` method prevents duplicate concurrent requests for the same provider.

**When to use:** For all provider data. The cache sits between the coordinator and providers, not inside providers.

**Trade-offs:**
- PRO: Cache survives process restarts (critical for systemd service restart behavior).
- PRO: Easy to inspect/debug (`cat ~/.cache/agent-bar/claude-usage.json`).
- PRO: No in-memory state to leak across requests.
- CON: Slightly slower than in-memory Map cache for high-frequency access. Irrelevant here -- refresh interval is 2.5-5 minutes.

**Example:**
```typescript
// cache.ts (mirrors agent-bar-omarchy pattern)
export class Cache {
  private inflight = new Map<string, Promise<unknown>>();

  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    // Deduplicate concurrent fetches
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = fetcher()
      .then(async (data) => {
        await this.set(key, data, ttlMs);
        this.inflight.delete(key);
        return data;
      })
      .catch((err) => {
        this.inflight.delete(key);
        throw err;
      });

    this.inflight.set(key, promise);
    return promise;
  }
}
```

### Pattern 3: CLI-as-IPC-Contract (Subprocess Bridge)

**What:** The GNOME extension communicates with the backend exclusively through `Gio.Subprocess` spawning `agent-bar usage --json`. The backend outputs a JSON envelope to stdout. No Unix socket, no DBus, no shared memory.

**When to use:** For the GNOME extension to backend communication. The service daemon adds a Unix socket layer for faster repeated queries from the CLI itself, but the extension always goes through the subprocess path because GJS's Gio.Subprocess is the most reliable and review-approved IPC mechanism for GNOME extensions.

**Trade-offs:**
- PRO: GNOME extension review compliance -- subprocess spawning is the standard pattern.
- PRO: Zero coupling -- the extension does not need to know about Bun, TypeScript, or any backend internal.
- PRO: Testable in isolation -- mock the subprocess output, test the extension state machine.
- CON: Process startup overhead per refresh (~15-50ms for Bun cold start). Mitigated by the service daemon: when running, the CLI short-circuits to the socket, returning cached data in <5ms.

### Pattern 4: Dual-Path Resolution (Service vs Direct)

**What:** The CLI has two execution paths for `usage --json`:
1. **Service path:** If `agent-bar service run` is active (systemd), the CLI connects to `$XDG_RUNTIME_DIR/agent-bar/service.sock` and reads cached data instantly.
2. **Direct path:** If no service is running, the CLI fetches directly from providers (slower, no cache persistence).

The GNOME extension always invokes `agent-bar usage --json` which auto-detects which path to use.

**When to use:** Always. The service path is the default in production (systemd auto-starts it). The direct path is the fallback for development and debugging.

### Pattern 5: Manual CLI Parsing

**What:** Replace Commander with a hand-written switch/case parser. Commands are positional (`agent-bar setup`, `agent-bar usage --json`), flags are `--key value` pairs.

**When to use:** For all CLI routing. This eliminates a runtime dependency and gives full control over error messages, typo suggestions (Levenshtein distance), and output formatting.

**Example:**
```typescript
// cli.ts (mirrors agent-bar-omarchy pattern)
function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { command: 'usage', json: false };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case 'usage':   options.command = 'usage'; break;
      case 'setup':   options.command = 'setup'; break;
      case 'remove':  options.command = 'remove'; break;
      case 'update':  options.command = 'update'; break;
      case 'doctor':  options.command = 'doctor'; break;
      case 'auth':    options.command = 'auth'; break;
      case 'service': options.command = 'service'; break;
      case '--json':  options.json = true; break;
      case '--provider':
        options.provider = argv[++i]; break;
      case '--refresh':
        options.refresh = true; break;
      default:
        if (argv[i].startsWith('-')) {
          console.error(`Unknown flag: ${argv[i]}`);
        } else {
          suggestCommand(argv[i]);
        }
    }
  }
  return options;
}
```

## Data Flow

### Primary Data Flow: GNOME Extension Refresh

```
PollingService (setInterval, 150s)
    │
    ▼
BackendClient.fetchUsageSnapshot()
    │
    ▼
Gio.SubprocessLauncher.spawnv(["agent-bar", "usage", "--json", "--diagnostics"])
    │
    ▼
CLI Router (cli.ts)
    │
    ├─ Service running? ──YES──► Socket client → service daemon → cached snapshot
    │                                                                │
    └─ No service? ──────────► Direct coordinator.getSnapshot()      │
                                      │                              │
                                      ▼                              │
                               For each enabled provider:            │
                               1. Check cache (file-based)           │
                               2. Cache miss? → provider.getQuota()  │
                               3. Store result in cache file         │
                                      │                              │
                                      ▼                              │
                               Assemble SnapshotEnvelope             │
                                      │                              │
                                      ▼                              │
                               JSON.stringify → stdout ◄─────────────┘
    │
    ▼
BackendClient parses JSON from stdout
    │
    ▼
PollingService calls onStateChange(applySnapshotSuccess(state, envelope))
    │
    ▼
Indicator re-renders top-bar provider rows
```

### Provider Fetch Flow (per provider)

```
coordinator.getSnapshot(request)
    │
    ▼
For each provider in settings.providers:
    │
    ├─ cache.getOrFetch(provider.cacheKey, () => provider.getQuota())
    │       │
    │       ├─ Cache HIT → return cached ProviderQuota
    │       │
    │       └─ Cache MISS → provider.getQuota()
    │               │
    │               ├─ Copilot: HTTP fetch to api.github.com (token from Keyring/env)
    │               │
    │               ├─ Codex: Bun.spawn() with terminal option → parse CLI output
    │               │     └─ Fallback: HTTP to local app-server if available
    │               │
    │               └─ Claude: HTTP fetch to api.anthropic.com (OAuth token from ~/.claude/)
    │                     └─ Fallback: Bun.spawn() with terminal → parse CLI output
    │
    ▼
Assemble { providers: ProviderQuota[], fetchedAt: ISO string }
```

### Settings + Config Flow

```
$XDG_CONFIG_HOME/agent-bar/settings.json
    │
    ▼
loadSettings() → normalizeSettings() → migrateSettings(fromVersion)
    │
    ├─ providers: ["copilot", "codex", "claude"]  (which to show in topbar)
    ├─ providerOrder: ["copilot", "codex", "claude"]  (display order)
    └─ version: 1  (for future schema migrations)

$XDG_CONFIG_HOME/agent-bar/config.json
    │
    ▼
loadConfig() → { defaults: { ttlSeconds: 150 }, providers: [...] }
    │
    ├─ Per-provider: enabled, sourceMode, secretRef
    └─ Global: TTL, timeouts
```

## Key Architectural Decisions

### Decision 1: Keep Subprocess IPC, Drop Unix Socket Dependency from Extension

**Current state:** The GNOME extension uses `Gio.Subprocess` to spawn `agent-bar usage --json`. This works reliably.

**Decision:** Keep this as the primary IPC mechanism. The Unix socket server stays for CLI-to-daemon fast-path only.

**Rationale:**
- GJS can connect to Unix sockets via `Gio.SocketClient`, but subprocess spawning is the reviewed/approved pattern for GNOME extensions.
- The socket path adds complexity for the extension (connection management, reconnection, partial reads) with minimal benefit -- the extension polls every 2.5 minutes, not every second.
- The service daemon answers the CLI subprocess call via socket internally, giving the extension the speed benefit without socket management complexity.

### Decision 2: Replace node-pty with Bun.Terminal

**Current state:** node-pty is a native addon that requires `build-essential` to compile. It works with Node.js but has NAPI compatibility issues with Bun.

**Decision:** Use `Bun.spawn()` with the `terminal` option (Bun.Terminal API, introduced in Bun v1.3.5).

**Rationale:**
- Bun.Terminal provides first-class PTY support on POSIX systems (Linux, macOS) without any native addon compilation.
- Eliminates the `build-essential` dependency from the install prerequisites.
- API surface is simpler: `Bun.spawn(cmd, { terminal: { cols, rows, data(term, chunk) {...} } })`.
- The `data` callback replaces node-pty's `onData`, and `terminal.write()` replaces `term.write()`.

**Confidence:** HIGH -- Bun docs confirm PTY support on Linux. The `interactive-command.ts` wrapper is a thin abstraction that maps cleanly to Bun.Terminal.

### Decision 3: Eliminate shared-contract Package

**Current state:** `packages/shared-contract` exports Zod schemas for `ProviderSnapshot`, `SnapshotEnvelope`, `DiagnosticsReport`, etc. Both backend and extension depend on it.

**Decision:** Delete the package. Define plain TypeScript interfaces in the backend. The GNOME extension consumes raw JSON -- it never imported the Zod schemas anyway (GJS cannot run Zod).

**Rationale:**
- Zod is being removed entirely (PROJECT.md requirement).
- The GNOME extension already parses `JSON.parse(stdout)` without validation -- the contract is the JSON shape, not a Zod schema.
- Inline validation in the backend replaces Zod: simple type guards and boundary checks.
- Removing the package simplifies the monorepo: no `build:shared` step before `build:backend`.

### Decision 4: Service Daemon Uses Bun.serve() with Unix Socket

**Current state:** The service server uses Node.js `net.createServer()` with newline-delimited JSON over a Unix socket.

**Decision:** Migrate to `Bun.serve({ unix: socketPath, fetch(req) { ... } })`.

**Rationale:**
- `Bun.serve()` with `unix` option is well-documented and stable (since Bun v0.8.1).
- Bun's `net.createServer()` compatibility has known reliability issues with TCP data integrity. The native `Bun.serve()` API avoids these issues.
- The HTTP semantics (`fetch` handler, Request/Response) are simpler than raw newline-delimited JSON over a TCP socket.
- The CLI client uses `fetch()` with `{ unix: socketPath }` -- Bun supports this natively.
- This also enables `curl --unix-socket` debugging, which is easier than crafting raw JSON payloads.

### Decision 5: Provider Interface Mirrors agent-bar-omarchy

**Current state:** Providers implement `ProviderAdapter` with `isAvailable(context)` and `fetch(context)`, receiving a complex `ProviderAdapterContext` with request metadata, secrets, runtime info, subprocess helpers.

**Decision:** Simplify to the omarchy interface: `isAvailable(): Promise<boolean>` and `getQuota(): Promise<ProviderQuota>`. Each provider resolves its own credentials internally.

**Rationale:**
- The context-passing pattern creates implicit coupling: every provider must understand the context shape, even if it only uses 2 of 8 fields.
- Self-contained providers are easier to test: instantiate the class, call `getQuota()`, assert the result.
- Credential resolution is provider-specific anyway (Copilot uses Keyring token, Claude reads `~/.claude/.credentials.json`, Codex reads `~/.codex/auth.json`).

## Module Boundaries

### Backend Internal Boundaries

```
                 ┌───────────────────────┐
                 │      CLI Router       │
                 │   (entry point)       │
                 └─────────┬─────────────┘
                           │ dispatches to
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
   ┌─────────────┐  ┌────────────┐  ┌─────────────┐
   │  Commands   │  │Coordinator │  │  Service    │
   │  setup      │  │            │  │  server     │
   │  remove     │  │  uses ▼    │  │  client     │
   │  update     │  │            │  │             │
   │  auth       │  │ Registry   │  └──────┬──────┘
   │  doctor     │  │            │         │
   └─────────────┘  └──────┬─────┘         │
                           │               │
                    ┌──────┴──────┐        │
                    │  Providers  │  ◄─────┘ (service wraps coordinator)
                    │             │
                    │ ┌─────────┐ │
                    │ │Copilot  │ │  ← imports ONLY from ../types + own files
                    │ ├─────────┤ │
                    │ │Codex    │ │  ← imports ONLY from ../types + own files
                    │ ├─────────┤ │
                    │ │Claude   │ │  ← imports ONLY from ../types + own files
                    │ └─────────┘ │
                    └─────────────┘
                           │
                    ┌──────┴──────┐
                    │  Shared     │
                    │  Utilities  │
                    │  cache.ts   │
                    │  config.ts  │
                    │  settings.ts│
                    │  secrets/*  │
                    └─────────────┘
```

**Hard rules:**
- Providers NEVER import from each other.
- Providers import ONLY from `../types.ts` (the Provider interface) and their own sibling files.
- Providers MAY import shared utilities (cache, config, secrets) but never the coordinator or CLI.
- The coordinator imports the registry, which imports providers -- this is the only assembly point.
- Commands import shared utilities but not each other.

### Backend ↔ Extension Boundary

| Aspect | Backend Side | Extension Side | Contract |
|--------|-------------|----------------|----------|
| Invocation | CLI binary at `~/.local/bin/agent-bar` | `Gio.SubprocessLauncher.spawnv()` | Positional args: `usage --json [--refresh] [--provider <id>]` |
| Output | `JSON.stringify(envelope)` to stdout | `parseStrictJson(stdout)` | JSON object with `schema_version`, `generated_at`, `providers[]` |
| Error | stderr + non-zero exit code | BackendClientError with stderr context | Non-zero exit = retry with backoff |
| Provider data | `ProviderQuota` objects in providers array | Direct property access on parsed JSON | `{ provider, displayName, available, error?, primary?, secondary?, meta? }` |

**The extension must tolerate:**
- Missing fields (defensive `?.` access)
- Extra fields (ignore unknown properties)
- Schema evolution (new fields added without breaking)

### Backend ↔ systemd Boundary

| Aspect | Detail |
|--------|--------|
| Unit file | `~/.config/systemd/user/agent-bar.service` |
| ExecStart | `~/.local/bin/agent-bar service run` |
| Socket | `$XDG_RUNTIME_DIR/agent-bar/service.sock` |
| Protocol | HTTP over Unix socket (Bun.serve) |
| Endpoints | `GET /status`, `GET /snapshot`, `POST /refresh` |
| Restart | `on-failure`, RestartSec=2 |
| Environment | Captured at install time via systemd override |

## Build Order (Dependency Chain)

The build order matters because some components depend on others existing first.

### Phase Order Implication

```
1. Provider types + interface          (no deps, foundational)
     ↓
2. Shared utilities (cache, config,    (no provider deps)
   settings, secrets, subprocess/pty)
     ↓
3. Individual providers                (depend on types + utilities)
     ↓
4. Provider registry + coordinator     (depend on provider modules)
     ↓
5. CLI router + commands               (depend on coordinator + providers)
     ↓
6. Service daemon (server + client)    (depend on coordinator)
     ↓
7. Lifecycle commands (setup,          (depend on config + settings)
   remove, update)
     ↓
8. GNOME extension updates             (depend on stable JSON contract)
```

**Key insight:** Steps 1-6 can proceed without changing the GNOME extension at all. The extension only needs updates if the JSON output format changes (which it should not -- the format is backward-compatible). Step 8 is for improvements like auto-refresh tuning, provider selection UI, and icon integration.

### Parallel Work Opportunities

- Provider implementations (copilot, codex, claude) are fully independent and can be built/refactored in parallel.
- Cache, config, and settings modules have no interdependencies and can be built in parallel.
- Lifecycle commands (setup, remove, update) are independent of each other.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 3 providers (current) | Single-process daemon, file cache, in-memory dedup. No changes needed. |
| 5-8 providers | Add provider auto-discovery via directory convention. Registry scans `providers/*/index.ts`. Settings grow but schema migration handles it. |
| 10+ providers | Consider per-provider cache TTL configuration. Group providers by refresh priority (primary vs secondary). Still single-process -- provider fetches are I/O-bound, not CPU-bound. |

### Scaling Priorities

1. **First bottleneck:** Provider fetch latency. PTY-based providers (Codex, Claude CLI fallback) take 2-5 seconds. Solution: prefer HTTP API paths, use PTY only as fallback. Cache aggressively.
2. **Second bottleneck:** Extension startup time. If many providers are enabled, the first refresh blocks the top-bar render. Solution: the service daemon warms the cache at startup, so the first CLI call returns instantly.

## Anti-Patterns

### Anti-Pattern 1: Provider Context Passing

**What people do:** Create a rich context object (`ProviderAdapterContext`) that carries request metadata, secret resolution results, environment, time functions, subprocess helpers, and runtime metadata to every provider.

**Why it's wrong:** It creates implicit coupling between providers and the orchestration layer. Providers must understand the context shape. Testing requires constructing complex context objects. Adding a new field to the context affects every provider's type signature.

**Do this instead:** Providers are self-contained classes that resolve their own dependencies. The coordinator calls `provider.getQuota()` with no arguments. The provider reads credentials from the filesystem or Keyring directly.

### Anti-Pattern 2: Shared Zod Schema Package

**What people do:** Create a shared package with Zod schemas that both backend and extension depend on.

**Why it's wrong:** The GNOME extension runs in GJS, which cannot execute Zod. The shared package adds a build step, a workspace dependency, and version coordination overhead -- all for types that only matter at the JSON boundary.

**Do this instead:** Define plain TypeScript interfaces in the backend. Document the JSON output format. The extension parses JSON defensively with `?.` access. If type safety is needed for testing, use a separate test-only assertion file.

### Anti-Pattern 3: Unix Socket IPC from Extension

**What people do:** Connect the GNOME extension directly to the service daemon's Unix socket using `Gio.SocketClient`.

**Why it's wrong:** Socket lifecycle management in GJS is complex (connection pooling, reconnection, partial read handling). The GNOME extension review process may flag direct socket usage. If the service is not running, the extension needs a fallback path anyway.

**Do this instead:** Always use subprocess spawning from the extension. The CLI auto-detects whether the service is running and uses the socket internally. The extension gets the same fast response without managing socket state.

### Anti-Pattern 4: In-Memory-Only Cache

**What people do:** Use a `Map<string, CacheEntry>` in the service daemon for caching.

**Why it's wrong:** When systemd restarts the service (crash, OOM, update), all cached data is lost. The first request after restart triggers a full provider refresh (2-5 seconds for PTY providers).

**Do this instead:** Use file-based cache. The daemon reads cached data from disk at startup. Even after a restart, the first response is fast because file cache entries are still valid within their TTL.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| GitHub Copilot API | HTTP GET with OAuth token | Token from GNOME Keyring via `secret-tool` or env var |
| Anthropic Usage API | HTTP GET with OAuth Bearer | Token from `~/.claude/.credentials.json` |
| Codex App Server | HTTP GET to local socket | Fallback: PTY spawn of `codex` CLI |
| GNOME Keyring | `secret-tool lookup` subprocess | For Copilot OAuth token storage |
| systemd | User service unit | Manages long-running daemon lifecycle |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Extension ↔ Backend | Gio.Subprocess stdout (JSON) | Extension spawns CLI, reads stdout |
| CLI ↔ Service Daemon | HTTP over Unix socket | CLI auto-detects running service |
| Coordinator ↔ Providers | Direct function call (getQuota) | In-process, no serialization |
| Coordinator ↔ Cache | File I/O (Bun.file) | JSON files in XDG_CACHE_HOME |
| Providers ↔ External APIs | HTTP fetch | Per-provider timeout + error handling |
| Providers ↔ CLI tools | Bun.spawn with terminal option | PTY for interactive CLIs (Codex, Claude) |

## How Provider Independence Is Achieved

The v1 architecture has partial independence but leaks coupling through:

1. **Shared `ProviderAdapterContext`** -- all providers must accept the same context shape.
2. **Centralized `ProviderContextBuilder`** -- resolves secrets, source modes, and runtime metadata for all providers.
3. **`shared-contract` Zod schemas** -- all providers must conform to `providerSnapshotSchema.parse()`.
4. **Registry factory** -- hardcoded import of all provider factory functions.

The v2 architecture achieves full independence through:

1. **Minimal interface** -- `Provider { id, name, cacheKey, isAvailable(), getQuota() }`. That is the entire contract.
2. **Self-contained credentials** -- each provider reads its own credential source directly. Copilot reads from Keyring, Claude reads `~/.claude/.credentials.json`, Codex reads `~/.codex/auth.json`.
3. **No shared schema** -- each provider returns a `ProviderQuota` object. The coordinator does not validate or transform it beyond null-safety.
4. **Directory-based discovery** -- the registry imports from `providers/copilot`, `providers/codex`, `providers/claude`. Adding a provider means creating a new directory and adding one line to the registry.
5. **Independent testing** -- each provider can be tested by instantiating it directly and calling `getQuota()` with no mocks for context, registry, or coordinator.

## Sources

- [Bun.spawn() with terminal/PTY option](https://bun.com/docs/runtime/child-process) -- HIGH confidence, official docs
- [Bun.serve() Unix socket support](https://bun.sh/guides/http/fetch-unix) -- HIGH confidence, official docs
- [Bun v1.3.5 release (Bun.Terminal API)](https://bun.com/blog/bun-v1.3.5) -- HIGH confidence, official release notes
- [Bun net.createServer TCP reliability issues](https://github.com/oven-sh/bun/issues/14836) -- MEDIUM confidence, GitHub issue
- [GJS Subprocess guide](https://gjs.guide/guides/gio/subprocesses.html) -- HIGH confidence, official GJS documentation
- [GNOME Shell extension socket example](https://github.com/jeffchannell/gnome-shell-socket) -- LOW confidence, community example
- [Bun Node-API compatibility](https://bun.com/docs/runtime/node-api) -- HIGH confidence, official docs
- [node-pty NAPI port PR](https://github.com/microsoft/node-pty/pull/644) -- MEDIUM confidence, shows Bun compatibility gaps
- [bun-pty community library](https://github.com/sursaone/bun-pty) -- LOW confidence, alternative if Bun.Terminal is insufficient
- [Bun.serve does not work with unix socket (resolved)](https://github.com/oven-sh/bun/issues/8044) -- MEDIUM confidence, shows feature evolution

---
*Architecture research for: Agent Bar Ubuntu v2.0 refactor*
*Researched: 2026-03-28*

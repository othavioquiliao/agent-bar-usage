# Phase 8: Bun Runtime Migration - Research

**Researched:** 2026-03-28
**Domain:** Runtime migration (Node.js to Bun), PTY, IPC, TypeScript execution
**Confidence:** HIGH

## Summary

Phase 8 migrates the `apps/backend/` Node.js/TypeScript backend to run entirely on the Bun runtime. The migration touches four concrete surfaces: (1) the runtime itself (Bun replaces Node.js as the execution engine), (2) PTY allocation for interactive CLI commands (`node-pty` replaced by `Bun.Terminal`), (3) Unix socket IPC for the service daemon (`net.createServer`/`net.createConnection` replaced by `Bun.listen`/`Bun.connect`), and (4) direct `.ts` execution without a build step.

The reference codebase at `/home/othavio/Work/agent-bar-omarchy/` already runs on Bun 1.3.11 and demonstrates proven patterns for file I/O (`Bun.file`, `Bun.write`), subprocess spawning (`Bun.spawn`), workspace configuration (`bunfig.toml`), and test execution (`bun test`). The current backend's Node-specific surface is concentrated in a small number of files (service-server.ts, service-client.ts, interactive-command.ts, subprocess.ts, codex-appserver-fetcher.ts), making the migration well-scoped.

**Primary recommendation:** Use Bun-native APIs (`Bun.listen`/`Bun.connect` for sockets, `Bun.spawn` with `terminal` option for PTY, `Bun.file`/`Bun.write` for file I/O) where they offer clear benefits. Keep `node:fs/promises`, `node:path`, `node:os` imports as-is since Bun fully supports these modules. Focus the migration on the three APIs where Node.js-specific code is incompatible or inferior: PTY, IPC sockets, and subprocess spawning.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- all implementation choices are at Claude's discretion for this pure infrastructure phase.

### Claude's Discretion
All implementation choices are at Claude's discretion -- pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key research findings to consider:
- Bun v1.3.11+ has native PTY support via Bun.Terminal API (introduced v1.3.5 Dec 2025)
- Bun.serve({ unix }) is the stable IPC path (net.createServer has known reliability issues in Bun)
- Unix socket permissions differ under Bun (oven-sh/bun#15686) -- must chmod 0600 after creation
- Bun runs .ts files directly -- no esbuild/tsc build step needed for development
- Reference codebase agent-bar-omarchy at /home/othavio/Work/agent-bar-omarchy/ uses Bun successfully

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RUNTIME-01 | Backend migrates from Node.js to Bun runtime | Bun 1.3.11 verified available locally. Workspace config, tsconfig, package.json patterns documented from reference project. |
| RUNTIME-02 | PTY allocation uses Bun.Terminal API (replaces node-pty native addon) | Bun.Terminal API verified working on Bun 1.3.11. `terminal` option on `Bun.spawn` maps directly to current `node-pty` usage. Code examples documented. |
| RUNTIME-03 | Service daemon uses Bun.serve({ unix }) for socket IPC (replaces net.createServer) | **Clarification:** `Bun.listen`/`Bun.connect` (raw TCP API) is the correct replacement, NOT `Bun.serve` (which is HTTP-only). Both verified working with unix sockets and newline-delimited JSON. Code examples documented. |
| RUNTIME-04 | Backend runs .ts files directly in development (no build step required) | Bun executes `.ts` directly. Shebang `#!/usr/bin/env bun` pattern proven in reference project. `bun run src/main.ts` works out of the box. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Bun runtime | 1.3.11 | JavaScript/TypeScript runtime | Already installed locally via mise. Native PTY, fast startup, direct .ts execution |
| @types/bun | latest | TypeScript type definitions for Bun APIs | Required for Bun.listen, Bun.spawn terminal, Bun.file types |
| TypeScript | 5.9.x | Type checking (noEmit mode) | Already in use. Bun uses `moduleResolution: "bundler"` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 3.2.x | Test runner | Keep for existing tests -- migration to bun:test is optional and deferred |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bun.listen/connect (raw) | Bun.serve({ unix }) | Bun.serve is HTTP-only; current protocol is newline-delimited JSON over raw TCP. Using Bun.serve would require rewriting the IPC protocol to HTTP. Bun.listen is the correct choice. |
| bun:test | vitest | bun:test is 10x faster but has less mature mocking and no jsdom. Keep vitest for now; migration is a separate concern. |
| Bun.file/Bun.write | node:fs/promises | Bun.file is more ergonomic but node:fs works fine under Bun. Migrate opportunistically, not mandatorily. |

### Packages to Remove
| Package | Reason |
|---------|--------|
| node-pty | Native addon incompatible with Bun. Replaced by Bun.Terminal API |
| @types/node | Replace with @types/bun (Bun includes Node.js type compatibility) |
| tsx | No longer needed -- Bun runs .ts directly |
| esbuild (if present) | No build step needed for development |

**Installation:**
```bash
cd apps/backend
bun add -d @types/bun typescript
bun remove node-pty @types/node tsx
```

## Architecture Patterns

### Recommended Project Structure
```
apps/backend/
  src/
    cli.ts                          # #!/usr/bin/env bun shebang
    service/
      service-server.ts             # Bun.listen({ unix }) server
      service-client.ts             # Bun.connect({ unix }) client
      socket-path.ts                # unchanged (uses node:os, node:path -- Bun-compatible)
    providers/
      shared/
        interactive-command.ts      # Bun.spawn({ terminal }) wrapper
    utils/
      subprocess.ts                 # Bun.spawn (non-PTY) wrapper
  bunfig.toml                       # Bun-specific configuration
  tsconfig.json                     # Updated for Bun (moduleResolution: "bundler")
  package.json                      # Updated scripts, bin points to .ts
```

### Pattern 1: PTY via Bun.Terminal
**What:** Replace `node-pty` spawn with `Bun.spawn({ terminal })` for interactive CLI commands
**When to use:** When spawning CLIs that require a TTY (claude, codex)
**Example:**
```typescript
// Source: https://bun.com/docs/runtime/child-process (PTY section)
// Replaces: pty.spawn(command, args, { cols, rows, cwd, env })

export async function runInteractiveCommand(
  command: string,
  args: string[] = [],
  options: InteractiveCommandOptions = {},
): Promise<SubprocessResult> {
  const startedAt = Date.now();
  let output = "";

  const proc = Bun.spawn([command, ...args], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    terminal: {
      cols: 120,
      rows: 30,
      data(_terminal, data) {
        output += data.toString();
      },
    },
  });

  // Delay input: CLI needs time to initialize its prompt
  if (options.input) {
    setTimeout(() => {
      proc.terminal?.write(options.input!);
    }, 200);
  }

  // Timeout handling
  const timeout = setTimeout(() => {
    proc.kill();
  }, options.timeoutMs ?? 15_000);

  const exitCode = await proc.exited;
  clearTimeout(timeout);

  return {
    command,
    args,
    exitCode,
    stdout: output,
    stderr: "",
    durationMs: Date.now() - startedAt,
  };
}
```

### Pattern 2: Unix Socket Server via Bun.listen
**What:** Replace `net.createServer` with `Bun.listen({ unix })` for the service daemon
**When to use:** Service daemon socket that accepts newline-delimited JSON requests
**Example:**
```typescript
// Source: Bun type definitions (UnixSocketOptions) + verified locally
// Replaces: net.createServer((socket) => { ... }).listen(socketPath)

const server = Bun.listen<{ buffer: string }>({
  unix: socketPath,
  socket: {
    open(socket) {
      socket.data = { buffer: "" };
    },
    data(socket, data) {
      socket.data.buffer += data.toString();
      const idx = socket.data.buffer.indexOf("\n");
      if (idx === -1) return;

      const rawRequest = socket.data.buffer.slice(0, idx);
      socket.data.buffer = socket.data.buffer.slice(idx + 1);

      const request = JSON.parse(rawRequest) as ServiceRequestPayload;
      handleRequest(request).then((response) => {
        socket.write(JSON.stringify(response) + "\n");
        socket.end();
      });
    },
    close() {},
    error(_socket, error) {
      console.error("Socket error:", error);
    },
  },
});
```

### Pattern 3: Unix Socket Client via Bun.connect
**What:** Replace `net.createConnection` with `Bun.connect({ unix })` for the service client
**When to use:** CLI commands querying the running service daemon
**Example:**
```typescript
// Source: Bun type definitions (UnixSocketOptions for connect)
// Replaces: net.createConnection({ path: socketPath })

function readSocketResponse(
  socketPath: string,
  request: ServiceWireRequest,
  timeoutMs = 15_000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new ServiceClientError("Timed out", socketPath));
      }
    }, timeoutMs);

    Bun.connect<void>({
      unix: socketPath,
      socket: {
        open(socket) {
          socket.write(JSON.stringify(request) + "\n");
        },
        data(socket, data) {
          buffer += data.toString();
          const idx = buffer.indexOf("\n");
          if (idx === -1) return;
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          socket.end();
          resolve(buffer.slice(0, idx).trim());
        },
        close() {
          if (!settled && buffer.trim()) {
            settled = true;
            clearTimeout(timer);
            resolve(buffer.trim());
          }
        },
        error(_socket, error) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(new ServiceClientError(error.message, socketPath, error));
          }
        },
        connectError(_socket, error) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(new ServiceClientError(`Could not connect to ${socketPath}`, socketPath, error));
          }
        },
      },
    });
  });
}
```

### Pattern 4: Non-PTY Subprocess via Bun.spawn
**What:** Replace `child_process.spawn` with `Bun.spawn` for non-interactive subprocesses
**When to use:** codex-appserver-fetcher.ts, any subprocess that doesn't need a TTY
**Example:**
```typescript
// Source: https://bun.com/docs/runtime/child-process
// Replaces: spawn from "node:child_process"

const proc = Bun.spawn(["codex", "app-server"], {
  env: { ...process.env, ...env },
  stdin: "pipe",
  stdout: "pipe",
  stderr: "pipe",
});

// Write to stdin
proc.stdin.write(JSON.stringify(msg) + "\n");
proc.stdin.flush();

// Read stdout as text
const stdout = await proc.stdout.text();

// Or read line by line using async iterator
const reader = proc.stdout.getReader();
// ... process chunks
```

### Pattern 5: CLI Entry Point with Bun Shebang
**What:** Use `#!/usr/bin/env bun` shebang for direct .ts execution
**When to use:** CLI entry point file
**Example:**
```typescript
#!/usr/bin/env bun
// cli.ts -- runs directly without build step

import { parseArgs } from "./cli-parser.js";
// ... rest of CLI logic
```

### Anti-Patterns to Avoid
- **Keeping node-pty alongside Bun.Terminal:** node-pty is a native addon that won't compile under Bun's build system. Remove it entirely.
- **Using Bun.serve for non-HTTP IPC:** `Bun.serve({ unix })` creates an HTTP server. The current protocol is newline-delimited JSON over raw sockets. Use `Bun.listen`/`Bun.connect` instead.
- **Replacing all node: imports:** `node:fs/promises`, `node:path`, `node:os` work perfectly under Bun. Only replace imports where Bun-native APIs provide clear benefits (PTY, sockets, subprocess spawning).
- **Keeping esbuild/tsc build step for development:** Bun runs .ts directly. The build step should only exist for production (`bun build --compile` is a future concern, not Phase 8).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PTY allocation | Custom PTY binding or FFI | Bun.Terminal via `Bun.spawn({ terminal })` | PTY is complex OS-level code; Bun has battle-tested native support |
| Unix socket server | Raw file descriptor management | `Bun.listen({ unix })` | Handles socket lifecycle, error recovery, connection management |
| Unix socket client | Raw socket connection logic | `Bun.connect({ unix })` | Handles connection errors, timeouts, event-driven data |
| TypeScript execution | Custom transpiler or loader | Bun's built-in TypeScript support | Zero-config, handles JSX/TSX, import resolution |
| Workspace resolution | Custom symlink management | Bun workspaces in package.json | `"workspaces": ["apps/*", "packages/*"]` + `workspace:*` protocol |

**Key insight:** The entire migration is about replacing intermediary tools (node-pty, esbuild, tsx) with Bun built-ins. Every Node.js-specific pattern has a direct Bun equivalent.

## Common Pitfalls

### Pitfall 1: Bun.serve vs Bun.listen Confusion
**What goes wrong:** Developer uses `Bun.serve({ unix })` for the service daemon, but it creates an HTTP server. The GNOME extension client sends raw JSON, not HTTP requests, causing connection failures.
**Why it happens:** The CONTEXT.md suggests "Bun.serve({ unix }) is the stable IPC path" -- this is correct for HTTP-based IPC but the current codebase uses raw TCP with newline-delimited JSON.
**How to avoid:** Use `Bun.listen({ unix })` for the server and `Bun.connect({ unix })` for the client. These support the exact same newline-delimited JSON protocol currently in use.
**Warning signs:** Client connections succeed but responses are HTTP formatted (headers + body) instead of raw JSON.

### Pitfall 2: Socket Permission Differences
**What goes wrong:** Unix socket created by Bun has 700 permissions instead of Node's 755, causing the GNOME extension (running as same user) to fail connecting.
**Why it happens:** Bun's underlying uSockets library historically chmod'd sockets to 700. Fixed in Bun PR #16200 (merged Jan 2025).
**How to avoid:** Bun 1.3.11 includes the fix. Verify after creation: `ls -la $XDG_RUNTIME_DIR/agent-bar/service.sock`. If permission issues arise, add `chmodSync(socketPath, 0o755)` as fallback.
**Warning signs:** `EACCES` errors when the service client tries to connect.

### Pitfall 3: Bun.spawn terminal.data Returns Buffer, Not String
**What goes wrong:** The `data` callback in the terminal option receives raw bytes. Concatenating without `.toString()` produces garbled output.
**Why it happens:** Bun's socket/terminal data handlers return Buffer by default for performance.
**How to avoid:** Always call `data.toString()` in the terminal data callback, just as the reference project does.
**Warning signs:** CLI output parsing fails with encoding-related errors.

### Pitfall 4: Bun.spawn stdin Requires Explicit Flush
**What goes wrong:** Data written to `proc.stdin` doesn't reach the subprocess.
**Why it happens:** Bun's FileSink buffers writes. Unlike Node.js streams, you may need to call `.flush()` and `.end()`.
**How to avoid:** After writing to stdin, call `proc.stdin.flush()` and when done, call `proc.stdin.end()`.
**Warning signs:** Subprocess hangs waiting for input that was already "written".

### Pitfall 5: Workspace package.json Must Move workspaces to Root
**What goes wrong:** `bun install` doesn't resolve `shared-contract` as a workspace package.
**Why it happens:** Current project uses `pnpm-workspace.yaml` for workspace definition. Bun uses `"workspaces"` field in root `package.json`.
**How to avoid:** Add `"workspaces": ["apps/*", "packages/*"]` to root `package.json`. Keep `pnpm-workspace.yaml` for backward compatibility if pnpm is still used elsewhere.
**Warning signs:** `Cannot find module "shared-contract"` errors.

### Pitfall 6: TypeScript moduleResolution Must Be "bundler"
**What goes wrong:** TypeScript complains about imports or Bun-specific APIs aren't recognized.
**Why it happens:** Current tsconfig uses `"moduleResolution": "NodeNext"` which doesn't resolve Bun's module resolution strategy.
**How to avoid:** Update tsconfig to use `"moduleResolution": "bundler"` and `"types": ["bun-types"]`.
**Warning signs:** TS errors on imports that work at runtime.

### Pitfall 7: Vitest Runs Under Bun But With Caveats
**What goes wrong:** Some vitest features behave differently under Bun runtime.
**Why it happens:** Vitest was designed for Node.js. Running it under Bun may have edge cases.
**How to avoid:** Keep `bun run vitest` (Bun as runtime, vitest as test framework). If issues arise, use `bunx vitest` or configure vitest to use the Bun environment.
**Warning signs:** Test timeouts, mock resolution failures, or import resolution differences.

## Code Examples

### tsconfig.json for Bun
```json
// Source: /home/othavio/Work/agent-bar-omarchy/tsconfig.json (verified)
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["bun-types"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### bunfig.toml
```toml
# Source: /home/othavio/Work/agent-bar-omarchy/bunfig.toml (verified)
[install]
exact = true

[run]
silent = true

[test]
coverage = true
```

### package.json Scripts for Bun
```json
// Source: /home/othavio/Work/agent-bar-omarchy/package.json (verified, adapted)
{
  "scripts": {
    "start": "bun run src/cli.ts",
    "dev": "bun --watch run src/cli.ts",
    "test": "bun run vitest run --config vitest.config.ts",
    "typecheck": "bun x tsc --noEmit"
  }
}
```

### Root package.json with Bun Workspaces
```json
{
  "name": "agent-bar-usage",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "test:backend": "bun run --filter backend test"
  }
}
```

### CLI Wrapper Script (for systemd/symlink)
```bash
#!/usr/bin/env bash
# Source: /home/othavio/Work/agent-bar-omarchy/scripts/agent-bar-omarchy (verified pattern)
set -euo pipefail

if ! command -v bun &>/dev/null; then
  echo "agent-bar: bun is required but not found. Install it: https://bun.sh" >&2
  exit 1
fi

SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
APP_DIR="$(dirname "$SCRIPT_DIR")"
exec bun "$APP_DIR/apps/backend/src/cli.ts" "$@"
```

## Node.js API Migration Map

| Current (Node.js) | Bun Replacement | File(s) | Notes |
|--------------------|-----------------|---------|-------|
| `import { spawn } from "node:child_process"` | `Bun.spawn()` | subprocess.ts, codex-appserver-fetcher.ts | Drop-in for non-PTY subprocess |
| `import pty from "node-pty"` / `pty.spawn()` | `Bun.spawn({ terminal: {...} })` | interactive-command.ts | Terminal option replaces PTY package |
| `net.createServer()` | `Bun.listen({ unix })` | service-server.ts | Raw TCP socket server |
| `net.createConnection()` | `Bun.connect({ unix })` | service-client.ts | Raw TCP socket client |
| `readFile` from `node:fs/promises` | `Bun.file(path).text()` or keep as-is | credentials, config | Optional -- node:fs works fine |
| `writeFile` from `node:fs/promises` | `Bun.write(path, data)` or keep as-is | config-writer.ts | Optional -- node:fs works fine |
| `accessSync` from `node:fs` | `await Bun.file(path).exists()` or keep as-is | subprocess.ts | Optional |
| `process.env`, `process.argv` | Same -- Bun supports these | All files | No change needed |
| `import path from "node:path"` | Same -- Bun supports this | All files | No change needed |
| `import os from "node:os"` | Same -- Bun supports this | All files | No change needed |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| node-pty (native addon) | Bun.Terminal API | Bun v1.3.5 (Dec 2025) | No more native compilation, no build-essential dependency |
| net.createServer for IPC | Bun.listen/Bun.connect | Stable since Bun v0.2+ | Event-driven socket handler pattern (not EventEmitter) |
| esbuild/tsc build step | Bun direct .ts execution | Since Bun v1.0 | Zero build step for development |
| pnpm-workspace.yaml | Bun workspaces in package.json | Bun supports npm-style workspaces | workspace:* protocol supported |

**Deprecated/outdated:**
- node-pty under Bun: native addon compilation is unreliable under Bun's build system
- net.createServer under Bun: has "known reliability issues" per CONTEXT.md notes; Bun-native socket API is preferred

## Open Questions

1. **Should pnpm be completely removed?**
   - What we know: Bun can replace pnpm for dependency management and workspace resolution. The root package.json uses `"packageManager": "pnpm@10.33.0"`.
   - What's unclear: Whether GSD tooling or other workspace concerns depend on pnpm specifically.
   - Recommendation: Add `"workspaces"` to root package.json but keep pnpm-workspace.yaml. Use `bun install` for the backend but don't remove pnpm until confirmed safe. This phase focuses on runtime, not package manager.

2. **Should vitest be replaced with bun:test?**
   - What we know: bun:test is 10x faster and has Jest-compatible API. Existing tests use vitest-specific imports (`import { describe, expect, it } from "vitest"`).
   - What's unclear: Whether all vitest features used in tests (mocking, matchers) have bun:test equivalents.
   - Recommendation: Keep vitest for now. Run it under Bun (`bun run vitest`). Test framework migration is a separate concern from runtime migration.

3. **Should shared-contract also move to Bun?**
   - What we know: shared-contract is a pure TypeScript types package with Zod schemas. It has its own build step (`tsc -p tsconfig.build.json`).
   - What's unclear: Whether Bun's workspace resolution can import .ts source directly without building shared-contract.
   - Recommendation: Try direct .ts source import first (update shared-contract exports to point to `./src/index.ts`). If workspace resolution works, remove the build step.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | All RUNTIME-* requirements | Yes | 1.3.11 | -- |
| pnpm | Current workspace management | Yes | 10.33.0 | Bun workspaces |
| TypeScript | Type checking | Yes (via pnpm) | 5.9.2 | -- |
| vitest | Existing test suite | Yes (via pnpm) | 3.2.4 | bun:test (deferred) |
| node-pty | Current PTY (being removed) | Yes | 1.0.0 | Bun.Terminal (replacement) |

**Missing dependencies with no fallback:**
- None -- all required tools are available.

**Missing dependencies with fallback:**
- None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.2.4 (kept during migration) |
| Config file | `apps/backend/vitest.config.ts` |
| Quick run command | `cd apps/backend && bun run vitest run --config vitest.config.ts` |
| Full suite command | `cd apps/backend && bun run vitest run --config vitest.config.ts` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RUNTIME-01 | Backend starts with `bun run src/cli.ts` | smoke | `cd apps/backend && bun run src/cli.ts usage --json` | N/A (manual smoke) |
| RUNTIME-02 | PTY commands execute via Bun.Terminal | unit | `cd apps/backend && bun run vitest run test/codex-provider.test.ts test/claude-provider.test.ts -x` | Yes (existing tests exercise interactive-command.ts) |
| RUNTIME-03 | Unix socket IPC works via Bun.listen/connect | unit | `cd apps/backend && bun run vitest run test/service-runtime.test.ts -x` | Yes (existing test) |
| RUNTIME-04 | .ts files execute directly without build | smoke | `cd apps/backend && bun run src/cli.ts --help` | N/A (manual smoke) |

### Sampling Rate
- **Per task commit:** `cd apps/backend && bun run vitest run --config vitest.config.ts`
- **Per wave merge:** Full suite above
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- None -- existing test infrastructure covers the critical paths (service-runtime.test.ts, codex-provider.test.ts, claude-provider.test.ts). Tests will validate the migration implicitly by running under Bun.

## Sources

### Primary (HIGH confidence)
- Bun.spawn terminal docs: https://bun.com/docs/runtime/child-process -- PTY API, terminal option, reusable terminal pattern
- Bun.listen/connect type definitions: `/home/othavio/Work/agent-bar-omarchy/node_modules/bun-types/bun.d.ts` lines 6348-6395 -- UnixSocketOptions, SocketHandler interfaces
- Bun.serve unix socket docs: https://bun.com/docs/runtime/http/server -- HTTP-only server with unix option (NOT for raw TCP)
- Reference project (agent-bar-omarchy): `/home/othavio/Work/agent-bar-omarchy/` -- Bun patterns for package.json, tsconfig.json, bunfig.toml, providers, cache
- Local verification: `Bun.listen({ unix })` and `Bun.connect({ unix })` with newline-delimited JSON tested and confirmed working on Bun 1.3.11
- Local verification: `Bun.spawn({ terminal })` tested and confirmed working on Bun 1.3.11

### Secondary (MEDIUM confidence)
- Bun unix socket permissions fix: https://github.com/oven-sh/bun/issues/15686 -- PR #16200 merged Jan 2025, socket permissions now match Node.js behavior
- Bun workspace docs: https://bun.com/docs/guides/install/workspaces -- workspace:* protocol, package.json workspaces field
- Bun test runner docs: https://bun.com/docs/test -- Jest-compatible API, migration from vitest

### Tertiary (LOW confidence)
- None -- all findings verified with official docs or local testing.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Bun 1.3.11 verified installed, all APIs tested locally
- Architecture: HIGH -- patterns proven in reference project (agent-bar-omarchy) and verified with local tests
- Pitfalls: HIGH -- socket permissions issue verified fixed in installed version, Bun.serve vs Bun.listen distinction confirmed via type definitions and testing

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (Bun runtime is fast-moving but core APIs are stable)

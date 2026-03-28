# Stack Research: Bun Migration & Refactor

**Domain:** Linux-native AI usage monitor -- Node.js-to-Bun migration, dependency reduction, TypeScript CLI lifecycle commands
**Researched:** 2026-03-28
**Confidence:** HIGH

## Recommended Stack

### Core Runtime

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Bun | 1.3.11 | Runtime, package manager, test runner, bundler | Matches reference codebase (agent-bar-omarchy), eliminates tsc build step, native TypeScript execution, built-in test runner replaces vitest, built-in PTY support (v1.3.5+) eliminates node-pty. Current latest stable as of 2026-03-18. |
| TypeScript | 5.9.3 | Type checking only (via `bun x tsc --noEmit`) | Bun executes .ts directly; TypeScript is only needed for `--noEmit` type-checking during CI/dev. Match reference codebase version. |

### PTY Solution: `Bun.spawn({ terminal })` -- Native Built-in

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Bun.Terminal API | Built-in (v1.3.5+) | PTY allocation for interactive CLI commands | **Replaces node-pty entirely.** No native addon compilation, no build-essential dependency, zero external deps. Works on Linux/macOS (POSIX). Provides `write()`, `resize()`, `setRawMode()`, `close()`. Available since Bun v1.3.5 (Dec 2025). |

**Confidence: HIGH** -- Verified via official Bun docs at [bun.com/docs/runtime/child-process](https://bun.com/docs/runtime/child-process).

**Migration pattern from node-pty to Bun.Terminal:**

```typescript
// BEFORE: node-pty (current codebase)
import pty from "node-pty";
const term = pty.spawn(command, args, { cols: 120, rows: 30, env });
term.onData((chunk) => { output += chunk; });
term.write(input);
term.onExit(({ exitCode }) => { /* resolve */ });

// AFTER: Bun.Terminal (v2.0)
const proc = Bun.spawn([command, ...args], {
  env,
  terminal: {
    cols: 120,
    rows: 30,
    data(_terminal, chunk) { output += new TextDecoder().decode(chunk); },
    exit() { /* resolve */ },
  },
});
proc.terminal.write(input);
const exitCode = await proc.exited;
```

**Critical architectural note:** The reference codebase (agent-bar-omarchy) does NOT use PTY at all for providers. Instead:
- **Claude:** Reads `~/.claude/.credentials.json` directly, calls the Anthropic HTTP API (`fetch()`) -- no CLI interaction needed.
- **Codex:** Reads session `.jsonl` files from `~/.codex/sessions/` and uses `child_process.spawn('codex', ['app-server'])` over stdio (JSON-RPC, no PTY needed).
- **Amp:** Uses `Bun.spawn([bin, 'usage'])` with stdout pipe -- no PTY needed.

The current agent-bar-usage already has both paths implemented (`claude-api-fetcher.ts` + `codex-appserver-fetcher.ts`). The v2.0 migration should **prefer these non-PTY paths as primary** and keep `Bun.Terminal` only as a fallback for edge cases. This eliminates the PTY dependency entirely for the happy path.

### CLI & TUI

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| @clack/prompts | 1.1.0 | Interactive TUI for setup/remove/update commands | Used by reference codebase. Beautiful, minimal API surface (intro, outro, confirm, select, spinner, note, log). Published 2026-03-03. Works with Bun (confirmed by reference codebase production use). |

**Confidence: MEDIUM** -- @clack/prompts has had intermittent Bun stdin issues (GitHub issues #4835, #24615), but the reference codebase runs it in production with Bun. The key is: interactive prompts run in a terminal (user-facing), NOT in systemd services, so stdin is always available.

**Manual CLI parsing replaces Commander.** The reference codebase demonstrates the exact pattern: a `parseArgs()` function with a switch statement over `process.argv.slice(2)`, Levenshtein-based typo suggestions, and typed return value. Zero dependencies needed. See `/home/othavio/Work/agent-bar-omarchy/src/cli.ts`.

### Development Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| Biome | 2.4.9 | Linter + formatter (replaces ESLint + Prettier) | 10-100x faster than ESLint. Single config file. Type-aware linting in v2+. Used by reference codebase. Install as devDependency: `@biomejs/biome`. |
| bun test | Built-in | Test runner (replaces vitest) | Jest-compatible API (`describe`, `it`, `expect`, `mock`). 3-10x faster than vitest. Snapshot testing, lifecycle hooks. No extra dependency needed. |
| @types/bun | latest | Bun type definitions for TypeScript | Provides types for `Bun.spawn`, `Bun.file`, `Bun.Terminal`, `Bun.Glob`, etc. |

### Supporting Libraries (Retained)

| Library | Version | Purpose | Bun Compatible | Notes |
|---------|---------|---------|----------------|-------|
| ora | 9.3.0 | Spinner for non-interactive contexts (systemd logs) | Yes | Optional -- @clack/prompts has its own spinner for TUI contexts. Keep for non-TUI output if needed. |

### Node.js APIs Used via Bun Compatibility Layer

| Module | Bun Status | Usage in Project |
|--------|-----------|-----------------|
| `node:child_process` | Partially supported (missing `proc.gid`/`proc.uid` only) | Codex app-server spawn -- works fine |
| `node:fs` / `node:fs/promises` | Fully supported (92% test suite) | Config files, credentials -- works fine. Prefer `Bun.file()` for new code. |
| `node:os` | Fully supported (100% test suite) | `homedir()` -- works fine |
| `node:path` | Fully supported (100% test suite) | Path manipulation -- works fine |
| `node:readline` | Fully supported | JSON-RPC line parsing in Codex app-server -- works fine |
| `node:http` | Fully supported | HTTP server for backend -- works fine. Can migrate to `Bun.serve()` later. |
| `node:net` | Fully supported | Unix socket IPC -- works fine |

**Confidence: HIGH** -- Verified via [bun.com/docs/runtime/nodejs-compat](https://bun.com/docs/runtime/nodejs-compat).

## Installation

```bash
# Install Bun globally (if not already)
curl -fsSL https://bun.sh/install | bash

# Core dependencies (production)
bun add @clack/prompts@1.1.0

# Dev dependencies
bun add -D @biomejs/biome@2.4.9 @types/bun typescript@5.9.3
```

**No build step needed.** Bun executes TypeScript directly. The `tsc` invocation is only for type-checking (`--noEmit`).

## Dependencies Removed

| Removed | Reason | Replacement |
|---------|--------|-------------|
| commander (14.0.x) | Unnecessary abstraction for simple CLI routing | Manual `parseArgs()` function -- 150 lines, zero deps, with typo suggestions. Pattern proven in reference codebase. |
| zod (3.25.x) | Over-engineered for config/API validation | Inline validation with type guards and assertion functions. Config shapes are known at compile time. API responses get defensive field-by-field checks (reference codebase pattern). |
| node-pty (1.0.x) | Native addon requiring build-essential + Python | `Bun.Terminal` API (built-in) for fallback PTY. Primary path uses HTTP API / file reads / stdio spawn (no PTY needed). |
| vitest (3.2.x) | External test runner dependency | `bun test` built-in runner -- Jest-compatible, faster, zero deps. |
| tsx (4.x) | TypeScript execution for Node.js | Bun executes .ts natively -- tsx is unnecessary. |
| @types/node (24.x) | Node.js type definitions | `@types/bun` replaces this. Bun re-exports most Node.js types. |

**Dependency count: from 4 production deps to 1** (`@clack/prompts`). Dev deps: from 4 to 3 (`@biomejs/biome`, `@types/bun`, `typescript`).

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| node-pty | Native C++ addon that requires `build-essential` + `python3` to compile. 34% native addon compatibility rate with Bun. Eliminated by the reference codebase entirely. | `Bun.Terminal` API for the rare PTY fallback. Prefer HTTP API / file read / stdio spawn for all provider data fetching. |
| Commander | Adds 15KB+ for something that is 150 lines of hand-written code. The CLI surface is simple enough that a framework adds complexity, not value. | Manual `parseArgs()` with switch statement. See reference at `/home/othavio/Work/agent-bar-omarchy/src/cli.ts`. |
| Zod | 55KB+ library for validation that can be done with 20-line type guard functions. Adds compile-time cost and bundle weight. Every config field is known at design time. | TypeScript type guards + inline assertions. `if (typeof x !== 'string') throw new Error(...)`. |
| bun-pty (npm) | Third-party package using Rust FFI. Immature (low download count), unnecessary now that Bun has native Terminal API. | `Bun.Terminal` API (built-in, maintained by Oven team). |
| ESLint + Prettier | Two tools, slow, complex config. Biome does both in one tool, 100x faster. | Biome 2.4.9 -- single `biome.json`, lints + formats in one pass. |
| pnpm (as package manager) | Bun's built-in package manager is faster and supports workspaces. Running two package managers adds confusion. | `bun install` -- supports workspace:* protocol, npm registry, lockfile (`bun.lock`). |

## Bun + systemd Compatibility

**Confidence: HIGH** -- Official docs at [bun.com/docs/guides/ecosystem/systemd](https://bun.com/docs/guides/ecosystem/systemd).

Bun works as a systemd service with the `simple` service type. The service file pattern:

```ini
[Unit]
Description=Agent Bar Backend
After=network.target

[Service]
Type=simple
User=%i
WorkingDirectory=/path/to/agent-bar-usage
ExecStart=/home/USER/.bun/bin/bun run src/service/service-server.ts
Restart=always
RestartSec=5

# Environment capture (same pattern as current Node.js service)
Environment=DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/%U/bus
EnvironmentFile=-/home/%i/.config/agent-bar/env

[Install]
WantedBy=default.target
```

**Key differences from current Node.js service:**
1. `ExecStart` changes from `node dist/service-server.js` to `bun run src/service-server.ts` -- no build step needed.
2. Bun binary path is typically `~/.bun/bin/bun` (installed via curl script) rather than system Node.js.
3. No `node_modules/.bin` path manipulation needed for the entry point.
4. Same `Environment` / `EnvironmentFile` patterns work identically.

**Caveats:**
- Bun binary must be installed per-user (not system-wide by default). The `setup` command should verify `~/.bun/bin/bun` exists.
- `bun run src/file.ts` executes TypeScript directly -- no pre-compilation step. The systemd service runs the source files.

## Workspace Structure Migration

**From:** pnpm monorepo with `apps/backend`, `apps/gnome-extension`, `packages/shared-contract`
**To:** Bun workspace with simplified structure

The reference codebase is a **flat single-package** structure (not a monorepo). For agent-bar-usage, the recommendation depends on whether the `shared-contract` package adds value:

**Option A (Recommended): Flatten to single package + separate gnome-extension**
```
agent-bar-usage/
  package.json          # Bun workspace root
  src/                  # Backend + CLI (was apps/backend/src)
  gnome-extension/      # GJS extension (no Bun deps, just GJS)
  tests/
  biome.json
  tsconfig.json
```

**Rationale:** The `shared-contract` package exists primarily to share Zod schemas between backend and gnome-extension. With Zod removed, the contract becomes a simple TypeScript interface file that can live in `src/contracts/`. The gnome-extension is GJS (not TypeScript) and doesn't import from `shared-contract` at build time -- it reads JSON over the Unix socket at runtime.

**Option B: Keep workspaces**
```json
{
  "name": "agent-bar-usage",
  "private": true,
  "workspaces": ["apps/*", "packages/*"]
}
```

Bun supports `workspace:*` protocol identically to pnpm. But this adds complexity for no clear benefit in a 2-person, 1-backend project.

## Version Compatibility Matrix

| Package | Requires | Compatible With | Notes |
|---------|----------|-----------------|-------|
| Bun 1.3.11 | Linux x64/arm64, macOS | TypeScript 5.9.x | Terminal API requires POSIX (Linux/macOS) |
| @clack/prompts 1.1.0 | Bun 1.3.0+ | Bun 1.3.11 | Avoid Bun 1.3.2 specifically (stdin EPERM bug). 1.3.11 is safe. |
| @biomejs/biome 2.4.9 | Node 18+ or Bun | TypeScript 5.x | Standalone binary, no runtime dependency. Type-aware linting in v2+. |
| TypeScript 5.9.3 | - | Bun 1.3.x | Used only for `--noEmit` type checking |

## Stack Patterns by Context

**For provider data fetching (systemd service context):**
- Use `fetch()` for HTTP APIs (Claude usage endpoint)
- Use `Bun.file()` for reading credential/session files (Claude credentials, Codex session logs)
- Use `Bun.spawn()` with stdio pipes for CLI tools (Codex app-server JSON-RPC)
- **Do NOT use PTY** -- no terminal exists in systemd context. The reference codebase proves all 3 providers work without PTY.

**For user-facing CLI commands (terminal context):**
- Use `@clack/prompts` for interactive flows (setup, remove, update, auth)
- Use `Bun.Terminal` API only if a provider truly requires PTY interaction (no current provider does)
- Use `Bun.spawn()` with stdout pipe for non-interactive subprocesses (git fetch, bun install)

**For test execution:**
- Use `bun test` directly
- Mock with `bun:test` built-in mock functions
- Use `Bun.file()` for fixture file access in tests

## Sources

- [Bun docs: Spawn / Terminal API](https://bun.com/docs/runtime/child-process) -- PTY support via `terminal` option, verified HIGH confidence
- [Bun docs: systemd guide](https://bun.com/docs/guides/ecosystem/systemd) -- Service file template, verified HIGH confidence
- [Bun docs: Node.js compatibility](https://bun.com/docs/runtime/nodejs-compat) -- Module compat matrix, verified HIGH confidence
- [Bun docs: Workspaces](https://bun.com/docs/guides/install/workspaces) -- Workspace config, verified HIGH confidence
- [Bun blog: v1.3.5](https://bun.com/blog/bun-v1.3.5) -- Bun.Terminal API introduction (Dec 2025), verified HIGH confidence
- [Bun releases](https://github.com/oven-sh/bun/releases) -- Latest v1.3.11 (March 18, 2026), verified HIGH confidence
- [Bun compatibility 2026](https://dev.to/alexcloudstar/bun-compatibility-in-2026-what-actually-works-what-does-not-and-when-to-switch-23eb) -- Native addon 34% compat rate, MEDIUM confidence (blog post)
- [@clack/prompts npm](https://www.npmjs.com/package/@clack/prompts) -- v1.1.0 published 2026-03-03, verified HIGH confidence
- [Biome](https://biomejs.dev/) -- v2.4.9 with 465 lint rules, verified HIGH confidence
- [bun:test docs](https://bun.com/docs/test) -- Jest-compatible test runner, verified HIGH confidence
- Reference codebase: `/home/othavio/Work/agent-bar-omarchy/` -- Production-proven Bun patterns, HIGH confidence (first-party code)

---
*Stack research for: Bun Migration & Refactor -- Agent Bar Ubuntu v2.0*
*Researched: 2026-03-28*

# Pitfalls Research

**Domain:** Node.js-to-Bun migration for a Linux systemd-based AI usage monitor with GNOME Shell extension frontend
**Researched:** 2026-03-28
**Confidence:** MEDIUM-HIGH (Bun Terminal API is new/December 2025; Unix socket edge cases verified via open issues)

## Critical Pitfalls

### Pitfall 1: node-pty Is Not Bun-Compatible -- Bun.Terminal API Has Different Semantics

**What goes wrong:**
node-pty is a native N-API addon compiled against V8. Bun uses JavaScriptCore, not V8, so native N-API addon compatibility sits at roughly 34% according to ecosystem surveys. node-pty will almost certainly fail to load under Bun. The project currently uses `node-pty` in `interactive-command.ts` to run Codex CLI and Claude CLI commands inside a PTY from systemd (where no controlling terminal exists). A naive migration attempt would simply try to `import("node-pty")` under Bun and crash at runtime.

**Why it happens:**
Bun's N-API layer is incomplete for addons that depend on V8-specific internals. node-pty compiles C++ that calls `forkpty()` and binds through V8's N-API -- this binary is fundamentally incompatible with Bun's JavaScriptCore engine.

**How to avoid:**
Replace node-pty with Bun's built-in Terminal API (`Bun.spawn` with the `terminal` option), introduced in Bun v1.3.5 (December 2025). The API provides equivalent PTY functionality: `Bun.spawn(["codex", "usage"], { terminal: { cols: 120, rows: 30, data: (term, data) => { output += data.toString(); } } })`. Key differences from node-pty to handle during migration:
- Output arrives via a callback in the `terminal.data` option, not via an `onData` event emitter
- Exit is awaited via `await proc.exited` (returns exit code), not via an `onExit` callback
- Input is written via `proc.terminal.write()`, not `term.write()`
- Cleanup requires `proc.terminal.close()` explicitly
- Only available on POSIX (Linux/macOS) -- not Windows, but that is irrelevant for this Ubuntu-only product

Create the Bun Terminal wrapper first and validate it against Codex CLI and Claude CLI output parsing before removing node-pty from dependencies.

**Warning signs:**
- `dynamic import failed` or `Module not found: node-pty` at runtime under Bun
- Existing `interactive-command.ts` tests pass under Node but fail under Bun
- Provider fetchers for Codex and Claude return empty/unparseable output

**Phase to address:**
Phase 1 (Bun runtime migration) -- this is the single most critical blocker since two of three providers depend on PTY execution.

---

### Pitfall 2: Unix Socket Permissions Differ Between Bun and Node.js

**What goes wrong:**
The backend service communicates with the GNOME extension via a Unix domain socket created with `net.createServer` (see `service-server.ts`). Bun's `node:net` implementation creates socket files with different permissions than Node.js (confirmed in [oven-sh/bun#15686](https://github.com/oven-sh/bun/issues/15686), still open). The GNOME extension runs as the desktop user via `Gio.SubprocessLauncher`, so if the socket permissions are wrong, the extension cannot connect to the backend service. This failure is silent -- the extension just sees "backend unavailable" with no useful error.

**Why it happens:**
Bun's internal socket creation uses different `umask`/permission defaults than Node.js's libuv implementation. The socket file might be created with 0755 instead of 0777, or vice versa, preventing the GJS process from reading it.

**How to avoid:**
After creating the socket with `net.createServer`, explicitly `chmod` the socket file to the expected permissions (typically 0600 for user-only access, or 0660 if needed). Add a post-listen permission fix:
```typescript
import { chmod } from "node:fs/promises";
server.listen(socketPath, async () => {
  await chmod(socketPath, 0o600);
});
```
Alternatively, evaluate migrating from `net.createServer` to `Bun.serve({ unix: socketPath })` which has better-tested Unix socket support in Bun. However, this changes the protocol from newline-delimited JSON over raw TCP to HTTP-style request/response, requiring GNOME extension client changes.

**Warning signs:**
- GNOME extension reports "backend unavailable" after migration even though systemd service is running
- `ls -la` on the socket file shows unexpected permissions
- Works when testing directly via `socat` but fails from GJS

**Phase to address:**
Phase 1 (Bun runtime migration) -- must be validated in the same phase where the service server is migrated to Bun.

---

### Pitfall 3: systemd Environment Variable Inheritance Breaks Under Bun

**What goes wrong:**
The current systemd service file (`agent-bar.service`) sets `ExecStart=%h/.local/bin/agent-bar service run` with `Environment=NODE_ENV=production`. The install script captures `PATH`, `DBUS_SESSION_BUS_ADDRESS`, and other user environment variables into a systemd override file. Bun handles environment variables differently than Node.js in systemd contexts:
1. Bun may not find itself in `PATH` if installed via `curl` to `~/.bun/bin/bun` (not in systemd's default PATH)
2. Environment values set via `Environment=` in unit files have been reported to not work correctly with Bun (see [oven-sh/bun#2710](https://github.com/oven-sh/bun/discussions/2710))
3. The `ExecStart` path must point to the Bun binary with an absolute path, not rely on PATH resolution

**Why it happens:**
systemd user services have a minimal environment. Node.js is commonly installed system-wide (via apt/nvm) and appears in `/usr/bin/` or `/usr/local/bin/`. Bun is typically installed per-user at `~/.bun/bin/bun` which is NOT in systemd's default PATH. Additionally, Bun's handling of `Environment=` directives in service files has edge cases that differ from Node.js.

**How to avoid:**
1. Use absolute path to Bun binary in `ExecStart`: `ExecStart=/home/%u/.bun/bin/bun run /home/%u/.local/share/agent-bar/service.ts` (or wherever the compiled binary lands)
2. In the setup command, resolve the Bun binary path with `which bun` and write it into the service file, not rely on PATH
3. Ensure `DBUS_SESSION_BUS_ADDRESS` is captured via `systemctl --user import-environment DBUS_SESSION_BUS_ADDRESS` during setup (critical for `secret-tool` which uses D-Bus)
4. Test the service file on a real Ubuntu VM before shipping -- not just a `bun run` from a terminal

**Warning signs:**
- `systemctl --user status agent-bar` shows `exec format error` or `executable not found`
- Provider fetches work from terminal but fail from systemd service
- `secret-tool` calls fail with D-Bus connection errors only when running as a service

**Phase to address:**
Phase 2 (setup/remove/update commands) and Phase 1 (service migration) -- the service file template must be updated in the same phase as the Bun migration, and the setup command must be hardened to resolve Bun's path.

---

### Pitfall 4: Removing Zod Loses Runtime Validation at the Backend/Extension Boundary

**What goes wrong:**
Zod is used pervasively in `shared-contract` (the package that defines the snapshot envelope, provider schemas, and request types) and in `config-schema.ts`. These schemas serve a dual purpose: (1) TypeScript type inference via `z.infer<>`, and (2) runtime validation of JSON data crossing trust boundaries (backend -> GNOME extension, config file -> backend). Removing Zod without replacing runtime validation means the GNOME extension receives unvalidated JSON from the backend. If a provider returns malformed data, it propagates silently through the extension and causes cryptic GJS crashes or renders garbage in the GNOME panel.

**Why it happens:**
Developers see Zod schemas primarily as type generators and assume TypeScript's compile-time types are sufficient. They strip Zod, keep the `type` exports, and forget that JSON deserialization produces `unknown` at runtime. The GNOME extension is written in GJS (plain JavaScript) and has zero TypeScript protection.

**How to avoid:**
Do NOT remove runtime validation at trust boundaries. Replace Zod with targeted inline validation functions that check the shape of data at two critical points:
1. **Config loading** (`config-loader.ts`): Validate the JSON config file matches expected shape before using it
2. **Snapshot serialization** (`service-server.ts` response, `cli.ts` JSON output): Validate the snapshot envelope before sending it to the extension

For the `shared-contract` package, replace Zod schemas with plain TypeScript interfaces + a `validate(input: unknown): Result<T>` function per type. This matches the agent-bar-omarchy pattern of zero validation deps. Keep validation thin but present:
```typescript
function validateSnapshotEnvelope(input: unknown): SnapshotEnvelope {
  if (typeof input !== "object" || input === null) throw new ValidationError("expected object");
  const obj = input as Record<string, unknown>;
  if (obj.schema_version !== "1") throw new ValidationError("invalid schema_version");
  if (!Array.isArray(obj.providers)) throw new ValidationError("providers must be array");
  // ... validate each provider snapshot
  return obj as SnapshotEnvelope;
}
```

**Warning signs:**
- After removing Zod, backend tests still pass but GNOME extension shows `undefined` or `[object Object]` in the panel
- Config file with a typo silently loads with wrong defaults instead of erroring
- Provider adapter returns `null` for a field the extension assumes is always present

**Phase to address:**
Phase 3 (dependency removal) -- must be done carefully, NOT as a simple `npm uninstall zod`. Write inline validators first, wire them in, verify extension behavior, then remove Zod.

---

### Pitfall 5: Replacing Commander Without Preserving Subcommand Error Handling

**What goes wrong:**
The CLI uses Commander for `usage`, `auth copilot`, `config`, `doctor`, and `service` subcommands. Commander handles: (1) `--help` generation, (2) unknown option rejection, (3) missing subcommand error messages, (4) argument coercion (e.g., `parseProviderId`). A manual `process.argv` parser that doesn't replicate these behaviors produces a CLI that silently ignores typos (`agent-bar usagee` does nothing instead of suggesting `usage`), crashes on unknown flags, or provides no help text.

**Why it happens:**
Manual argument parsing starts simple (`if (args[0] === "usage")`) and developers underestimate how many edge cases Commander handles. The initial manual parser works for happy paths but fails on: empty args, `--help`, `--version`, misspelled commands, `--unknown-flag`, and combined short flags.

**How to avoid:**
Before removing Commander, catalog every CLI behavior the current setup provides:
1. List all commands and their options from `cli.ts` and `commands/*.ts`
2. Document which error messages Commander generates (unknown command, missing arg, etc.)
3. Write the manual parser to handle: (a) unknown commands with a suggestion, (b) `--help` at every level, (c) `--version`, (d) unknown flags with an error, (e) missing required arguments
4. Use the agent-bar-omarchy `cli.ts` as reference -- it already implements manual parsing with `process.argv.slice(2)` and a command map

Write CLI integration tests that exercise error paths BEFORE removing Commander. Run the same test suite after to verify parity.

**Warning signs:**
- `agent-bar --help` produces no output or crashes
- `agent-bar unknowncommand` silently exits with code 0
- `agent-bar auth` (without subcommand) hangs or crashes instead of showing help
- The `setup` command added in v2.0 is unreachable due to parser bugs

**Phase to address:**
Phase 3 (dependency removal) -- Commander removal should happen after the new commands (setup/remove/update) are implemented, so all commands are tested against the new parser simultaneously.

---

### Pitfall 6: Developing on Non-Ubuntu Without a Validated Ubuntu Test Environment

**What goes wrong:**
PROJECT.md explicitly states "Dev machine is NOT Ubuntu." This means:
1. GNOME Shell extension cannot be tested locally (requires GNOME Shell + GJS runtime)
2. systemd user services cannot be tested locally (requires systemd --user)
3. `secret-tool` / GNOME Keyring integration cannot be tested locally
4. D-Bus session bus behavior is untestable locally
5. Provider CLIs (codex, claude) may behave differently on non-Ubuntu distros
6. Bun binary location and PATH differ between distros and macOS

The developer writes code that works on their machine, pushes to the Ubuntu target, and discovers fundamental breakage: the service won't start, the extension can't find the binary, or `secret-tool` returns nothing because D-Bus isn't forwarded.

**Why it happens:**
The feedback loop is too long. Changes require: push -> SSH/deploy to Ubuntu -> test manually -> debug via journalctl. Without an automated Ubuntu validation step, regressions accumulate silently.

**How to avoid:**
1. **Mandatory:** Set up an Ubuntu 24.04 VM or container (Distrobox, LXD, or QEMU) for integration testing. Not optional -- the GNOME extension and systemd service CANNOT be validated any other way
2. **Minimum viable CI:** A GitHub Actions job on `ubuntu-24.04` that: installs Bun, runs backend tests, starts the service, sends a snapshot request to the socket, verifies JSON output
3. **Layered testing strategy:**
   - Unit tests (provider parsers, config validation) -- run on dev machine with Bun
   - Integration tests (service start/stop, socket communication) -- run on Ubuntu VM/CI
   - E2E tests (GNOME extension -> service -> providers) -- manual on Ubuntu with GNOME desktop
4. **Script the deployment:** The setup command should be testable on the VM with one command, not a manual multi-step process

**Warning signs:**
- "It works when I run it manually" but fails under systemd
- Extension tests require mocking `Gio` so heavily that the mocks hide real bugs
- Provider fetchers work on Arch/Fedora/macOS but fail on Ubuntu due to different CLI binary locations

**Phase to address:**
Phase 0 (environment setup) -- establish the Ubuntu test environment BEFORE writing any migration code. Every subsequent phase depends on this.

---

### Pitfall 7: Monorepo Structure Mismatch Between pnpm Workspaces and Bun

**What goes wrong:**
The current project uses pnpm workspaces with three packages: `apps/backend`, `apps/gnome-extension`, and `packages/shared-contract`. The backend imports `shared-contract` as `"shared-contract": "workspace:*"`. Bun supports workspaces but the migration from pnpm has subtle differences:
1. `workspace:*` protocol is supported but resolved differently -- Bun uses `bun.lock` instead of `pnpm-lock.yaml`
2. The `shared-contract` package has a separate `tsc` build step (`build:shared`) that produces `dist/` -- Bun can run TypeScript directly, making this step potentially unnecessary but only if imports are updated
3. The `exports` field in `shared-contract/package.json` maps `"."` to `{ "types": "./src/index.ts", "default": "./dist/index.js" }` -- under Bun's module resolution, it might resolve to the `.ts` source directly, skipping the build step and making the `dist/` output stale

**Why it happens:**
Bun's package resolution prefers TypeScript source files when available, which is great for DX but breaks assumptions about build order. The developer removes the `build:shared` step thinking Bun handles it, then the production build (which might still use `dist/`) breaks.

**How to avoid:**
Decide early: flatten the monorepo or keep workspaces. Given that v2.0 is removing dependencies and simplifying:
1. **Recommended:** Flatten `shared-contract` into the backend as a local `src/contract/` directory. The GNOME extension already duplicates the contract via JSON parsing (it doesn't import `shared-contract` -- it just expects a specific JSON shape). This eliminates the workspace complexity entirely
2. **If keeping workspaces:** Run `bun install` and verify it correctly migrates `pnpm-lock.yaml` to `bun.lock`. Update the `exports` field to point to `.ts` source directly. Remove the separate build step

**Warning signs:**
- `bun install` in the workspace root produces warnings about unresolved workspace references
- Import errors like `Cannot find module 'shared-contract'` at runtime
- Stale `dist/` files cause type mismatches between backend and contract

**Phase to address:**
Phase 1 (Bun runtime migration) -- the workspace/monorepo structure must be resolved before any other code changes, since every import depends on it.

---

### Pitfall 8: GNOME Extension Backend Command Resolution Hardcodes Node.js

**What goes wrong:**
The GNOME extension's `backend-command.js` has a fallback mode (`workspace-dev`) that runs: `[nodeBinary, "--import", "tsx", joinPath(repoRoot, BACKEND_CLI_RELATIVE_PATH), ...args]`. The `nodeBinary` defaults to `findProgramInPath("node") ?? "node"`. After migrating to Bun, the installed binary will be `agent-bar` (backed by Bun), but the dev-mode fallback still looks for `node`. If the developer tests with the workspace-dev path, the extension tries to run the Bun/TypeScript code with Node.js (which may not have the right deps installed after migration), producing confusing errors.

Additionally, the `installed` mode uses `findProgramInPath("agent-bar")` -- this path works regardless of runtime, but the binary itself now needs Bun in its shebang or be a Bun-compiled binary.

**Why it happens:**
The GNOME extension is plain GJS/JavaScript -- it was written to invoke Node.js and doesn't know about Bun. The runtime migration changes the backend but the extension's subprocess invocation logic is a separate codebase that isn't automatically updated.

**How to avoid:**
1. Update `backend-command.js` to detect whether `bun` is available and prefer it over `node`
2. Change the workspace-dev fallback to: `[bunBinary, "run", cliPath, ...args]` (Bun runs `.ts` files directly, no `tsx` needed)
3. For the installed mode, ensure the `agent-bar` binary has the correct shebang (`#!/usr/bin/env bun`) or is a Bun-compiled single-file executable
4. Test both modes: installed (from `~/.local/bin/agent-bar`) and workspace-dev (from the repo checkout)

**Warning signs:**
- Extension works in installed mode but crashes in dev mode (or vice versa)
- Extension logs show `node: command not found` or `tsx: module not found`
- Manual `agent-bar usage --json` works from terminal but fails from the extension

**Phase to address:**
Phase 1 (Bun runtime migration) -- must be updated alongside the backend migration since the extension calls the backend.

---

### Pitfall 9: Provider Decoupling Creates Circular or Missing Dependencies

**What goes wrong:**
The v2.0 goal is "providers 100% independent -- zero coupling between Copilot, Codex, Claude." The current providers share:
- `providers/shared/interactive-command.ts` (PTY execution)
- `core/backend-coordinator.ts` (orchestrates all providers)
- `core/provider-adapter.ts` (common adapter interface with `env: NodeJS.ProcessEnv`)
- `shared-contract` schemas (snapshot format)
- `cache/` module (shared cache)
- `secrets/` module (shared secret store)

Decoupling providers means each provider must own its execution strategy, but they still need shared infrastructure (cache, secrets, config). The pitfall is over-decoupling: duplicating cache logic per provider, or creating a provider interface so abstract that adding a new provider requires implementing 15 methods. Alternatively, under-decoupling: pulling out the `shared/` directory but leaving implicit dependencies through the coordinator.

**Why it happens:**
"Independent modules" is interpreted as "zero shared code," which is wrong. The goal is "zero runtime coupling" (Copilot failing doesn't affect Claude) not "zero shared infrastructure."

**How to avoid:**
Define "independent" precisely:
1. **Each provider is a self-contained module** that exports a single function: `async fetchUsage(context: ProviderContext): Promise<ProviderSnapshot>`
2. **Shared infrastructure is injected**, not imported: cache, secrets, config, and env are passed via the `ProviderContext` parameter
3. **The coordinator calls providers in parallel** with `Promise.allSettled()`, so one provider's failure is isolated
4. **No provider imports another provider** -- this is the actual coupling to prevent
5. Follow agent-bar-omarchy's pattern: each provider file (`claude.ts`, `codex.ts`, `copilot.ts`) is standalone with a `class XProvider implements Provider { async getQuota(): Promise<ProviderQuota> }` interface

**Warning signs:**
- A provider module has an `import` from another provider's directory
- Adding a new provider requires modifying files outside the provider's own directory (besides registration)
- A provider's unit test requires mocking other providers to run

**Phase to address:**
Phase 4 (provider independence) -- but the provider interface contract should be designed in Phase 1 so that the Bun Terminal wrapper and cache module are built with the independent-provider pattern in mind.

---

### Pitfall 10: Bun's `import.meta.main` Replaces Node's Entrypoint Detection

**What goes wrong:**
The current CLI entrypoint uses `if (import.meta.url === \`file://\${process.argv[1]}\`)` to detect whether the file is being run directly. This is a Node.js idiom. Under Bun, the correct check is `if (import.meta.main)`. If not updated, the CLI parser never runs when invoked via `bun run cli.ts`, because `import.meta.url` and `process.argv[1]` may not match under Bun's module resolution.

Additionally, Bun 1.2.21+ has a known issue where compiled binaries include an extra argument in `process.argv`, which can break argument parsing if the manual parser assumes `process.argv[2]` is the first user argument.

**Why it happens:**
Small API differences between runtimes that aren't caught by TypeScript (both are valid JavaScript). The entrypoint check seems to work in some cases but fails in others (compiled binary vs. `bun run`).

**How to avoid:**
1. Replace `import.meta.url === \`file://\${process.argv[1]}\`` with `import.meta.main` (Bun's official recommendation)
2. When building the manual CLI parser, use `Bun.argv` or `process.argv.slice(2)` consistently, and test with both `bun run src/cli.ts` and the compiled/installed binary
3. Add a smoke test that runs the CLI with `bun run` and verifies `usage --json` produces valid JSON

**Warning signs:**
- `bun run src/cli.ts usage --json` produces no output (entrypoint guard prevents execution)
- CLI arguments are off-by-one (first argument is swallowed or duplicated)
- Works via `bun run` but breaks when compiled with `bun build --compile`

**Phase to address:**
Phase 1 (Bun runtime migration) -- this is one of the first things to fix when switching the runtime.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep `node:net` Unix socket instead of migrating to `Bun.serve({ unix })` | Less code change, socket protocol stays the same | Inherits Bun's `node:net` compatibility gaps (permissions, reliability issues in #14836) | Acceptable for v2.0 if permission fix is applied; revisit in v2.1 |
| Skip runtime validation after removing Zod | Fewer lines of code, faster startup | Silent data corruption at backend/extension boundary | Never -- always validate at trust boundaries |
| Use `bun run src/cli.ts` in systemd instead of a compiled binary | Simpler deployment, no build step | Slower startup (parses TypeScript every time), depends on Bun's module resolution | Only during development; production must use compiled binary or at minimum a pre-transpiled JS entry |
| Test only on dev machine, skip Ubuntu VM | Faster iteration cycle | Accumulates "works on my machine" bugs in systemd, D-Bus, GNOME integration | Never for integration-level changes |
| Duplicate shared infrastructure in each provider instead of injecting it | Each provider is truly standalone | Cache, config, and secret logic maintained in 3 places; bugs fixed in one place don't propagate | Never -- use dependency injection |
| Remove the `shared-contract` package but keep Zod in the backend | Simplifies the monorepo | Inconsistent: some validation with Zod, some without; confusing for contributors | Never -- make a clean cut |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GNOME Keyring / `secret-tool` | Assuming D-Bus session bus is available in systemd service | Capture `DBUS_SESSION_BUS_ADDRESS` at install time and inject into systemd override via `systemctl --user import-environment` |
| GitHub Device Flow OAuth (Copilot) | Hardcoding the poll interval; not handling `slow_down` response | Respect the `interval` field in the device code response; add exponential backoff on `slow_down`; this already works but must survive the migration |
| Codex CLI (`codex usage`) | Expecting PTY output format to be stable across Codex versions | Parse defensively with fallbacks; the ANSI-stripping and line normalization in `interactive-command.ts` must be migrated to the Bun Terminal wrapper |
| Claude CLI (`claude usage`) | Assuming Claude CLI is always at `/usr/local/bin/claude` | Resolve via `which claude` or PATH lookup; Bun's `Bun.which("claude")` API is a clean replacement for the current `resolveCommandInPath` utility |
| GJS <-> Backend socket communication | Sending multiple JSON messages on the same connection without delimiters | Use newline-delimited JSON (current protocol) and ensure Bun's socket implementation sends the full message atomically |
| Bun binary resolution in GNOME extension | Looking for `node` binary when the backend now runs on Bun | Update `backend-command.js` to check for `bun` first, fall back to `node` only for backward compatibility |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Spawning a PTY per provider fetch | Slow refresh cycles (3 PTY spawns = 3+ seconds) | Cache aggressively with TTL; agent-bar-omarchy uses 5-minute cache. Only spawn PTY when cache is stale | At auto-refresh intervals < 60s with 3 providers |
| Re-parsing TypeScript on every systemd restart | 500ms+ startup time on low-end Ubuntu machines | Use `bun build --compile` for production or pre-transpile to JS | Noticeable when service restarts frequently (crash loops) |
| GNOME extension polling backend too frequently | High CPU usage visible in GNOME System Monitor; users blame the extension | Default poll interval >= 120s; make it configurable; respect system idle state | When poll interval < 30s |
| Full snapshot refresh when only one provider changed | Unnecessary PTY spawns for providers that haven't changed | Per-provider cache with independent TTLs; refresh only the requested provider | When adding more providers in future versions |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing GitHub OAuth token in plaintext config file instead of GNOME Keyring | Token exposed to any process reading `~/.config/agent-bar/config.json` | Always use `secret-tool store` for tokens; never write tokens to disk in plaintext. The current `secret-tool-store.ts` implementation is correct -- preserve it |
| Unix socket world-readable (0777 permissions) | Any process on the machine can send commands to the backend service | Socket should be 0600 (owner-only); verify after Bun migration since Bun creates sockets with different permissions |
| Logging OAuth tokens or API keys in journalctl output | Tokens visible in `journalctl --user -u agent-bar` to any user with journal access | Scrub tokens from log output; use `[REDACTED]` for sensitive values; the current logging is careful about this but migration might introduce new log sites |
| `DEFAULT_CLIENT_ID` placeholder shipped to production | Users authenticate with a shared client ID; GitHub may rate-limit or revoke it | Register a dedicated GitHub OAuth App before public release (already flagged in PROJECT.md) |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| `agent-bar setup` fails silently when Bun is not installed | User thinks setup succeeded but service never starts | Check for Bun binary existence at setup start; provide clear install instructions with `curl -fsSL https://bun.sh/install \| bash` |
| `agent-bar update` overwrites user config without backup | User loses custom provider settings after update | Backup config to `config.json.bak` before overwriting; merge settings where possible |
| GNOME extension shows stale data without indicating staleness | User sees "75% used" but it's from 2 hours ago | Show timestamp of last successful refresh; dim/gray out data older than configured threshold |
| Error messages from provider failures are too technical | User sees "EPIPE: broken pipe" in the GNOME panel | Map internal errors to user-friendly messages: "Codex CLI not found -- install with `npm i -g @openai/codex`" |
| `agent-bar remove` also removes stored secrets | User reinstalls and has to re-authenticate all providers | `remove` should preserve GNOME Keyring entries; add `--purge` flag for full cleanup |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Bun runtime migration:** Backend runs under `bun run` locally -- verify it also runs under `systemctl --user start agent-bar` on Ubuntu with correct env vars
- [ ] **PTY replacement:** Codex CLI returns usage data via Bun Terminal -- verify ANSI stripping and line normalization produce identical parsed results to the node-pty implementation
- [ ] **Commander removal:** `agent-bar usage --json` works -- verify `agent-bar --help`, `agent-bar auth --help`, `agent-bar unknowncmd`, and `agent-bar` (no args) all produce correct output
- [ ] **Zod removal:** Config loads correctly -- verify malformed config files produce actionable error messages instead of cryptic crashes
- [ ] **Provider independence:** Each provider fetches data independently -- verify that disabling one provider doesn't affect others, and that `Promise.allSettled` is used (not `Promise.all`)
- [ ] **GNOME extension compatibility:** Extension loads and shows data -- verify it finds the Bun-backed `agent-bar` binary, not a stale Node.js one
- [ ] **Socket communication:** Backend responds to socket requests -- verify socket file permissions allow GJS process to connect
- [ ] **Auto-refresh:** Timer fires and refreshes data -- verify it works from systemd (not just from terminal), and respects TTL to avoid over-fetching
- [ ] **Setup command:** `agent-bar setup` completes successfully -- verify it creates the systemd service file with the correct Bun path, enables the service, and the GNOME extension can immediately communicate with it

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| node-pty crashes under Bun | LOW | Already planned: replace with Bun Terminal API. If Bun Terminal API has issues, fallback to `Bun.spawn` with `stdio: "pipe"` (loses PTY but works for CLIs that don't require it) |
| Socket permissions wrong | LOW | `chmod 0600 /run/user/$UID/agent-bar/agent-bar.sock` and add the chmod to the service startup code |
| systemd can't find Bun | LOW | Add `Environment=PATH=/home/user/.bun/bin:/usr/local/bin:/usr/bin` to the service override file |
| Zod removed but validation missing | MEDIUM | Add validation back at the two critical boundaries (config load, snapshot serialize). Can be done incrementally without re-adding Zod |
| Commander removed but CLI broken | MEDIUM | The old Commander-based CLI can coexist temporarily. Ship the manual parser behind a feature flag or environment variable until it's validated |
| Provider coupling not fully broken | MEDIUM | Audit imports with `grep -r "from.*providers/" src/providers/` -- any cross-provider import is a coupling violation. Fix by extracting to shared infrastructure |
| GNOME extension can't find backend | LOW | Update `backend-command.js` to add `bun` to the binary search list. Quick fix, but must be deployed to the extension |
| Ubuntu-specific bug discovered late | HIGH | If no Ubuntu VM exists, recovery requires setting one up under pressure. Prevention (Phase 0 VM setup) is far cheaper |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| node-pty incompatibility (#1) | Phase 1: Bun migration | Codex and Claude CLI fetchers return valid parsed data under Bun |
| Unix socket permissions (#2) | Phase 1: Bun migration | `ls -la` on socket shows expected permissions; extension connects successfully |
| systemd env vars (#3) | Phase 1 + Phase 2: setup command | `systemctl --user status agent-bar` shows active; `journalctl` shows no env errors |
| Zod removal loses validation (#4) | Phase 3: dependency removal | Malformed config produces clear error; malformed provider response is caught before reaching extension |
| Commander removal breaks CLI (#5) | Phase 3: dependency removal | CLI integration tests cover: --help, unknown command, missing args, all subcommands |
| Non-Ubuntu dev environment (#6) | Phase 0: environment setup | Ubuntu VM or CI job exists and runs integration tests on every push |
| Monorepo structure mismatch (#7) | Phase 1: Bun migration | `bun install` resolves all workspace references; `bun run` executes without import errors |
| GNOME extension hardcodes Node (#8) | Phase 1: Bun migration | Extension's `resolveBackendInvocation` returns Bun-based argv; dev mode works without Node installed |
| Provider over/under-decoupling (#9) | Phase 4: provider independence | `grep -r "from.*providers/" src/providers/` returns zero cross-provider imports; each provider has standalone unit tests |
| Entrypoint detection (#10) | Phase 1: Bun migration | `bun run src/cli.ts usage --json` produces valid output; compiled binary produces same output |

## Sources

- [Bun Node-API documentation](https://bun.com/docs/runtime/node-api) - N-API compatibility status (HIGH confidence)
- [Bun v1.3.5 release blog - Terminal API](https://bun.com/blog/bun-v1.3.5) - Built-in PTY support (HIGH confidence)
- [Bun spawn/child_process docs](https://bun.com/docs/runtime/child-process) - Terminal option API surface (HIGH confidence)
- [Bun systemd guide](https://bun.com/docs/guides/ecosystem/systemd) - Official service file template (HIGH confidence)
- [oven-sh/bun#15686 - Socket permissions differ](https://github.com/oven-sh/bun/issues/15686) - Unix socket permissions bug (HIGH confidence, open issue)
- [oven-sh/bun#2710 - Environment values in systemd](https://github.com/oven-sh/bun/discussions/2710) - systemd env handling (MEDIUM confidence)
- [oven-sh/bun#4446 - SEGV in systemd service](https://github.com/oven-sh/bun/issues/4446) - Stability concern (MEDIUM confidence, may be fixed)
- [oven-sh/bun#22157 - Extra argv in compiled binaries](https://github.com/oven-sh/bun/issues/22157) - process.argv edge case (HIGH confidence)
- [Bun entrypoint detection guide](https://bun.com/docs/guides/util/entrypoint) - import.meta.main usage (HIGH confidence)
- [Bun workspaces documentation](https://bun.com/docs/pm/workspaces) - Workspace support (HIGH confidence)
- [Bun compatibility 2026](https://dev.to/alexcloudstar/bun-compatibility-in-2026-what-actually-works-what-does-not-and-when-to-switch-23eb) - Native addon compatibility at 34% (MEDIUM confidence)
- [GJS subprocess guide](https://gjs.guide/guides/gio/subprocesses.html) - Gio.Subprocess usage in GNOME extensions (HIGH confidence)
- [systemd user services - ArchWiki](https://wiki.archlinux.org/title/Systemd/User) - Environment import and D-Bus setup (HIGH confidence)
- [Bun production deployment guide](https://oneuptime.com/blog/post/2026-01-31-bun-production-deployment/view) - Deployment best practices (MEDIUM confidence)
- [Bun vs Node.js production comparison](https://dev.to/synsun/bun-vs-nodejs-in-production-what-three-months-of-real-traffic-taught-me-3d96) - Real-world migration lessons (MEDIUM confidence)

---
*Pitfalls research for: Node.js-to-Bun migration of Agent Bar Ubuntu (systemd service + GNOME Shell extension)*
*Researched: 2026-03-28*

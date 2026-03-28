# Project Research Summary

**Project:** Agent Bar Ubuntu v2.0 (Bun Migration & Refactor)
**Domain:** Linux-native AI provider usage monitor -- Node.js-to-Bun migration with dependency reduction, CLI lifecycle commands, and GNOME Shell extension frontend
**Researched:** 2026-03-28
**Confidence:** HIGH

## Executive Summary

Agent Bar Ubuntu is a Linux-native desktop tool that surfaces AI provider usage (Copilot, Codex, Claude) through a GNOME Shell extension backed by a systemd user service. The v2.0 milestone is fundamentally a **runtime migration and dependency reduction**: moving from Node.js to Bun, replacing 4 production dependencies with 1 (`@clack/prompts`), and rewriting monolithic bash installation scripts as testable TypeScript lifecycle commands. A proven reference codebase (agent-bar-omarchy) already runs in production on Bun with the exact patterns needed, making this a port-and-adapt effort rather than greenfield design.

The recommended approach is phased: first migrate the runtime to Bun and flatten the monorepo structure, then build the lifecycle commands (setup, remove, update) using `@clack/prompts`, then remove Commander and Zod dependencies with inline replacements, and finally decouple providers into fully independent modules. This ordering is dictated by hard dependency chains -- the CLI commands need the Bun runtime, the dependency removals need the new commands in place to test against, and provider independence needs the new cache/settings infrastructure to be stable. The reference codebase provides production-proven code for every major component: manual CLI parsing, file-based cache with TTL, versioned settings with migration, and interactive TUI flows.

The key risks are concentrated in Phase 1 (Bun migration): node-pty is incompatible with Bun and must be replaced with Bun's built-in Terminal API; Unix socket permissions differ between Bun and Node.js and must be explicitly fixed; and the systemd service file must use absolute paths to the Bun binary since it is not in systemd's default PATH. A secondary risk is developing on a non-Ubuntu machine without a validated Ubuntu test environment -- the GNOME extension, systemd service, and `secret-tool` integration cannot be validated without one. Setting up this environment must happen before any code changes.

## Key Findings

### Recommended Stack

The stack migrates from Node.js + pnpm to Bun as a unified runtime, package manager, test runner, and bundler. Bun 1.3.11 executes TypeScript directly (no build step), provides a native Terminal API for PTY (replacing node-pty), and runs reliably as a systemd `simple` service. The critical architectural insight from the reference codebase is that **no current provider actually needs PTY** -- Claude uses HTTP API via `fetch()`, Codex uses app-server over stdio, and Copilot uses HTTP. PTY becomes a fallback path only.

**Core technologies:**
- **Bun 1.3.11:** Runtime, package manager, test runner, bundler -- eliminates tsc build step, native TypeScript execution, built-in PTY support
- **@clack/prompts 1.1.0:** Interactive TUI for setup/remove/update commands -- the single production dependency
- **Biome 2.4.9:** Linter + formatter replacing ESLint + Prettier -- 10-100x faster, single config file
- **TypeScript 5.9.3:** Type checking only via `bun x tsc --noEmit`

**Dependencies eliminated:** Commander (manual CLI parsing), Zod (inline type guards), node-pty (Bun.Terminal API), vitest (bun test), tsx (Bun native), @types/node (@types/bun). Production deps drop from 4 to 1.

### Expected Features

**Must have (table stakes -- v2.0):**
- `setup` command in TypeScript -- replaces monolithic `install-ubuntu.sh` with testable, idempotent installer
- `remove` command -- clean uninstall preserving GNOME Keyring secrets
- `update` command -- highest priority per PROJECT.md; git pull + rebuild + systemd restart
- Provider selection CLI -- choose which providers appear in topbar
- Auto-refresh in backend service -- periodic polling so GNOME extension always gets warm cached data
- Manual CLI parsing -- replaces Commander with proven switch/case + Levenshtein typo suggestions
- Inline validation -- replaces Zod with type guards and assertion functions
- Versioned settings with migration -- prevents config breakage across updates
- Date/time formatting -- human-readable timestamps in terminal and extension

**Should have (differentiators -- v2.x):**
- Interactive TUI menu (`agent-bar menu`) -- high-engagement unified interface
- Rich terminal quota display with Unicode progress bars and ANSI colors
- Provider login TUI flows -- guided auth for each provider
- File-based cache with TTL and fetch deduplication -- warm restarts after service crashes
- `doctor` command with TUI formatting

**Defer (v2.1+):**
- Additional providers (Amp, Cursor) -- wait for provider adapter pattern to prove on Bun
- Historical usage trends -- requires persistent storage beyond cache TTL
- Waybar surface support -- keep GNOME extension as sole surface for now

### Architecture Approach

The architecture is a three-layer system: a GNOME Shell extension (GJS) as read-only display surface, a Bun+TypeScript backend running as a systemd user service, and self-contained provider modules that fetch usage data independently. The GNOME extension communicates with the backend exclusively through subprocess spawning (`agent-bar usage --json`), which is the GNOME-approved IPC pattern. The backend service uses `Bun.serve()` over a Unix socket for fast CLI-to-daemon queries. The `shared-contract` package is eliminated -- the JSON CLI output format is the contract boundary. The monorepo flattens to a single backend package plus the GNOME extension directory.

**Major components:**
1. **CLI Router** -- manual switch/case parsing dispatching to command handlers
2. **BackendCoordinator** -- orchestrates provider fetches with `Promise.allSettled()` through the provider registry
3. **Provider Modules** (Copilot/Codex/Claude) -- self-contained classes implementing `Provider { isAvailable(), getQuota() }`, zero cross-provider imports
4. **File-based Cache** -- per-provider TTL cache in `$XDG_CACHE_HOME/agent-bar/` with fetch deduplication, survives restarts
5. **Service Daemon** -- long-running `Bun.serve()` on Unix socket with auto-refresh timer
6. **Lifecycle Commands** -- setup/remove/update/auth/doctor as standalone TypeScript modules with `@clack/prompts`
7. **GNOME Extension** -- top-bar indicator with polling service, consumes CLI JSON output

### Critical Pitfalls

1. **node-pty is incompatible with Bun** -- Bun's N-API compatibility for native addons is ~34%. Replace with Bun.Terminal API, but prefer HTTP API/file read/stdio spawn paths (no PTY needed for any current provider). Address in Phase 1.
2. **Unix socket permissions differ under Bun** -- Bun creates socket files with different permissions than Node.js (open issue oven-sh/bun#15686). Explicitly `chmod 0600` after socket creation. Address in Phase 1.
3. **systemd cannot find Bun binary** -- Bun installs to `~/.bun/bin/` which is not in systemd's default PATH. Use absolute path in `ExecStart`, resolve Bun path during setup with `which bun`. Address in Phase 1 + Phase 2.
4. **Removing Zod loses runtime validation** -- Zod schemas serve dual purpose (types + runtime validation at trust boundaries). Replace with inline `validate()` functions BEFORE removing Zod, not after. Address in Phase 3.
5. **Non-Ubuntu dev environment** -- GNOME extension, systemd service, and `secret-tool` cannot be validated without Ubuntu. Set up Ubuntu VM or CI job as Phase 0, before any migration code. Address in Phase 0.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 0: Ubuntu Test Environment
**Rationale:** The developer is NOT on Ubuntu. Every subsequent phase produces code that must run on Ubuntu (systemd, GNOME Shell, D-Bus, secret-tool). Without a validated test target, bugs accumulate silently until late integration.
**Delivers:** Ubuntu 24.04 VM or Distrobox container + GitHub Actions CI job running backend tests on `ubuntu-24.04` runner.
**Addresses:** Non-Ubuntu dev environment pitfall (#6)
**Avoids:** "Works on my machine" accumulation across all phases

### Phase 1: Bun Runtime Migration
**Rationale:** Every other phase depends on the Bun runtime being functional. The monorepo structure, entrypoint detection, socket server, and PTY wrapper all must work under Bun before new features can be built.
**Delivers:** Backend runs under Bun; monorepo flattened (shared-contract eliminated); `import.meta.main` entrypoint; `Bun.serve({ unix })` replaces `net.createServer()`; `Bun.Terminal` wrapper replaces node-pty; GNOME extension `backend-command.js` updated to find Bun.
**Addresses:** Monorepo migration, entrypoint detection, socket server migration, PTY replacement
**Avoids:** node-pty incompatibility (#1), Unix socket permissions (#2), monorepo structure mismatch (#7), GNOME extension hardcodes Node (#8), entrypoint detection (#10)

### Phase 2: Lifecycle Commands (setup/remove/update)
**Rationale:** These commands depend on the Bun runtime (Phase 1) and are prerequisites for dependency removal (Phase 3) because they serve as the integration test surface for the new CLI parser. The `update` command is the highest priority feature per PROJECT.md.
**Delivers:** `agent-bar setup` (TypeScript, replaces install-ubuntu.sh), `agent-bar remove` (preserves secrets), `agent-bar update` (git pull + rebuild + restart). Versioned settings with migration. Provider selection CLI (`agent-bar providers`). Backend auto-refresh timer.
**Addresses:** setup, remove, update commands; provider selection; auto-refresh; versioned settings
**Avoids:** systemd env vars pitfall (#3) -- setup resolves Bun path; config backup on update

### Phase 3: Dependency Removal (Commander + Zod)
**Rationale:** Cannot remove Commander until ALL commands (including the new lifecycle commands from Phase 2) exist to test against the replacement parser. Cannot remove Zod until inline validators are wired into the config and snapshot boundaries. Must happen after Phase 2 so there is a complete command surface to validate.
**Delivers:** Manual CLI parser with Levenshtein typo correction; inline validation replacing all Zod schemas; complete CLI help system (`--help` at every level); `uninstall` command (full removal including secrets).
**Addresses:** Manual CLI parsing, inline validation, Commander/Zod removal
**Avoids:** Commander removal breaks CLI (#5), Zod removal loses validation (#4)

### Phase 4: Provider Independence
**Rationale:** The provider interface contract is designed in Phase 1 (types.ts), but the actual decoupling requires stable cache, settings, and coordinator infrastructure from Phases 1-3. This is the final refactor phase.
**Delivers:** Self-contained provider modules (copilot/, codex/, claude/ directories); each provider resolves own credentials; `Promise.allSettled()` isolation; no cross-provider imports; provider auto-discovery via directory convention.
**Addresses:** Provider decoupling, independent testing, future provider extensibility
**Avoids:** Provider over/under-decoupling (#9)

### Phase 5: TUI Polish (v2.x)
**Rationale:** Polish features that depend on all core infrastructure being stable. These are differentiators, not table stakes.
**Delivers:** Interactive TUI menu, rich terminal quota display with progress bars, provider login flows, `doctor` with TUI formatting, file-based cache with TTL.
**Addresses:** All P2 differentiator features from FEATURES.md

### Phase Ordering Rationale

- **Phase 0 before everything:** Ubuntu test environment is the foundation -- without it, every phase risks invisible breakage in systemd, GNOME Shell, and D-Bus integrations.
- **Phase 1 before Phase 2:** Lifecycle commands must run on Bun. The setup command writes a systemd service file pointing to the Bun binary. Cannot build this without Bun runtime working.
- **Phase 2 before Phase 3:** Commander removal requires ALL commands to exist as test surface. If Commander is removed before setup/remove/update exist, there is no way to verify the manual parser handles all subcommands.
- **Phase 3 before Phase 4:** Provider independence requires stable inline validation (no Zod) and the simplified cache/settings modules. Zod removal is a prerequisite for the clean provider interface.
- **Phase 4 before Phase 5:** TUI polish displays provider data. Provider modules must be stable before building rich display surfaces on top of them.
- **Parallel work:** Within Phase 1, cache/config/settings modules can be built in parallel. Within Phase 4, the three providers can be refactored independently.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Bun.serve({ unix }) behavior under systemd -- the net.createServer TCP reliability issues (bun#14836) may also affect Bun.serve in edge cases. Need to validate socket cleanup on service restart.
- **Phase 2:** systemd override file generation and DBUS_SESSION_BUS_ADDRESS capture -- the exact `systemctl --user import-environment` flow needs testing on Ubuntu 24.04 with GNOME 46.
- **Phase 4:** Codex app-server JSON-RPC protocol -- the current implementation uses `child_process.spawn` with readline. Migrating to `Bun.spawn` may have subtle differences in stdio buffering.

Phases with standard patterns (skip research-phase):
- **Phase 0:** Standard Ubuntu VM/CI setup. Well-documented.
- **Phase 3:** Manual CLI parsing and inline validation are well-documented patterns with a complete reference implementation in agent-bar-omarchy.
- **Phase 5:** TUI patterns are fully proven in agent-bar-omarchy. Direct port.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified via official Bun docs + production reference codebase. Bun 1.3.11 is stable. Version compatibility confirmed. |
| Features | HIGH | Feature set derived from reference codebase (proven in production) + current codebase analysis. Dependency graph is clear. |
| Architecture | HIGH | System diagram validated against both codebases. Subprocess IPC pattern is GNOME-approved. Provider interface proven in omarchy. |
| Pitfalls | MEDIUM-HIGH | Bun Terminal API is new (December 2025). Unix socket permissions issue is confirmed via open GitHub issue. systemd env handling has community reports but no authoritative fix documentation. |

**Overall confidence:** HIGH

### Gaps to Address

- **Bun.serve({ unix }) under systemd:** No first-hand validation that `Bun.serve` with Unix socket option works correctly when managed by systemd (socket cleanup on SIGTERM, permissions). Must validate in Phase 1 on the Ubuntu test environment.
- **@clack/prompts Bun stdin edge cases:** Known intermittent issues (bun#4835, bun#24615) with stdin under Bun. The reference codebase works around this but the exact failure conditions are not fully documented. Must validate interactive commands on Ubuntu.
- **Codex app-server availability on Ubuntu:** The `codex app-server` command (JSON-RPC over stdio) is the preferred non-PTY path for Codex. Availability on Ubuntu and behavior under Bun.spawn need validation.
- **Bun compiled binary argv:** Bun 1.2.21+ may include an extra argument in `process.argv` for compiled binaries (bun#22157). The manual CLI parser must account for this if the project ships a compiled binary.
- **GNOME 46 extension compatibility:** The current extension targets GNOME 45. Ubuntu 24.04 ships GNOME 46. Extension metadata and API compatibility need verification.

## Sources

### Primary (HIGH confidence)
- [Bun docs: Spawn / Terminal API](https://bun.com/docs/runtime/child-process) -- PTY support, process spawning
- [Bun docs: systemd guide](https://bun.com/docs/guides/ecosystem/systemd) -- Service file template
- [Bun docs: Node.js compatibility](https://bun.com/docs/runtime/nodejs-compat) -- Module compatibility matrix
- [Bun docs: Workspaces](https://bun.com/docs/guides/install/workspaces) -- Workspace configuration
- [Bun v1.3.5 release](https://bun.com/blog/bun-v1.3.5) -- Bun.Terminal API introduction (Dec 2025)
- [Bun.serve() Unix socket](https://bun.sh/guides/http/fetch-unix) -- Unix socket HTTP server
- [GJS Subprocess guide](https://gjs.guide/guides/gio/subprocesses.html) -- GNOME extension IPC pattern
- [@clack/prompts npm](https://www.npmjs.com/package/@clack/prompts) -- v1.1.0 TUI components
- [Biome](https://biomejs.dev/) -- v2.4.9 linter + formatter
- Reference codebase: agent-bar-omarchy -- Production-proven Bun patterns (first-party code)

### Secondary (MEDIUM confidence)
- [oven-sh/bun#15686](https://github.com/oven-sh/bun/issues/15686) -- Unix socket permissions differ from Node.js
- [oven-sh/bun#2710](https://github.com/oven-sh/bun/discussions/2710) -- systemd environment variable handling
- [oven-sh/bun#22157](https://github.com/oven-sh/bun/issues/22157) -- Extra argv in compiled binaries
- [oven-sh/bun#14836](https://github.com/oven-sh/bun/issues/14836) -- net.createServer TCP reliability
- [Bun compatibility 2026](https://dev.to/alexcloudstar/bun-compatibility-in-2026-what-actually-works-what-does-not-and-when-to-switch-23eb) -- Native addon 34% compat rate

### Tertiary (LOW confidence)
- [GNOME Shell socket example](https://github.com/jeffchannell/gnome-shell-socket) -- Community example of socket IPC from extension
- [bun-pty community library](https://github.com/sursaone/bun-pty) -- Fallback if Bun.Terminal insufficient

---
*Research completed: 2026-03-28*
*Ready for roadmap: yes*

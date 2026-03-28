# Phase 8: Bun Runtime Migration - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Backend service runs entirely on Bun runtime with no Node.js dependency, using Bun-native APIs for PTY, IPC, and TypeScript execution. This phase migrates the existing Node.js/TypeScript backend to Bun, replaces node-pty with Bun.Terminal API, replaces net.createServer with Bun.serve({ unix }), and enables direct .ts execution without a build step.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key research findings to consider:
- Bun v1.3.11+ has native PTY support via Bun.Terminal API (introduced v1.3.5 Dec 2025)
- Bun.serve({ unix }) is the stable IPC path (net.createServer has known reliability issues in Bun)
- Unix socket permissions differ under Bun (oven-sh/bun#15686) — must chmod 0600 after creation
- Bun runs .ts files directly — no esbuild/tsc build step needed for development
- Reference codebase agent-bar-omarchy at /home/othavio/Work/agent-bar-omarchy/ uses Bun successfully

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/backend/src/cli.ts` — CLI entry point (will need Bun shebang)
- `apps/backend/src/service/` — service daemon (socket server to migrate)
- `apps/backend/src/utils/interactive-command.ts` — PTY wrapper (node-pty → Bun.Terminal)
- `packages/shared-contract/` — TypeScript types (keep as workspace package)

### Established Patterns
- pnpm monorepo with workspace protocol
- TypeScript strict mode
- Vitest for testing
- esbuild for bundling (may become optional with Bun)

### Integration Points
- `apps/gnome-extension/services/backend-client.js` — spawns `agent-bar usage --json` subprocess
- `packaging/systemd/user/agent-bar.service` — ExecStart needs Bun path
- `scripts/install-ubuntu.sh` — references node/pnpm (will need Bun references)

</code_context>

<specifics>
## Specific Ideas

- Mirror agent-bar-omarchy runtime patterns: Bun.file, Bun.spawn, Bun.write
- Keep the monorepo structure but update package.json scripts for Bun
- systemd service ExecStart should use `~/.bun/bin/bun` or system Bun path
- Development machine is NOT Ubuntu — ensure Bun migration is testable locally

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

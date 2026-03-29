# Phase 10: CLI Overhaul - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure-style — refactor with locked decisions)

<domain>
## Phase Boundary

Replace Commander with manual CLI argument parsing (switch/case + Levenshtein suggestCommand), remove Zod in favor of inline type guards and assertion functions, add Biome for linting/formatting. All approaches are locked from project-level decisions and mirrored from agent-bar-omarchy patterns.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — approaches are fully defined by prior decisions:

- Manual CLI parsing: mirror omarchy src/cli.ts pattern (parseArgs with switch/case, requireNextArg helper, Levenshtein suggestCommand for typos)
- Help output: box-drawing characters like omarchy showHelp()
- Zod removal: replace all Zod schemas with inline type guards (isProviderId(), assertSnapshotEnvelope()) and normalizeX() functions
- Biome: add @biomejs/biome as devDependency, create biome.json (120 char line width, single quotes like omarchy), replace any existing ESLint/Prettier configs
- Commander removal: remove commander dependency from package.json, rewrite cli.ts to use manual parsing

Key references:
- `/home/othavio/Work/agent-bar-omarchy/src/cli.ts` — parseArgs, showHelp, suggestCommand
- `/home/othavio/Work/agent-bar-omarchy/biome.json` — Biome config
- `apps/backend/src/cli.ts` — current Commander-based CLI to replace
- `packages/shared-contract/src/` — current Zod schemas to replace

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 9 lifecycle commands (setup.ts, update.ts, remove.ts, uninstall.ts) — already imported via lifecycle-command.ts
- Existing config-schema.ts and snapshot.ts have Zod schemas to replace
- omarchy cli.ts has complete manual parsing implementation

### Established Patterns
- Bun runtime (Phase 8)
- @clack/prompts for TUI (Phase 9)
- Commander program.command().action() pattern in current cli.ts

### Integration Points
- apps/backend/src/cli.ts — main entry point to rewrite
- packages/shared-contract/src/snapshot.ts — Zod snapshot schema
- apps/backend/src/config/config-schema.ts — Zod config schema

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond what is already locked — mirror omarchy patterns exactly.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

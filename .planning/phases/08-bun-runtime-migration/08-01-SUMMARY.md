---
phase: 08-bun-runtime-migration
plan: 01
subsystem: infra
tags: [bun, typescript, runtime-migration, tsconfig, systemd]

# Dependency graph
requires: []
provides:
  - Bun runtime configuration (tsconfig, bunfig.toml, package.json)
  - Bun-compatible TypeScript resolution (bundler moduleResolution)
  - shared-contract .ts source exports (no build step for Bun consumers)
  - CLI entry point with Bun shebang and import.meta.main guard
  - systemd service without Node-specific environment
affects: [08-02, 08-03, 09-lifecycle-commands, 10-cli-overhaul]

# Tech tracking
tech-stack:
  added: [bun-types, "@types/bun", bunfig.toml]
  removed: [node-pty, "@types/node", tsx]
  patterns: [bundler-moduleResolution, bun-shebang, import-meta-main, ts-source-exports]

key-files:
  created:
    - apps/backend/bunfig.toml
  modified:
    - tsconfig.base.json
    - apps/backend/tsconfig.json
    - apps/backend/tsconfig.build.json
    - apps/backend/package.json
    - package.json
    - packages/shared-contract/package.json
    - apps/backend/src/cli.ts
    - packaging/systemd/user/agent-bar.service
    - .gitignore
    - bun.lock

key-decisions:
  - "Added bun-types as explicit devDependency alongside @types/bun to ensure TypeScript resolves bun-types in workspace hoisted layout"
  - "Removed bun.lock from .gitignore to track lockfile as part of Bun migration"

patterns-established:
  - "Bun runtime: all backend scripts use bun run, bun x, bun --watch"
  - "TypeScript bundler resolution: moduleResolution bundler, no verbatimModuleSyntax"
  - "TS source exports: shared-contract exports point to .ts source files (no build needed for Bun)"
  - "import.meta.main: Bun-idiomatic entry point guard replaces import.meta.url comparison"

requirements-completed: [RUNTIME-01, RUNTIME-04]

# Metrics
duration: 3min
completed: 2026-03-28
---

# Phase 08 Plan 01: Bun Runtime Infrastructure Summary

**Migrar toda infraestrutura de runtime de Node.js para Bun: tsconfig bundler resolution, bun-types, bunfig.toml, scripts bun run, shebang bun, systemd sem NODE_ENV**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-28T22:18:13Z
- **Completed:** 2026-03-28T22:21:36Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- All TypeScript configs migrated to Bun-compatible settings (ESNext target/module, bundler moduleResolution, bun-types)
- Backend package.json cleaned: node-pty, @types/node, tsx removed; @types/bun and bun-types added; scripts use bun run
- shared-contract exports point to .ts source directly (Bun resolves TypeScript without build)
- CLI entry point uses `#!/usr/bin/env bun` shebang and `import.meta.main` guard
- systemd service unit cleaned of Node-specific `NODE_ENV` environment

## Task Commits

Each task was committed atomically:

1. **Task 1: Update TypeScript and package configs for Bun runtime** - `82866e7` (chore)
2. **Task 2: Update CLI entry point and systemd service for Bun** - `14c684b` (feat)

## Files Created/Modified
- `tsconfig.base.json` - Base TS config: ESNext target/module, bundler moduleResolution
- `apps/backend/tsconfig.json` - Backend TS config: types bun-types
- `apps/backend/tsconfig.build.json` - Build config: types bun-types
- `apps/backend/package.json` - Remove node-pty/@types/node/tsx, add @types/bun/bun-types, bun scripts
- `apps/backend/bunfig.toml` - Bun runtime config (install exact, run silent, test coverage)
- `package.json` - Root: add workspaces field, bun-based build/test scripts
- `packages/shared-contract/package.json` - Exports default to ./src/index.ts (Bun-native)
- `apps/backend/src/cli.ts` - Shebang bun, import.meta.main guard
- `packaging/systemd/user/agent-bar.service` - Remove NODE_ENV=production
- `.gitignore` - Remove bun.lock from ignore list
- `bun.lock` - Bun lockfile (tracked)

## Decisions Made
- Added `bun-types` as explicit devDependency: `@types/bun` depends on `bun-types` but Bun's workspace hoisting doesn't link transitive deps to the backend's node_modules. Without explicit `bun-types`, tsc cannot resolve the type definitions.
- Removed `bun.lock` from `.gitignore`: since Bun is now the project runtime, its lockfile should be version-controlled like any other lockfile.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added bun-types as explicit devDependency**
- **Found during:** Task 1 (TypeScript config update)
- **Issue:** `bun x tsc --noEmit` failed with "Cannot find type definition file for 'bun-types'" because `@types/bun` depends on `bun-types` transitively but Bun's workspace hoisting did not link it to `apps/backend/node_modules/`
- **Fix:** Added `"bun-types": "latest"` to backend devDependencies alongside `@types/bun`
- **Files modified:** apps/backend/package.json
- **Verification:** `bun x tsc --noEmit` resolves bun-types correctly
- **Committed in:** 82866e7 (Task 1 commit)

**2. [Rule 3 - Blocking] Removed bun.lock from .gitignore**
- **Found during:** Task 1 (git commit)
- **Issue:** `bun.lock` was listed in `.gitignore`, preventing the lockfile from being tracked
- **Fix:** Removed `bun.lock` line from `.gitignore`
- **Files modified:** .gitignore
- **Verification:** `git add bun.lock` succeeds
- **Committed in:** 82866e7 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking issues)
**Impact on plan:** Both fixes necessary for Bun runtime to work. No scope creep.

## Known TypeScript Errors (Out of Scope)

The following pre-existing errors appear in `bun x tsc --noEmit` but are NOT caused by this plan's changes:

1. **`node-pty` module not found** in `src/core/prerequisite-checks.ts` and `src/providers/shared/interactive-command.ts` -- node-pty was removed (intentionally). PTY replacement is Phase 08-02 scope.
2. **Bun `fetch` type mismatch** in test files (`test/auth-command.test.ts`, `test/commands/auth-command.test.ts`) -- Bun's fetch type includes `preconnect` which vitest mocks don't satisfy. Test file updates are future plan scope.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Bun runtime infrastructure is in place for all subsequent Phase 08 plans
- Plan 08-02 (PTY replacement with Bun.Terminal) can proceed: bun-types are available, node-pty is removed from deps
- Plan 08-03 (Unix socket migration) can proceed: Bun globals are typed and recognized
- Known TS errors in node-pty-dependent files will be resolved by 08-02

## Self-Check: PASSED

- FOUND: apps/backend/bunfig.toml
- FOUND: bun.lock
- FOUND: 08-01-SUMMARY.md
- FOUND: commit 82866e7
- FOUND: commit 14c684b

---
*Phase: 08-bun-runtime-migration*
*Completed: 2026-03-28*

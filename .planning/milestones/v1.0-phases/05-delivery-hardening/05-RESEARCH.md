# Phase 05: Delivery & Hardening - Research

**Researched:** 2026-03-25
**Domain:** Ubuntu delivery, diagnostics, service startup, and debug hardening for the Node backend + GNOME Shell extension stack
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
### Diagnostics Surface
- **D-01:** Phase 5 should provide diagnostics through both CLI-facing tooling and an explicit failure/prerequisite surface in the GNOME extension.
- **D-02:** Diagnostics should make current Ubuntu failure boundaries actionable: missing CLIs on `PATH`, config/setup issues, `secret-tool` availability, backend subprocess failures, and provider/runtime refresh failures.

### Installation and Delivery
- **D-03:** The primary delivery path for v1 should be a script-assisted installation/setup flow rather than documentation-only setup.
- **D-04:** Installation work should cover the backend and the GNOME extension end-to-end so a user can get to a working desktop surface from one supported flow.
- **D-05:** Written installation and troubleshooting docs are still required, but they should support the script-driven path rather than be the only setup mechanism.

### Runtime Model
- **D-06:** Phase 5 should introduce a real local backend service as part of v1 hardening instead of leaving the extension on an on-demand subprocess-only model.
- **D-07:** Startup/autostart behavior for that service is in scope for this phase and should be treated as part of the supported Ubuntu setup.
- **D-08:** The service path must preserve the existing normalized backend contract; the frontend/backend boundary should not be redefined for Phase 5.

### Independent Debugging
- **D-09:** Phase 5 should provide a minimal, explicit set of separate smoke/debug commands for backend and GNOME extension workflows.
- **D-10:** Independent debugging should stay lightweight in this phase; a larger fixture-heavy dev environment is not required.

### Claude's Discretion
- Exact service/autostart mechanism, as long as it is Ubuntu-native, debuggable, and compatible with the existing contract.
- Exact diagnostics command naming and output layout, as long as failures become inspectable from CLI and desktop paths.
- Exact install script shape and packaging handoff, as long as script-driven setup is the primary supported onboarding path.
- Exact GNOME UI affordance for diagnostics, as long as it makes missing prerequisites and runtime failures understandable from the desktop surface.

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OPS-01 | User can inspect logs or diagnostics that explain provider failures on Ubuntu | Use backend-owned diagnostics output, preserve stderr/exit metadata, and add a desktop failure/prerequisite view fed by the same normalized backend story |
| OPS-02 | User can install and launch the v1 stack on Ubuntu from documented steps | Use one script-assisted flow that installs backend + extension together, validates prerequisites, and is backed by troubleshooting docs |
| OPS-03 | User can run the backend and desktop surface independently for debugging and iteration | Keep explicit backend smoke commands and separate GNOME extension debug path without changing the JSON contract |
</phase_requirements>

## Summary

Phase 5 should harden the existing backend and GNOME extension into one supported Ubuntu flow, not introduce a new architecture. The repo already has the right seams: the backend owns config, secrets, provider diagnostics, and text/JSON output; the GNOME extension already captures argv, cwd, stderr, exit code, and renders a details section. The missing work is operational, not conceptual: install packaging, a real local service, clearer prerequisite inspection, and lightweight separate debug entrypoints.

The strongest plan is to keep the normalized snapshot contract as the only product contract, move steady-state runtime ownership into a user-scoped local service, and make diagnostics visible in two places: CLI inspection commands and a GNOME details/failure surface. Installation should be script-first and end-to-end, with docs explaining the same flow plus a short troubleshooting matrix. The existing workspace-dev `node --import tsx` path should remain a developer fallback only, not the primary supported runtime.

**Primary recommendation:** Ship a `systemd --user` managed backend service, a script-driven Ubuntu installer that validates prerequisites, and a matched CLI + GNOME diagnostics story built on the existing backend contract.

## Project Constraints (from CLAUDE.md)

- Ubuntu-first and Linux-native shell direction is mandatory.
- Backend implementation must stay Node.js + TypeScript.
- Frontend implementation must stay a GNOME Shell extension in GJS.
- The backend/frontend contract must remain independent from GNOME-extension specifics.
- v1 scope stays limited to Copilot, Codex CLI, and Claude CLI.
- Linux secret handling must stay intentional and backend-owned; Apple-specific assumptions are invalid.
- Browser-cookie parity and broader shell parity are not Phase 5 work.
- Substantive repo changes should continue through GSD workflow artifacts.

## Standard Stack

Scope note: this research was intentionally limited to repo files and the direct anchors named in `05-CONTEXT.md`. Versions below are repo-pinned or project-declared versions, not registry-verified latest releases.

### Core
| Library / Tool | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 22 LTS (project architecture target) | Backend runtime target for supported Ubuntu install | `ubuntu-extension-analysis/gjs-node-v1-architecture.md` fixes Node 22 LTS as the backend baseline |
| TypeScript | `^5.9.2` | Backend source language | Already pinned in `apps/backend/package.json`; preserves current code/test tooling |
| commander | `^14.0.2` | Backend CLI parsing | Already owns `agent-bar` command routing in `apps/backend/src/cli.ts` |
| zod | `^3.25.67` | Shared request/snapshot schema validation | Already defines contract strictness in `packages/shared-contract` |
| Vitest | `^3.2.4` | Backend and extension unit tests | Already shared across both workspaces |
| GNOME Shell 46 + GJS | Shell 46, `gjs 1.86.0` on this machine | Ubuntu-native UI runtime | Locked frontend stack and current extension metadata target |
| systemd user service | `systemd 260` available on this machine | Long-lived backend service, autostart, and operational logs | Best fit for D-06/D-07 because it is Ubuntu-native, debuggable, and avoids custom daemon logic |

### Supporting
| Library / Tool | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | `^4.20.5` | Workspace development fallback for direct TS execution | Dev-only fallback when `agent-bar` is not yet installed |
| secret-tool | present, version not reported by CLI | Backend secret lookup | Supported Linux secret-store path; keep env fallback only for development/CI |
| journalctl | `systemd 260` | Inspect backend service logs | Primary operational log surface once service mode lands |
| pnpm | `10.17.1` | Workspace install/test runner | Use for repo setup, tests, and install script build steps |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `systemd --user` service | Custom background shell script or ad-hoc daemonizer | Faster to sketch, worse for restart policy, log inspection, and supported autostart |
| Installed backend binary as primary runtime | Permanent `node --import tsx apps/backend/src/cli.ts` in production | Useful for dev, too fragile for supported install/debug documentation |
| Backend-owned diagnostics + GNOME summary | GNOME-only failure messaging | Hides backend root cause detail and duplicates logic already present in the CLI contract |

**Installation:**
```bash
pnpm install
```

**Version verification:** Scope-limited research. Use repo-pinned versions from `package.json` files and project architecture docs. Registry verification was intentionally not expanded beyond the requested file scope.

## Architecture Patterns

### Recommended Project Structure
```text
apps/
├── backend/          # CLI, service entrypoint, diagnostics, provider/runtime ownership
└── gnome-extension/  # GNOME UI, backend client, menu/details surface
packages/
└── shared-contract/  # Stable request/snapshot/diagnostics contract
scripts/
└── ubuntu-install/   # Phase 5 should add installer, service setup, and verification helpers
```

### Pattern 1: Contract-Preserving Service Boundary
**What:** Keep the normalized snapshot/request schema as the only backend/UI contract even after introducing a long-lived service.
**When to use:** Every service health check, GNOME request path, and CLI debug command in Phase 5.
**Example:**
```typescript
// Source: apps/backend/src/cli.ts
const request = normalizeBackendRequest({
  providers: normalizeProviders(options.provider),
  force_refresh: Boolean(options.refresh),
  include_diagnostics: Boolean(options.diagnostics),
});
```

### Pattern 2: Argv-First Runtime Resolution
**What:** Resolve an installed backend binary first and preserve a workspace-dev fallback for iteration.
**When to use:** GNOME client invocation, backend smoke commands, and installer verification.
**Example:**
```javascript
// Source: apps/gnome-extension/utils/backend-command.js
if (agentBarBinary) {
  return {
    argv: [agentBarBinary, ...usageArgs],
    cwd: dependencies.agentBarCwd ?? repoRoot,
    binary: agentBarBinary,
    mode: "installed",
  };
}
```

### Pattern 3: Backend-Owned Failure Context
**What:** Keep subprocess failure parsing and prerequisite detection in the backend or backend-client boundary, then render that result in the shell.
**When to use:** Missing CLI, secret-store failures, config validation errors, and service health output.
**Example:**
```typescript
// Source: apps/backend/src/utils/subprocess.ts
export function describeSubprocessFailure(error: SubprocessError): string {
  const exitCode = error.result.exitCode ?? "unknown";
  const stderr = error.result.stderr.trim();
  if (stderr.length > 0) {
    return `${error.result.command} failed with exit code ${exitCode}: ${stderr}`;
  }
  return `${error.result.command} failed with exit code ${exitCode}.`;
}
```

### Pattern 4: Thin GNOME Surface Over Rich Backend State
**What:** The extension should keep showing normalized state and error details, not reimplement provider or config checks.
**When to use:** GNOME diagnostics UI, details footer, and independent UI smoke mode.
**Example:**
```javascript
// Source: apps/gnome-extension/panel/menu-builder.js
if (state.lastError) {
  menu.addMenuItem(createMessageItem(`Backend error: ${state.lastError}`, "agent-bar-ubuntu-error-item"));
}
```

### Anti-Patterns to Avoid
- **Service-specific JSON contract:** Do not add a second response model for service mode; keep `shared-contract` authoritative.
- **Production dependence on `tsx`:** Keep direct TS execution as a workspace/dev fallback, not the supported install path.
- **UI-side prerequisite logic:** Do not duplicate config/secret/provider checks in GJS; the backend already owns these failure boundaries.
- **Docs-only onboarding:** D-03 explicitly rejects this; the script must be the supported path and docs explain it.
- **Custom daemon management:** Do not hand-roll process supervision or log rotation when `systemd --user` already provides it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Backend autostart | Custom shell loop, background `nohup`, or PID-file manager | `systemd --user` unit + restart policy | Native autostart, lifecycle control, and log inspection are already solved there |
| Operational logs | Ad-hoc log files as the primary surface | Backend stderr + `journalctl` for service logs | Matches current subprocess/error capture model and avoids file-path drift |
| Diagnostics schema | Separate debug-only payload | Existing `diagnostics` block in `shared-contract` | Keeps CLI, service, and GNOME surfaces aligned |
| Config/secrets checks | UI-specific validators | `agent-bar config validate`, `agent-bar config dump`, and backend secret resolution | Current backend already owns config path and secret-store behavior |
| GNOME extension packaging layout | Custom install layout | Standard extension metadata + user extension directory | Current extension already has correct UUID/metadata shape |

**Key insight:** Phase 5 is mostly about operationalizing boundaries the repo already has. New code should assemble service/install/debug flows around those boundaries, not replace them.

## Common Pitfalls

### Pitfall 1: Installed Runtime and Dev Runtime Drift
**What goes wrong:** The extension works in a workspace through `node --import tsx`, but the documented install path fails because no installed `agent-bar` runtime exists or behaves differently.
**Why it happens:** `apps/gnome-extension/utils/backend-command.js` intentionally supports both modes.
**How to avoid:** Make one installed binary/service path the supported runtime and explicitly mark `tsx` fallback as dev-only.
**Warning signs:** GNOME only works from the repo root; docs mention source checkout as a normal user requirement.

### Pitfall 2: Diagnostics Stop at "Backend Error"
**What goes wrong:** The shell only shows opaque failure text and users still need to guess whether the issue is missing CLI, config, or secret-store setup.
**Why it happens:** Today the extension shows `state.lastError`, but prerequisite-specific inspection commands are still thin.
**How to avoid:** Add explicit backend diagnostics commands and map missing-prerequisite classes into concise desktop details.
**Warning signs:** Errors contain raw stderr only; there is no single command that answers "what prerequisite is missing?"

### Pitfall 3: Service Mode Breaks the Product Contract
**What goes wrong:** Introducing a service adds service-only response types or extension-specific transport behavior.
**Why it happens:** Service work is often treated as a new API instead of a new runtime owner.
**How to avoid:** Reuse `shared-contract` request/snapshot types for service health and fetch behavior.
**Warning signs:** New DTOs appear outside `packages/shared-contract`; UI logic starts branching on transport mode.

### Pitfall 4: Install Script Does Work but Does Not Verify
**What goes wrong:** Setup appears complete, but the backend cannot find `secret-tool`, required CLIs, or the extension was not enabled correctly.
**Why it happens:** Installer scripts often copy files but skip end-to-end health checks.
**How to avoid:** End the script with explicit verification commands for backend config, service health, and extension enablement.
**Warning signs:** Docs say "restart GNOME and try it" without a concrete health command.

### Pitfall 5: Backend and UI Debug Paths Are Entangled
**What goes wrong:** Developers have to launch the full product to test a backend change or inspect a UI rendering issue.
**Why it happens:** No explicit smoke/debug commands are documented.
**How to avoid:** Publish a minimal command set: backend JSON/text smoke, service status/logs, and extension reload/debug steps.
**Warning signs:** Troubleshooting instructions always require both the service and extension running together.

## Code Examples

Verified repo patterns to extend in Phase 5:

### Optional Diagnostics in the Existing CLI Contract
```typescript
// Source: apps/backend/src/cli.ts
program
  .command("usage")
  .option("--diagnostics", "Include provider diagnostics in the output")
```

### Existing Config Inspection Surface
```typescript
// Source: apps/backend/src/commands/config-command.ts
configCommand
  .command("validate")
  .description("Validate config schema and path resolution.");

configCommand
  .command("dump")
  .description("Dump sanitized effective config as JSON.");
```

### Existing Installed-vs-Dev Invocation Split
```javascript
// Source: apps/gnome-extension/utils/backend-command.js
return {
  argv: [nodeBinary, "--import", "tsx", joinPath(repoRoot, BACKEND_CLI_RELATIVE_PATH), ...usageArgs],
  cwd: backendPackageRoot,
  binary: nodeBinary,
  mode: "workspace-dev",
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| On-demand subprocess calls from the extension only | Real local backend service is now a locked Phase 5 requirement | 2026-03-25 discuss-phase decisions | Delivery work must add service supervision without redefining the contract |
| Docs-only setup | Script-assisted install is now the primary supported flow | 2026-03-25 discuss-phase decisions | Phase 5 needs an installer plus docs that explain the same path |
| Generic backend error footer | CLI diagnostics plus explicit GNOME failure/prerequisite affordance | 2026-03-25 discuss-phase decisions | Backend and UI work must land together for OPS-01 |

**Deprecated/outdated:**
- Permanent workspace `tsx` execution as the main user runtime: acceptable for development, not acceptable as the supported Ubuntu v1 install story.
- Extension-only troubleshooting: insufficient once Phase 5 owns service startup and operational diagnostics.

## Open Questions

1. **What is the exact supported artifact for the backend install path?**
   - What we know: D-03/D-04 require one script-assisted end-to-end flow.
   - What's unclear: whether the script installs from local source, a packed Node artifact, or both with one declared primary path.
   - Recommendation: planner should choose one supported v1 install path and mark the other as dev-only.

2. **How much service state should exist outside the current snapshot/config model?**
   - What we know: config path is fixed under XDG and current cache/diagnostics live in backend memory/output.
   - What's unclear: whether service mode needs persistent runtime/cache files beyond config and secrets.
   - Recommendation: default to journald for logs and in-memory runtime state first; only add persistent service state if a concrete failure mode requires it.

3. **How explicit should GNOME diagnostics be before it becomes a full settings UI?**
   - What we know: D-01 requires an explicit desktop failure/prerequisite surface, but D-10 keeps debugging lightweight.
   - What's unclear: whether the GNOME affordance is a richer details section, dedicated diagnostic rows, or a menu action that prints exact commands.
   - Recommendation: keep it in the menu/details surface for v1 and avoid building a broader preferences app in this phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend runtime and workspace dev commands | Yes | `v25.7.0` | Target docs should still pin Node 22 LTS |
| pnpm | Workspace install/tests | Yes | `10.17.1` | `npm` exists, but repo is configured for pnpm |
| npm | Package registry/tooling support | Yes | `11.12.0` | `pnpm` remains primary |
| GJS | GNOME extension runtime | Yes | `gjs 1.86.0` | None for GNOME extension runtime |
| `gnome-extensions` CLI | Install/enable/debug convenience for extension | No | - | Manual extension copy/enable path must exist in docs |
| `secret-tool` | Linux secret-store lookup | Yes | version not reported by CLI | Existing env fallback for development/CI only |
| `systemctl` | User service lifecycle | Yes | `systemd 260` | None recommended |
| `journalctl` | Service log inspection | Yes | `systemd 260` | None recommended |

**Missing dependencies with no fallback:**
- None from the current code path, but a supported GNOME extension runtime still assumes GNOME Shell itself on the target Ubuntu machine.

**Missing dependencies with fallback:**
- `gnome-extensions` CLI is missing on this machine; planner should keep a manual extension install/enable path in the docs and optionally script it when the CLI is available.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `3.2.4` |
| Config file | `apps/backend/vitest.config.ts`, `apps/gnome-extension/vitest.config.ts` |
| Quick run command | `pnpm --filter backend test` |
| Full suite command | `pnpm --filter backend test` then `pnpm --filter gnome-extension test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPS-01 | Inspectable provider failure diagnostics and missing prerequisites | unit + CLI smoke | `pnpm --filter backend test` | Partial - current backend tests exist, Phase 5 diagnostics coverage is missing |
| OPS-02 | Install and launch backend + GNOME surface from documented steps | manual + smoke | none - Wave 0 | No - Wave 0 |
| OPS-03 | Backend and desktop surface can be debugged independently | unit + smoke | `pnpm --filter backend test` and `pnpm --filter gnome-extension test` | Partial - separate unit suites exist, debug-command coverage is missing |

### Sampling Rate
- **Per task commit:** `pnpm --filter backend test` for backend-only work or `pnpm --filter gnome-extension test` for shell-only work
- **Per wave merge:** run both workspace test suites
- **Phase gate:** both suites green plus one documented end-to-end install/service smoke run before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Add backend tests for new diagnostics/service commands and prerequisite classification.
- [ ] Add GNOME tests for richer failure/prerequisite rendering beyond the current `state.lastError` footer.
- [ ] Add at least one install/service verification script or smoke harness that checks supported setup commands.
- [ ] Add explicit manual verification checklist for service startup, log inspection, and extension reload workflow.

## Sources

### Primary (HIGH confidence)
- `.planning/phases/05-delivery-hardening/05-CONTEXT.md` - locked decisions, discretion, canonical refs
- `.planning/REQUIREMENTS.md` - `OPS-01`, `OPS-02`, `OPS-03`
- `.planning/STATE.md` - carried-forward decisions and current blockers
- `.planning/PROJECT.md` - platform, stack, and scope constraints
- `.planning/ROADMAP.md` - phase goal, success criteria, and plan slots
- `.planning/phases/02-linux-config-secrets/02-VERIFICATION.md` - existing config/secret inspection baseline
- `.planning/phases/04-ubuntu-desktop-surface/04-01-SUMMARY.md` - GNOME scaffold patterns
- `.planning/phases/04-ubuntu-desktop-surface/04-02-SUMMARY.md` - backend bridge and invocation model
- `.planning/phases/04-ubuntu-desktop-surface/04-03-SUMMARY.md` - current details/error rendering path
- `ubuntu-extension-analysis/ubuntu-extension-direction.md` - backend-first Ubuntu direction
- `ubuntu-extension-analysis/gjs-node-v1-architecture.md` - project architecture target and stack
- `apps/backend/src/cli.ts` - current CLI contract and diagnostics flag
- `apps/backend/src/commands/config-command.ts` - current inspection commands
- `apps/backend/src/config/config-path.ts` - authoritative XDG config path
- `apps/backend/src/utils/subprocess.ts` - subprocess failure description and PATH resolution
- `apps/backend/src/secrets/secret-tool-store.ts` - Linux secret-store failure model
- `apps/gnome-extension/utils/backend-command.js` - installed vs workspace runtime split
- `apps/gnome-extension/services/backend-client.js` - stderr/exit capture in shell boundary
- `apps/gnome-extension/panel/menu-builder.js` - current details/error surface

### Secondary (MEDIUM confidence)
- Local environment audit on 2026-03-25 for `node`, `pnpm`, `npm`, `gjs`, `systemctl`, `journalctl`, `secret-tool`, and `gnome-extensions`

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - repo evidence is strong, but package versions were not registry-verified because scope was intentionally narrowed
- Architecture: HIGH - the phase context, architecture docs, and direct code anchors are aligned
- Pitfalls: HIGH - they are direct consequences of the current dual-runtime, thin-shell, and missing-install-service state

**Research date:** 2026-03-25
**Valid until:** 2026-04-24

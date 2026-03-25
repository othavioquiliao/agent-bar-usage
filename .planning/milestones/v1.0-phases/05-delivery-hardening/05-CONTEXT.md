# Phase 5: Delivery & Hardening - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the Ubuntu v1 stack installable, diagnosable, and operationally maintainable beyond a local prototype. This phase covers operational diagnostics, install/setup flow, backend startup model, and separate backend/extension debugging paths. It does not expand provider scope, revisit browser-parity work, or add new product surfaces beyond what is necessary to harden the existing backend plus GNOME Shell extension stack.

</domain>

<decisions>
## Implementation Decisions

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

### the agent's Discretion
- Exact service/autostart mechanism, as long as it is Ubuntu-native, debuggable, and compatible with the existing contract.
- Exact diagnostics command naming and output layout, as long as failures become inspectable from CLI and desktop paths.
- Exact install script shape and packaging handoff, as long as script-driven setup is the primary supported onboarding path.
- Exact GNOME UI affordance for diagnostics, as long as it makes missing prerequisites and runtime failures understandable from the desktop surface.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product scope and requirements
- `.planning/PROJECT.md` — stack constraints, product direction, and v1 non-goals
- `.planning/ROADMAP.md` — Phase 5 goal, success criteria, and plan slots
- `.planning/REQUIREMENTS.md` — `OPS-01`, `OPS-02`, and `OPS-03`
- `.planning/STATE.md` — carried-forward decisions and current execution position

### Prior phase outputs
- `.planning/phases/02-linux-config-secrets/02-VERIFICATION.md` — XDG config path, secret-store behavior, and inspectable config commands already verified
- `.planning/phases/04-ubuntu-desktop-surface/04-01-SUMMARY.md` — GNOME extension scaffold and lifecycle baseline
- `.planning/phases/04-ubuntu-desktop-surface/04-02-SUMMARY.md` — backend bridge and polling model
- `.planning/phases/04-ubuntu-desktop-surface/04-03-SUMMARY.md` — current top-bar UI, details menu, and refresh/error surface

### Architecture and runtime direction
- `ubuntu-extension-analysis/ubuntu-extension-direction.md` — CLI-first vs local-service tradeoff and Ubuntu-native shell direction
- `ubuntu-extension-analysis/gjs-node-v1-architecture.md` — backend/extension boundary and workspace shape for the Ubuntu product

### Current implementation anchors
- `apps/backend/src/cli.ts` — current backend CLI surface and contract-preserving entrypoint
- `apps/backend/src/commands/config-command.ts` — existing `config validate` and `config dump` inspection path
- `apps/backend/src/config/config-path.ts` — authoritative XDG config location policy
- `apps/backend/src/utils/subprocess.ts` — shared subprocess execution, timing, and failure description
- `apps/backend/src/secrets/secret-tool-store.ts` — structured Linux secret-store failure handling
- `apps/gnome-extension/utils/backend-command.js` — current backend invocation resolution from the extension
- `apps/gnome-extension/services/backend-client.js` — extension-side subprocess bridge and captured stderr/exit context
- `apps/gnome-extension/panel/menu-builder.js` — current details/error rendering path in the GNOME menu

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/backend/src/cli.ts`: already exposes `usage`, `config validate`, and `config dump`, making it the natural anchor for diagnostics and install verification commands.
- `apps/backend/src/formatters/text-formatter.ts`: already renders diagnostics attempts in text mode and can support a human-readable troubleshooting path.
- `apps/backend/src/utils/subprocess.ts`: already captures stdout, stderr, exit code, and duration for subprocess work, which is useful for diagnostics and service health checks.
- `apps/backend/src/secrets/secret-tool-store.ts`: already converts Linux secret-store failures into structured backend errors that can be surfaced to users.
- `apps/gnome-extension/services/backend-client.js`: already captures backend exit code/stderr and is the natural place to adapt from subprocess invocation to a service-aware client boundary.
- `apps/gnome-extension/panel/menu-builder.js`: already has a details section and backend error display path that can host more actionable diagnostics.

### Established Patterns
- The backend CLI remains the canonical contract boundary even when the shell is GNOME-native.
- Configuration and secret handling are backend-owned and intentionally Linux-specific via XDG paths and `secret-tool`.
- The GNOME extension consumes normalized snapshots and backend errors rather than provider-specific logic.
- Development currently supports both an installed `agent-bar` path and a workspace `tsx` fallback.

### Integration Points
- A new service/autostart path will likely touch `apps/backend/src/cli.ts` and `apps/gnome-extension/utils/backend-command.js` first, because those are the current runtime entry boundaries.
- Diagnostics should connect backend-side inspection commands with extension-side details/error rendering so CLI and desktop troubleshooting tell the same story.
- Installation/hardening work must coordinate XDG config path, `secret-tool` prerequisites, backend service lifecycle, and GNOME extension enablement in one supported flow.

</code_context>

<specifics>
## Specific Ideas

- Prefer a script-assisted install path over a docs-only onboarding flow.
- Land the local backend service in this phase rather than keeping it as a later optional refinement.
- Keep backend/extension debug support simple and explicit: a small set of smoke/debug commands is enough.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---
*Phase: 05-delivery-hardening*
*Context gathered: 2026-03-25*

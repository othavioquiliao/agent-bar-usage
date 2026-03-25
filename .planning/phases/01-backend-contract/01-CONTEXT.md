# Phase 1: Backend Contract - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Define the Linux backend contract that produces stable provider snapshots and refresh metadata independent of any Ubuntu desktop shell. This phase now targets a new Node.js/TypeScript backend implementation. GNOME Shell extension work, Linux secret storage, and provider breadth beyond the first backend contract remain outside this phase.

</domain>

<decisions>
## Implementation Decisions

### Backend shape
- **D-01:** Phase 1 will be CLI-first and stateless at the contract boundary, using a command/bin interface as the canonical backend entrypoint.
- **D-02:** The internal design must remain daemon-ready so a local service can be added later without redefining the public snapshot contract.
- **D-03:** The backend implementation must use Node.js + TypeScript. No Swift implementation should be added for the Ubuntu product.

### Frontend boundary
- **D-04:** The primary desktop surface will be a GNOME Shell extension in GJS targeting Ubuntu 24.04.4 LTS.
- **D-05:** The GNOME extension is not part of Phase 1 implementation, but the backend contract must be designed specifically for GNOME-side consumption.

### Output contract
- **D-06:** JSON and human-readable output are both first-class outputs of the backend contract.
- **D-07:** JSON remains mandatory and stable for downstream UI integration even when text output is provided for humans.

### Snapshot schema
- **D-08:** The normalized snapshot should be "rich controlled": usage summary, `source`, `updated_at`, structured error state, reset window when available, and an optional diagnostics block.
- **D-09:** Deep diagnostics should be nested and optional rather than always-on top-level payload noise.

### Refresh behavior
- **D-10:** Default reads may use a short-lived cache/TTL.
- **D-11:** The contract must expose an explicit forced-refresh path that bypasses cache.

### Reuse model
- **D-12:** `CodexBar/` is now a behavior and architecture reference only. The provider pipeline, source-mode model, and diagnostics patterns may be mirrored, but Phase 1 should not depend on Swift code reuse.

### the agent's Discretion
- Exact field names and JSON nesting, as long as dual-output and rich-controlled semantics are preserved
- Exact TTL duration, provided it stays short and is documented
- Exact human-readable output layout and verbosity defaults
- Exact Node workspace layout, provided it clearly separates backend runtime, shared contract, and future GNOME consumer boundary

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope
- `.planning/PROJECT.md` — Ubuntu product direction, chosen stack, and explicit non-goals
- `.planning/REQUIREMENTS.md` — Phase 1 requirements `BACK-01`, `BACK-02`, and `BACK-03`
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, and plan breakdown

### Brownfield analysis
- `.planning/codebase/ARCHITECTURE.md` — workspace model and reference-code separation
- `.planning/codebase/STRUCTURE.md` — where the reference repo lives in the workspace
- `ubuntu-extension-analysis/codexbar-project-analysis.md` — detailed explanation of `CodexBarCore`, `CodexBarCLI`, and the reusable provider patterns
- `ubuntu-extension-analysis/provider-analysis.md` — portability order and fetch-style constraints for first-wave providers
- `ubuntu-extension-analysis/ubuntu-extension-direction.md` — updated Ubuntu architecture direction and chosen stack
- `ubuntu-extension-analysis/gjs-node-v1-architecture.md` — concrete v1 folder layout, module boundaries, and JSON contract

</canonical_refs>

<code_context>
## Existing Code Insights

### Reference patterns to mirror
- `CodexBar/Sources/CodexBarCLI/CLIUsageCommand.swift` — useful example of provider iteration and dual output behavior
- `CodexBar/Sources/CodexBarCore/Providers/ProviderDescriptor.swift` — useful example of provider metadata and registration boundaries
- `CodexBar/Sources/CodexBarCore/Providers/ProviderFetchPlan.swift` — useful example of source modes, attempts, and fallback mechanics
- `CodexBar/Sources/CodexBarCore/Host/PTY/TTYCommandRunner.swift` — useful example of how CLI-backed providers need careful subprocess handling

### Established patterns
- Provider behavior should be centralized in adapter/descriptor-driven orchestration rather than in the frontend
- JSON and human-readable output should be rendered from the same normalized model
- Fetch attempts and fallback metadata are valuable, but should stay under optional diagnostics
- Cache/TTL behavior should sit above provider execution so polling does not force real fetches on every read

### Integration points
- The Ubuntu backend contract should be implemented in a root-level Node/TypeScript workspace, not inside the nested Swift repo
- The first backend contract should preserve enough structure that a later daemon can expose the same schema with minimal translation
- The GNOME extension should only consume the contract, not provider-specific raw payloads

</code_context>

<specifics>
## Specific Ideas

The chosen frontend/backend split is now explicit:

- backend CLI in Node.js/TypeScript
- GNOME Shell extension in GJS
- JSON contract between them

</specifics>

<deferred>
## Deferred Ideas

- GNOME Shell extension implementation details
- Linux secret storage choice
- Cursor and browser-cookie parity

</deferred>

---

*Phase: 01-backend-contract*
*Context gathered: 2026-03-25*

# Phase 1: Backend Contract - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Define the Linux backend contract that produces stable provider snapshots and refresh metadata independent of any Ubuntu desktop shell. This phase clarifies the executable/backend shape, output contract, snapshot depth, and refresh behavior; provider auth breadth, Linux secret storage, and GNOME-facing UI remain outside this phase.

</domain>

<decisions>
## Implementation Decisions

### Backend shape
- **D-01:** Phase 1 will be CLI-first and stateless at the contract boundary, using a command/bin interface as the canonical backend entrypoint.
- **D-02:** The internal design must remain daemon-ready so a local service can be added later without redefining the public snapshot contract.

### Output contract
- **D-03:** JSON and human-readable output are both first-class outputs of the backend contract.
- **D-04:** JSON remains mandatory and stable for downstream UI integration even when text output is provided for humans.

### Snapshot schema
- **D-05:** The normalized snapshot should be "rich controlled": usage summary, `source`, `updated_at`, structured error state, reset window when available, and an optional diagnostics block.
- **D-06:** Deep diagnostics should be nested and optional rather than always-on top-level payload noise.

### Refresh behavior
- **D-07:** Default reads may use a short-lived cache/TTL.
- **D-08:** The contract must expose an explicit forced-refresh path that bypasses cache.

### the agent's Discretion
- Exact field names and JSON nesting, as long as dual-output and rich-controlled semantics are preserved
- Exact TTL duration, provided it stays short and is documented
- Exact human-readable output layout and verbosity defaults

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope
- `.planning/PROJECT.md` — Ubuntu product direction, reuse boundaries, and explicit non-goals
- `.planning/REQUIREMENTS.md` — Phase 1 requirements `BACK-01`, `BACK-02`, and `BACK-03`
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, and plan breakdown

### Brownfield analysis
- `.planning/codebase/ARCHITECTURE.md` — workspace model, backend/shell separation, and Linux support constraints
- `.planning/codebase/STACK.md` — actual runtime/toolchain constraints around Swift, Linux, and CLI reuse
- `.planning/codebase/STRUCTURE.md` — where reusable backend code lives and how the nested repo is organized
- `ubuntu-extension-analysis/codexbar-project-analysis.md` — detailed explanation of `CodexBarCore`, `CodexBarCLI`, and reusable refresh/provider architecture
- `ubuntu-extension-analysis/provider-analysis.md` — portability order and fetch-style constraints for first-wave providers
- `ubuntu-extension-analysis/ubuntu-extension-direction.md` — Ubuntu-first architecture recommendation and backend-first direction

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CodexBar/Sources/CodexBarCLI/CLIEntry.swift` — cross-platform CLI entrypoint and command routing pattern already proven on Linux
- `CodexBar/Sources/CodexBarCLI/CLIUsageCommand.swift` — existing provider iteration, source override, and dual-output handling pattern
- `CodexBar/Sources/CodexBarCLI/CLIOutputPreferences.swift` — current JSON/text preference parsing that can inform the Ubuntu contract
- `CodexBar/Sources/CodexBarCore/Providers/ProviderDescriptor.swift` — compile-time registry and provider metadata boundary
- `CodexBar/Sources/CodexBarCore/Providers/ProviderFetchPlan.swift` — normalized source modes, fetch attempts, and fallback pipeline mechanics
- `CodexBar/Sources/CodexBarCore/Host/PTY/TTYCommandRunner.swift` — PTY execution path for CLI-backed providers such as Codex and Claude

### Established Patterns
- Provider behavior is centralized in descriptor-driven fetch pipelines rather than in shell/UI code
- CLI output already supports both JSON and human-readable forms
- Linux/web platform gating is explicit rather than implicit
- Fetch attempts and fallback metadata already exist and can feed the optional diagnostics block

### Integration Points
- The Ubuntu backend contract should be implemented near the CLI/backend boundary, not inside the macOS shell
- Cache/TTL behavior should sit above provider fetch execution so future GNOME polling does not force real fetches every read
- The first backend contract should preserve enough structure that a later daemon can expose the same schema with minimal translation

</code_context>

<specifics>
## Specific Ideas

No specific product-reference analogies were requested. The discussion stayed at contract level: CLI-first shape, dual output, rich controlled snapshots, and short-cache refresh with explicit forced refresh.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-backend-contract*
*Context gathered: 2026-03-25*

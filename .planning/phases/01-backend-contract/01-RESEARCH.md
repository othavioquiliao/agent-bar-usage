# Phase 1: Backend Contract - Research

**Researched:** 2026-03-25
**Domain:** Linux-native backend contract design for a Swift-based multi-provider CLI/backend
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Phase 1 will be CLI-first and stateless at the contract boundary, using a command/bin interface as the canonical backend entrypoint.
- The internal design must remain daemon-ready so a local service can be added later without redefining the public snapshot contract.
- JSON and human-readable output are both first-class outputs of the backend contract.
- JSON remains mandatory and stable for downstream UI integration even when text output is provided for humans.
- The normalized snapshot should be "rich controlled": usage summary, `source`, `updated_at`, structured error state, reset window when available, and an optional diagnostics block.
- Deep diagnostics should be nested and optional rather than always-on top-level payload noise.
- Default reads may use a short-lived cache/TTL.
- The contract must expose an explicit forced-refresh path that bypasses cache.

### the agent's Discretion
- Exact field names and JSON nesting, as long as dual-output and rich-controlled semantics are preserved
- Exact TTL duration, provided it stays short and is documented
- Exact human-readable output layout and verbosity defaults

### Deferred Ideas (OUT OF SCOPE)
- Linux secret storage choices
- GNOME-facing UI and shell integration
- Browser-dependent provider parity

</user_constraints>

<research_summary>
## Summary

The strongest approach for this phase is to treat `CodexBarCLI` as the immediate execution shell and `CodexBarCore` as the reusable fetch engine, then add a thin Ubuntu-specific contract layer around them rather than inventing a new backend runtime. The existing code already proves four key things: cross-platform CLI execution is viable, provider orchestration is descriptor-driven, CLI-backed providers can be run through PTY/process helpers, and Linux web support is intentionally gated. That makes the contract question primarily a schema/caching/interface problem, not a provider-integration-from-scratch problem.

For planning purposes, the standard approach is: keep the runtime stateless at the CLI boundary, normalize machine-readable output around a stable snapshot envelope, keep diagnostics nested and optional, and implement a small cache layer above provider fetch execution so repeated UI polling does not become repeated live fetches. This preserves future flexibility: a daemon can later serve the same schema, while the first shell can safely poll a CLI or a very thin backend wrapper.

The biggest implementation risks are not in serialization itself but in where behavior boundaries are drawn. If the cache sits inside provider fetchers, later daemonization will be messy. If diagnostics are flattened into the main payload, every downstream UI becomes coupled to internal fetch plumbing. If text output becomes the implicit source of truth, the GNOME layer will later need brittle parsing. The planner should therefore isolate: contract types, cache/refresh policy, provider execution adapter, and output formatter.

**Primary recommendation:** Build a stable JSON snapshot envelope above `ProviderDescriptor` execution, keep text output as a formatter over the same data model, and implement a short-TTL cache/force-refresh layer outside provider internals.
</research_summary>

<standard_stack>
## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Swift 6.2 | repo baseline | Core implementation language | Already established by `CodexBar`; avoids introducing a second runtime for the backend contract |
| Swift Package Manager | repo baseline | Build/package structure | Already governs `CodexBarCore` and `CodexBarCLI` targets |
| Commander | repo baseline | CLI command descriptors and parsing | Already used in `CodexBarCLI` and fits the CLI-first decision |
| Swift Testing | repo baseline | Verification and regression tests | Already used in the nested repo and suitable for contract-level tests |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `swift-log` / `CodexBarLog` | repo baseline | Structured logging | Use for refresh/caching/diagnostic boundaries rather than ad-hoc `print` debugging |
| `TTYCommandRunner` / subprocess helpers | repo baseline | Interactive CLI execution for providers | Use for Codex/Claude-style CLI-backed fetch paths |
| Existing provider descriptor registry | repo baseline | Provider metadata and fetch plan discovery | Use to avoid hardcoding provider-specific flow in the Ubuntu contract layer |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing Swift CLI/backend | Rewriting backend in JS/TS for GNOME affinity | Easier GNOME ecosystem integration, but duplicates provider engine logic and increases maintenance |
| Commander-based CLI contract | New bespoke CLI parser | Lower dependency count, but loses alignment with the existing working CLI |
| Thin cache layer above fetchers | Persistent daemon-only state immediately | Better long-lived efficiency later, but violates the chosen CLI-first contract boundary for this phase |

**Installation:**
```bash
# Existing nested repo workflow
cd CodexBar
swift build
swift test
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```text
CodexBar/Sources/
├── CodexBarCore/                 # Provider engine and reusable runtime abstractions
├── CodexBarCLI/                  # Existing CLI shell
└── [Ubuntu contract additions]   # Normalized backend contract + cache layer if added in Swift
```

### Pattern 1: Contract Layer Above Provider Execution
**What:** Introduce a thin layer that converts provider fetch results into one normalized Ubuntu-facing snapshot envelope.
**When to use:** Whenever provider payloads differ or future UIs need a machine-stable interface.
**Example:**
```swift
struct UbuntuProviderSnapshot: Codable, Sendable {
    let provider: String
    let source: String
    let updatedAt: Date
    let status: String
    let usage: UbuntuUsagePayload?
    let resetWindow: UbuntuResetWindow?
    let error: UbuntuProviderError?
    let diagnostics: UbuntuDiagnostics?
}
```

### Pattern 2: Formatter Split
**What:** Generate text output by formatting the normalized snapshot model instead of formatting provider results directly.
**When to use:** When JSON and human-readable output are both first-class and must stay behaviorally aligned.
**Example:**
```swift
let snapshot = UbuntuProviderSnapshot(...)
if output.usesJSONOutput {
    printJSON(snapshot)
} else {
    print(UbuntuTextFormatter.render(snapshot))
}
```

### Pattern 3: Cache Outside Fetchers
**What:** Apply TTL and force-refresh semantics in a coordinator above provider fetch strategies.
**When to use:** When the public contract needs cheap repeated reads without contaminating provider internals.
**Example:**
```swift
if !forceRefresh, let cached = cache.value(for: provider), !cached.isExpired(ttl: ttl) {
    return cached.snapshot
}
let fresh = try await providerDescriptor.fetch(context: context)
cache.store(provider, snapshot: mappedSnapshot)
return mappedSnapshot
```

### Anti-Patterns to Avoid
- **Embedding cache policy inside provider strategies:** makes future daemonization and consistency harder
- **Using text output as the integration contract:** forces downstream Linux surfaces to parse presentation text
- **Letting diagnostics leak into the main top-level payload by default:** makes simple UI consumers depend on internal fetch mechanics
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Provider discovery | Ad-hoc provider switch statements in new Ubuntu code | Existing `ProviderDescriptorRegistry` | Registry already centralizes provider metadata and order |
| CLI process orchestration | New custom PTY wrapper | Existing PTY/subprocess helpers in `CodexBarCore` | Interactive CLI handling already exists and is tricky to get right |
| Output mode parsing | One-off `CommandLine.arguments` parsing | Existing Commander + CLI output preference pattern | Avoids divergence from current CLI behavior |
| Fallback tracking | New parallel error bookkeeping | Existing fetch attempts/outcome structures | The core already models availability, failure, and fallback decisions |

**Key insight:** This phase should add a normalized contract boundary, not replace the core systems that already solve provider execution and CLI integration.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Contract Drift Between JSON and Text
**What goes wrong:** Text and JSON modes start representing different semantics or fields over time.
**Why it happens:** Separate rendering paths evolve independently.
**How to avoid:** Define one normalized snapshot model and render both modes from it.
**Warning signs:** A field appears in JSON but cannot be surfaced in text without another provider fetch.

### Pitfall 2: Cache Semantics Hidden in Provider Logic
**What goes wrong:** TTL behavior becomes provider-specific and impossible to reason about globally.
**Why it happens:** Caching is introduced as a local optimization inside each fetch path.
**How to avoid:** Keep TTL/force-refresh in a single backend coordinator layer.
**Warning signs:** Different providers refresh on different rules without explicit contract documentation.

### Pitfall 3: Overstuffed Diagnostics
**What goes wrong:** Every consumer must understand fetch attempts, timings, and fallback mechanics even when they only need current status.
**Why it happens:** Internal debugging data is promoted to top-level contract status.
**How to avoid:** Nest diagnostics in an optional block and document it as advanced/diagnostic-only.
**Warning signs:** Early GNOME or shell consumers need to filter dozens of internal fields before rendering basic state.
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from the current codebase:

### Existing dual-output preference parsing
```swift
// Source: CodexBar/Sources/CodexBarCLI/CLIOutputPreferences.swift
struct CLIOutputPreferences {
    let format: OutputFormat
    let jsonOnly: Bool
    let pretty: Bool

    var usesJSONOutput: Bool {
        self.jsonOnly || self.format == .json
    }
}
```

### Existing provider fetch pipeline boundary
```swift
// Source: CodexBar/Sources/CodexBarCore/Providers/ProviderFetchPlan.swift
public struct ProviderFetchOutcome: @unchecked Sendable {
    public let result: Result<ProviderFetchResult, Error>
    public let attempts: [ProviderFetchAttempt]
}
```

### Existing descriptor-driven execution
```swift
// Source: CodexBar/Sources/CodexBarCore/Providers/ProviderDescriptor.swift
public func fetch(context: ProviderFetchContext) async throws -> ProviderFetchResult {
    let outcome = await self.fetchOutcome(context: context)
    return try outcome.result.get()
}
```
</code_examples>

<sota_updates>
## State of the Art (2024-2025)

For this phase, the most relevant current pattern shift is architectural rather than library-driven:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| UI-specific backend assumptions | Contract-first backend shared across multiple frontends | Ongoing trend in local AI tooling | Makes daemon/CLI/UI layering much easier |
| One-shot CLI output with no structured diagnostics | Machine-readable JSON envelopes with optional diagnostic detail | Common in modern local developer tooling | Better for automation and UI reuse |
| Re-fetch on every poll | Short-lived cache plus explicit refresh semantics | Increasingly common in local status tools | Reduces provider/API churn and improves perceived responsiveness |

**New tools/patterns to consider:**
- Backend contract schemas that cleanly separate summary state from diagnostics
- Explicit `--refresh` / `--no-cache` style semantics to preserve determinism during debugging

**Deprecated/outdated:**
- Treating terminal-friendly output as the only integration surface for higher-level tooling
</sota_updates>

<open_questions>
## Open Questions

1. **Where should Ubuntu-specific contract types live?**
   - What we know: They should sit near the CLI/backend boundary and not inside the macOS shell.
   - What's unclear: Whether they should live in `CodexBarCore`, `CodexBarCLI`, or a new shared target.
   - Recommendation: Resolve during planning based on write-scope clarity and whether the types are shell-agnostic.

2. **How much diagnostic detail should be emitted by default in text mode?**
   - What we know: Diagnostics must exist, but should be optional and not pollute the main payload.
   - What's unclear: Whether text mode should suppress diagnostics by default or show a concise summary.
   - Recommendation: Plan for concise text defaults and a verbose/debug path instead of always-on detail.

3. **What exact TTL should count as “short-lived cache”?**
   - What we know: Cache should reduce shell polling cost while still keeping output fresh enough for status display.
   - What's unclear: The exact default TTL and whether it should vary by provider.
   - Recommendation: Keep one simple short default in Phase 1 and defer per-provider tuning until real usage data exists.
</open_questions>

## Validation Architecture

Phase 1 should validate three layers:
- contract shape: JSON envelope and field stability
- backend behavior: cache hit vs forced refresh semantics
- integration boundary: provider execution can still surface structured fallback/error data through the contract

Tests should prioritize deterministic contract checks over live provider calls. The fastest useful validation path is Linux-safe unit/integration coverage around mapping, cache policy, and formatter behavior, with smoke verification of the CLI contract in CI.

<sources>
## Sources

### Primary (HIGH confidence)
- `CodexBar/Sources/CodexBarCLI/CLIEntry.swift` - CLI command structure and dispatch
- `CodexBar/Sources/CodexBarCLI/CLIUsageCommand.swift` - provider execution and output flow
- `CodexBar/Sources/CodexBarCLI/CLIOutputPreferences.swift` - JSON/text preference behavior
- `CodexBar/Sources/CodexBarCore/Providers/ProviderDescriptor.swift` - descriptor registry and fetch boundary
- `CodexBar/Sources/CodexBarCore/Providers/ProviderFetchPlan.swift` - fetch outcome and fallback structures
- `CodexBar/Sources/CodexBarCore/Host/PTY/TTYCommandRunner.swift` - CLI-backed provider execution infrastructure
- `CodexBar/.github/workflows/ci.yml` - Linux build/test expectations in CI
- `ubuntu-extension-analysis/codexbar-project-analysis.md` - reusable-vs-macOS shell analysis
- `ubuntu-extension-analysis/provider-analysis.md` - provider portability guidance
- `ubuntu-extension-analysis/ubuntu-extension-direction.md` - Ubuntu-first architecture direction

### Secondary (MEDIUM confidence)
- `.planning/codebase/ARCHITECTURE.md` - synthesized architectural map from local inspection
- `.planning/codebase/STACK.md` - synthesized stack/runtime map from local inspection
- `.planning/codebase/STRUCTURE.md` - synthesized structural map from local inspection

### Tertiary (LOW confidence - needs validation)
- None. This phase research is grounded in local code and project artifacts rather than external ecosystem claims.
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Swift CLI/backend contract on Linux
- Ecosystem: existing `CodexBarCore` + `CodexBarCLI` reuse
- Patterns: descriptor-driven execution, dual-output contract, cache/refresh boundary
- Pitfalls: contract drift, cache placement, diagnostic overexposure

**Confidence breakdown:**
- Standard stack: HIGH - directly inherited from the existing codebase
- Architecture: HIGH - backed by current code structure and existing analysis docs
- Pitfalls: HIGH - derived from the current architecture and phase decisions
- Code examples: HIGH - copied from local primary sources

**Research date:** 2026-03-25
**Valid until:** 2026-04-24
</metadata>

---

*Phase: 01-backend-contract*
*Research completed: 2026-03-25*
*Ready for planning: yes*

# Phase 3: First-Wave Providers - Research

**Researched:** 2026-03-25
**Domain:** Implementing real first-wave provider adapters on top of the Phase 2 runtime
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Provider implementation stays in Node.js/TypeScript backend.
- Phase 3 covers Copilot, Codex CLI, and Claude CLI only.
- GNOME extension work is out of scope.
- Config ordering, source preference, and secret resolution from Phase 2 must remain active.
- Provider failures must be isolated.
- Browser/OAuth parity is deferred.

### Deferred Ideas (OUT OF SCOPE)
- Codex OAuth
- Claude OAuth
- Web/cookie providers and Cursor

</user_constraints>

<research_summary>
## Summary

Phase 3 should not redesign runtime architecture; it should plug real provider adapters into the already-stable provider context and coordinator flow delivered in Phase 2.

The fastest low-risk sequence is:

1. Implement Copilot API adapter using token-based HTTP call and normalized mapping.
2. Implement Codex CLI adapter with deterministic subprocess parsing and clear error codes.
3. Implement Claude CLI adapter and explicitly harden provider isolation around availability/fetch failures.

A shared registry factory should now replace inline mock adapters in `cli.ts`. This keeps provider wiring explicit and makes Phase 4 integration cleaner.

**Primary recommendation:** Ship each provider in its own plan with deterministic tests and finish with a dedicated isolation pass that proves one provider failure does not collapse the full envelope.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Tool | Role | Why it fits |
|------|------|-------------|
| Node.js 22 LTS | runtime | subprocess + HTTP support for mixed provider transports |
| TypeScript | adapter safety | keeps provider contract and mapping explicit |
| `vitest` | tests | deterministic adapter and isolation verification |
| `shared-contract` | snapshot schema | guarantees provider output shape stability |

### Provider transports
| Transport | Provider | Notes |
|-----------|----------|-------|
| API token | Copilot | direct fetch path with explicit auth error handling |
| CLI subprocess | Codex | parse usage output and map failures into structured errors |
| CLI subprocess | Claude | same CLI strategy with explicit isolation guarantees |

</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Pattern 1: Adapter per Provider
Each provider should expose one adapter module implementing `ProviderAdapter`.

### Pattern 2: Fetch/Parse Separation
Split subprocess or HTTP calls from mapping logic so tests can validate parser behavior independently.

### Pattern 3: Registry Factory
Move adapter registration from `cli.ts` into a dedicated factory module.

### Pattern 4: Isolation First
Treat availability probe failures, subprocess failures, and parse failures as provider-local errors that map into error snapshots.

### Anti-Patterns to Avoid
- Mixing provider-specific fetch details into `cli.ts`
- Returning ad-hoc snapshot shapes that bypass `shared-contract`
- Letting one provider throw uncaught errors that reject the full `getSnapshot` call

</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Snapshot validation | manual object checks | `providerSnapshotSchema` parse in coordinator | contract integrity |
| Secret retrieval inside adapters | direct `process.env`/shell logic | existing `ProviderAdapterContext.secrets` | reuse Phase 2 boundary |
| Provider wiring | ad-hoc registry in command handlers | registry factory module | centralized provider composition |
| Isolation checks | manual shell-only checks | vitest provider-isolation test | reproducible regression safety |

</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: CLI parser brittleness
CLI output can drift; parser behavior must fail predictably with provider-level error snapshots.

### Pitfall 2: Token confusion in Copilot
Auth token source should be explicit and tested, with clear handling for 401/403.

### Pitfall 3: Hidden coupling to local machine state
Tests must not require real installed CLIs or logged-in sessions.

### Pitfall 4: Isolation regressions
If `isAvailable` throws before local handling, full refresh can fail; coordinator paths must guard this.

</common_pitfalls>

## Validation Architecture

Phase 3 validation should include:

- per-provider adapter tests (`copilot-provider`, `codex-provider`, `claude-provider`)
- parsing and error mapping checks for each transport
- cross-provider isolation test ensuring one failure does not block successful providers
- end-to-end CLI smoke checks for each provider route via `usage --provider <id> --json`

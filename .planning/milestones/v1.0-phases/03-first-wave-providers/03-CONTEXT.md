# Phase 3: First-Wave Providers - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the first real provider adapters in the Node.js/TypeScript backend for Ubuntu v1:

- Copilot via API token path
- Codex via CLI path
- Claude via CLI path

This phase covers provider fetchers/adapters, snapshot mapping, runtime integration, and provider-level failure isolation. It does not include GNOME extension UI work, OAuth/browser parity paths, or Cursor support.

</domain>

<decisions>
## Implementation Decisions

### Platform and scope
- **D-01:** Keep backend stack in Node.js/TypeScript and reuse the runtime contract from Phases 1 and 2.
- **D-02:** Limit v1 provider implementation to Copilot, Codex CLI, and Claude CLI.
- **D-03:** Keep GNOME UI changes out of scope for this phase.

### Provider transport choices
- **D-04:** Copilot uses Linux API/token path first.
- **D-05:** Codex uses CLI-backed path first.
- **D-06:** Claude uses CLI-backed path first.
- **D-07:** Browser-cookie-dependent/provider-web parity remains deferred.

### Runtime behavior
- **D-08:** Provider execution must continue to respect config-driven ordering, enablement, and source preferences from Phase 2.
- **D-09:** Secrets/config are resolved before adapter fetch logic runs.
- **D-10:** Provider failures must remain isolated; one provider failure must not collapse the full refresh cycle.

### the agent's Discretion
- Concrete file/module layout for provider adapters under `apps/backend/src/providers/`
- Exact parser strategy for each provider as long as normalized snapshots remain stable
- Exact CLI probes and command flags for Codex/Claude as long as failures are structured and testable

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope and requirements
- `.planning/PROJECT.md` — product direction and stack constraints
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, and plan slots
- `.planning/REQUIREMENTS.md` — `COP-01`, `CDX-01`, `CLD-01`
- `.planning/STATE.md` — current position after Phase 2 execution

### Completed phase artifacts
- `.planning/phases/02-linux-config-secrets/02-VERIFICATION.md` — confirms config/secrets runtime is stable
- `.planning/phases/02-linux-config-secrets/02-01-SUMMARY.md` — config model and commands
- `.planning/phases/02-linux-config-secrets/02-02-SUMMARY.md` — secret-store abstraction
- `.planning/phases/02-linux-config-secrets/02-03-SUMMARY.md` — provider context builder and runtime integration

### Backend architecture references
- `ubuntu-extension-analysis/gjs-node-v1-architecture.md` — provider/module boundary guidance
- `apps/backend/src/core/provider-context-builder.ts` — effective provider ordering/source/secret resolution
- `apps/backend/src/core/backend-coordinator.ts` — runtime execution and normalization path
- `apps/backend/src/core/provider-adapter.ts` — adapter contract used by providers

### Reference behavior (CodexBar)
- `CodexBar/Sources/CodexBarCore/Providers/Copilot/CopilotProviderDescriptor.swift`
- `CodexBar/Sources/CodexBarCore/Providers/Copilot/CopilotUsageFetcher.swift`
- `CodexBar/Sources/CodexBarCore/Providers/Codex/CodexProviderDescriptor.swift`
- `CodexBar/Sources/CodexBarCore/Providers/Claude/ClaudeProviderDescriptor.swift`
- `CodexBar/Sources/CodexBarCore/Providers/ProviderFetchPlan.swift`

</canonical_refs>

<code_context>
## Existing Code Insights

### Current backend state before Phase 3
- `apps/backend/src/cli.ts` still builds mock adapters for `copilot`, `codex`, `claude`.
- `apps/backend/src/core/provider-context-builder.ts` already resolves provider order, enabled state, source mode precedence, and secret references.
- `apps/backend/src/core/backend-coordinator.ts` already handles cache + normalized snapshots and now consumes computed provider contexts.
- `apps/backend/src/secrets/*` already provides `SecretResolver`, `SecretToolStore`, and `EnvSecretStore`.

### Implication for this phase
- The missing value is real provider adapter/fetch logic and wiring into registry construction.
- Runtime contract and isolation scaffolding already exist and should be reused, not bypassed.

</code_context>

<specifics>
## Specific Ideas

Recommended provider implementation sequence:

1. Copilot API adapter first (lowest friction)
2. Codex CLI adapter second
3. Claude CLI adapter third with explicit isolation hardening

Also recommended:

- Introduce a provider registry factory module so `cli.ts` no longer owns provider construction inline.
- Add per-provider tests plus a dedicated provider-isolation test.

</specifics>

<deferred>
## Deferred Ideas

- OAuth flows for Codex/Claude
- Web/browser fallback fetch paths
- Cursor support
- Provider auth bootstrap UX/device-flow command flows

</deferred>

---

*Phase: 03-first-wave-providers*
*Context gathered: 2026-03-25*

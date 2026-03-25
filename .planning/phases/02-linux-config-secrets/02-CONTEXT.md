# Phase 2: Linux Config & Secrets - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Introduce Ubuntu-native configuration and secret management for the Node.js/TypeScript backend without inheriting Apple-specific assumptions. This phase covers config file shape, persistence path, provider ordering and source preferences, secret reference resolution, and Linux secret-store integration. Provider implementations, GNOME extension UI, and browser/cookie parity remain outside this phase.

</domain>

<decisions>
## Implementation Decisions

### Platform and stack
- **D-01:** The phase targets the existing Node.js/TypeScript backend created in Phase 1.
- **D-02:** The frontend remains out of scope; this phase serves the backend and future GNOME extension.

### Config model
- **D-03:** The backend must load configuration from an XDG-friendly Linux path rather than from hardcoded project-relative files.
- **D-04:** The config format should be JSON for v1 to minimize parser complexity and keep CLI debugging simple.
- **D-05:** Provider ordering must be explicit in the config shape, not inferred from object key order.
- **D-06:** Provider enable/disable state and preferred `sourceMode` must live in config.

### Secret handling
- **D-07:** Secrets must not be stored in plain text in the config file.
- **D-08:** The primary Linux secret-store path should be libsecret-compatible, exposed through the standard `secret-tool` CLI boundary for v1.
- **D-09:** Environment-variable fallback is allowed for development and CI resolution, but not as the default persistent secret strategy.

### Backend integration
- **D-10:** Provider execution contexts should resolve config and secrets before adapter execution begins.
- **D-11:** Secret resolution should be abstracted behind a backend interface so future desktop flows can reuse it without rewriting adapters.

### the agent's Discretion
- Exact XDG file path and filename, as long as it is Linux-standard and documented
- Exact config schema fields beyond required provider id, enabled state, order, and source mode
- Exact secret reference syntax, as long as config never stores raw secret values by default
- Whether to expose `config validate` and `config dump` commands in this phase, provided they strengthen debuggability

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope
- `.planning/PROJECT.md` — chosen stack, constraints, and product direction
- `.planning/REQUIREMENTS.md` — Phase 2 requirements `CONF-01`, `CONF-02`, and `SECR-01`
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, and plan breakdown
- `.planning/STATE.md` — current phase progression after Phase 1 completion

### Phase 1 outputs
- `.planning/phases/01-backend-contract/01-VERIFICATION.md` — confirms the backend contract is stable enough to build config/secrets on top
- `.planning/phases/01-backend-contract/01-01-SUMMARY.md` — workspace and contract scaffold
- `.planning/phases/01-backend-contract/01-02-SUMMARY.md` — coordinator/cache architecture
- `.planning/phases/01-backend-contract/01-03-SUMMARY.md` — CLI, serializer, formatter, and test structure

### Architecture
- `ubuntu-extension-analysis/gjs-node-v1-architecture.md` — current folder layout and backend module boundaries

</canonical_refs>

<code_context>
## Existing Code Insights

### Current backend anchors
- `apps/backend/src/cli.ts` — current CLI boundary; likely place for config commands and config-aware usage execution
- `apps/backend/src/config/backend-request.ts` — existing request normalization pattern
- `apps/backend/src/core/backend-coordinator.ts` — provider runtime entrypoint that should receive config/secret-aware contexts next
- `packages/shared-contract/src/request.ts` — current contract enums and request shape, useful for config schema reuse

### Established patterns from Phase 1
- Shared schemas live outside runtime-specific modules
- Coordinator owns cross-provider behavior
- JSON and text outputs come from normalized models
- Backend is already structured to absorb config and secret resolution as distinct concerns

### Integration points
- Config loading should happen before building the effective backend request and provider registry selection
- Secret resolution should feed provider-specific execution context rather than be embedded in CLI parsing
- The future GNOME extension should consume normalized config-backed backend behavior, not duplicate config parsing

</code_context>

<specifics>
## Specific Ideas

Recommended v1 direction for this phase:

- config path under XDG config home, for example `~/.config/agent-bar/config.json`
- provider settings represented as an ordered array of provider entries
- secret references stored in config, secret values stored in libsecret via `secret-tool`
- backend commands such as `config validate` and `config dump` if they help make the system inspectable

</specifics>

<deferred>
## Deferred Ideas

- GNOME preferences UI for editing config
- OAuth/browser login UX
- Provider-specific credential schemas beyond what Phase 3 needs

</deferred>

---

*Phase: 02-linux-config-secrets*
*Context gathered: 2026-03-25*

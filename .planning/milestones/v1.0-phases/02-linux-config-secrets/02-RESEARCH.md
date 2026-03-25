# Phase 2: Linux Config & Secrets - Research

**Researched:** 2026-03-25
**Domain:** Linux-native config persistence and secret resolution for the Node.js/TypeScript backend
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- The phase targets the Node.js/TypeScript backend introduced in Phase 1.
- The GNOME Shell extension remains out of scope for this phase.
- Config must come from an XDG-friendly Linux path instead of project-relative or Apple-specific locations.
- The v1 config format should be JSON.
- Provider order must be explicit rather than inferred from object key order.
- Provider enable/disable state and preferred `sourceMode` must persist in config.
- Raw secrets must not be stored in the config file by default.
- The primary persistent Linux secret-store strategy should be libsecret-compatible through the `secret-tool` CLI boundary.
- Environment variables may act as a development and CI fallback, but not as the default persistent strategy.
- Provider execution contexts must resolve config and secrets before adapter execution.
- Secret resolution must sit behind a backend interface so later flows can reuse it.

### Deferred Ideas (OUT OF SCOPE)
- GNOME preferences UI
- OAuth/browser login UX
- Provider-specific secret acquisition flows
- Browser-cookie parity and Cursor support

</user_constraints>

<research_summary>
## Summary

The strongest Phase 2 approach is to keep configuration and secret handling fully inside the backend and expose the results through explicit backend services rather than through ad-hoc CLI flag parsing. The backend should load a single effective config document from an XDG location, validate it with `zod`, and resolve provider settings into a stable provider runtime context before the coordinator touches adapters.

For secrets, the right v1 boundary is an interface-driven resolver with two concrete implementations:

- a primary `secret-tool`-backed store for persistent Linux secret retrieval
- an environment-backed fallback for development, CI, and headless scenarios

This preserves Linux-native behavior without forcing providers to know how credentials are stored. The config file should therefore contain provider settings and secret references, not secret values.

The minimal useful v1 config should cover:

- global defaults such as cache TTL when appropriate
- an ordered array of provider entries
- per-provider `enabled`
- per-provider preferred `sourceMode`
- per-provider secret reference metadata when required

To keep the system inspectable, this phase should also add read-only config commands such as `config validate` and `config dump`. Those commands make it much easier to debug path resolution, schema failures, and missing secret references before Phase 3 introduces real provider logic.

**Primary recommendation:** Implement an XDG-based JSON config loader plus a secret-store abstraction backed by `secret-tool`, then inject the effective provider config and resolved secrets into provider contexts before adapter execution begins.
</research_summary>

<standard_stack>
## Standard Stack

The established tools for this phase:

### Core
| Tool | Role | Why it fits |
|------|------|-------------|
| Node.js 22 LTS | backend runtime | Strong subprocess, filesystem, and JSON support for Linux config/secrets |
| TypeScript | backend language | Useful for typed config models, provider contexts, and secret interfaces |
| `zod` | config validation | Prevents malformed config from silently drifting into runtime behavior |
| `node:fs/promises` | config I/O | Native file reads for XDG config loading |
| `node:os` and `node:path` | XDG path resolution | Keeps Linux path construction explicit and testable |

### Linux secret boundary
| Tool | Role | Why it fits |
|------|------|-------------|
| `secret-tool` | persistent secret retrieval | Standard CLI boundary for libsecret-compatible stores on Ubuntu |
| environment variables | fallback secret resolution | Works in CI and local development without a desktop secret service |

### Validation
| Tool | Role | Why it fits |
|------|------|-------------|
| `vitest` | test runner | Deterministic tests for config validation, XDG path resolution, and secret resolution |

</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Pattern 1: Effective Config Layer
**What:** Load raw config from disk, validate it, and map it to an internal "effective config" shape used by the backend.
**Why:** Keeps disk format concerns separate from runtime orchestration and makes future migrations easier.

### Pattern 2: Secret References, Not Secret Values
**What:** Store a secret reference such as a service/account key in config, then resolve the actual secret through a store interface.
**Why:** Prevents plain-text defaults and keeps provider adapters independent of persistence details.

### Pattern 3: Provider Context Builder
**What:** Create a dedicated builder that combines request overrides, config defaults, and resolved secrets into per-provider runtime contexts.
**Why:** Centralizes precedence rules and avoids duplicating config logic across adapters or CLI commands.

### Pattern 4: Read-Only Config Introspection Commands
**What:** Expose `config validate` and `config dump` over the same loader/validator used at runtime.
**Why:** Lets developers inspect effective behavior without manually reading files or reverse-engineering defaults.

### Anti-Patterns to Avoid
- Storing raw tokens directly in `config.json`
- Letting providers read files or environment variables directly on their own
- Hardcoding config paths in command handlers
- Making the GNOME extension responsible for config or secret resolution

</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Config validation | Manual nested `if` checks | `zod` config schemas | Better errors and typed outputs |
| XDG path handling | String concatenation scattered through commands | dedicated config path module | One authoritative path policy |
| Secret persistence | Plain-text JSON fields | `secret-tool` bridge plus references | Matches Linux expectations |
| Runtime precedence | Implicit flag/config/env ordering | provider context builder | Makes behavior testable and deterministic |

</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Config shape mirrors runtime too closely
Disk formats change more slowly than internal runtime needs. Keep a validated disk schema and derive runtime structures from it.

### Pitfall 2: Secret lookup leaks into provider adapters
Then each provider invents its own precedence rules and error behavior.

### Pitfall 3: `secret-tool` is treated as always available
Ubuntu systems can lack a running secret service in terminals or CI, so failure behavior and env fallback must be explicit.

### Pitfall 4: Config order is stored in objects
That makes provider ordering fragile and less obvious to users.

</common_pitfalls>

<open_questions>
## Open Questions

1. **Config file path**
   - Recommendation: resolve to `${XDG_CONFIG_HOME:-~/.config}/agent-bar/config.json`.

2. **Secret reference shape**
   - Recommendation: start with a small structured object such as `{ store, service, account, env }` and only expand when Phase 3 requires more.

3. **Global defaults in config**
   - Recommendation: support only a minimal global block in v1, such as cache TTL, to avoid over-designing before providers are real.

4. **Missing secret behavior**
   - Recommendation: do not crash the whole backend; surface a structured provider-level error and keep other providers running.

</open_questions>

## Validation Architecture

Phase 2 should validate three layers:

- config loading and schema validation from XDG-aware paths
- secret-store resolution behavior for `secret-tool` and env fallback
- runtime precedence rules that combine request overrides, config defaults, provider order, and resolved secret material

Tests should stay deterministic and avoid hitting a real system keyring. `secret-tool` behavior should be covered with subprocess mocking or a store stub rather than live desktop dependencies.

# Phase 1: Backend Contract - Research

**Researched:** 2026-03-25
**Domain:** Linux-native backend contract design for a GNOME Shell extension backed by Node.js/TypeScript
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- The backend contract is CLI-first and stateless at the public boundary.
- The internal design should remain daemon-ready.
- The Ubuntu product must not use Swift in the new implementation.
- The backend implementation stack is Node.js + TypeScript.
- The frontend target is a GNOME Shell extension in GJS on Ubuntu 24.04.4 LTS.
- JSON and human-readable output are both first-class outputs.
- JSON remains the mandatory stable contract for the GNOME frontend.
- The normalized snapshot should be rich but controlled: usage, `source`, `updated_at`, structured error, reset window when available, and optional diagnostics.
- Diagnostics should stay nested and optional.
- Default reads may use a short-lived cache.
- The contract must expose forced refresh.

### Deferred Ideas (OUT OF SCOPE)
- Linux secret storage implementation
- GNOME Shell extension UI code
- Browser-dependent provider parity

</user_constraints>

<research_summary>
## Summary

The strongest approach for Phase 1 is to build a small Node.js/TypeScript monorepo with one backend app and one shared-contract package. The backend should own provider orchestration, cache policy, and formatting. The future GNOME extension should only consume the backend contract through CLI JSON. This preserves the useful behavior patterns from CodexBar without coupling the new product to Swift.

The reference repo still matters, but only as architecture input. The key ideas worth mirroring are:

- provider registry plus per-provider adapters
- explicit source modes such as `auto`, `cli`, `oauth`, `api`, and `web`
- normalized fetch attempts and fallback metadata
- separation between fetch runtime and presentation

The backend should therefore be divided into:

- shared contract types and validation schemas
- provider adapter interface and registry
- refresh coordinator plus TTL cache
- JSON serializer and text formatter over the same normalized model

This keeps the CLI useful on its own, gives the GNOME extension a stable contract, and leaves room for a later daemon without redesigning the public API.

**Primary recommendation:** Build a Node.js/TypeScript backend CLI around a shared contract package, keep diagnostics nested and opt-in, and mirror the CodexBar fetch/fallback ideas through provider adapters rather than through direct code reuse.
</research_summary>

<standard_stack>
## Standard Stack

The established tools for this implementation direction:

### Core
| Tool | Role | Why it fits |
|------|------|-------------|
| Node.js 22 LTS | backend runtime | Mature CLI/process ecosystem and strong JSON/tooling support |
| TypeScript | backend language | Strong typing for the normalized contract and provider adapters |
| `pnpm` workspaces | repo layout | Clean split between backend app and shared contract package |
| `commander` | CLI parsing | Straightforward command structure and help generation |
| `zod` | runtime schema validation | Keeps the contract honest at runtime and in tests |
| `vitest` | test runner | Fast and well suited for contract, cache, and formatter tests |

### Frontend boundary
| Tool | Role | Why it fits |
|------|------|-------------|
| GJS | GNOME extension runtime | Native GNOME Shell integration on Ubuntu 24.04.4 LTS |
| `GLib` / `Gio` | subprocess and timers | Needed for backend invocation and polling in the extension |
| `St` / `PanelMenu` / `PopupMenu` | top-bar UI | Standard GNOME Shell extension surface |

### Supporting
| Tool | Role | When to use |
|------|------|-------------|
| `pino` | backend logging | Structured logs for provider failures and diagnostics |
| `execa` or `node:child_process` | subprocess execution | CLI-backed providers such as Codex and Claude |
| `tsx` | local TypeScript execution | Useful in dev before packaging compiled output |

</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Pattern 1: Shared Contract Package
**What:** Keep request/response schema definitions in a dedicated package used by the backend.
**Why:** Prevents contract drift and creates a stable import boundary for tests and future clients.

### Pattern 2: Thin GNOME Client
**What:** The extension should spawn the backend, parse JSON, and render state without provider logic.
**Why:** GNOME Shell code becomes much easier to debug and less sensitive to provider churn.

### Pattern 3: Coordinator Above Adapters
**What:** Put TTL, force-refresh, provider selection, and failure isolation in one backend coordinator.
**Why:** Provider adapters stay focused on fetch behavior and mapping, not cache policy.

### Pattern 4: Formatter Split Over the Same Model
**What:** Text output must render from the normalized snapshot envelope used for JSON.
**Why:** JSON and text remain semantically aligned.

### Anti-Patterns to Avoid
- Putting provider-specific logic in the GNOME extension
- Hiding cache semantics inside each provider adapter
- Treating CodexBar Swift modules as code dependencies
- Letting text output become the real integration contract

</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Contract validation | Ad-hoc object checks | `zod` schemas in `packages/shared-contract` | Runtime validation plus type inference |
| CLI parsing | Manual `process.argv` branching | `commander` | Cleaner help, flags, and subcommands |
| Test harness | Custom shell-script assertions | `vitest` | Faster deterministic contract tests |
| Provider registration | Free-form imports spread through commands | central `provider-registry.ts` | Keeps adapter composition explicit |

</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Extension does too much
If the GNOME extension owns provider auth, fetch logic, retries, and formatting, it will become fragile fast.

### Pitfall 2: Contract types live only inside the backend app
This makes tests and future clients rely on duplicated shapes.

### Pitfall 3: Cache policy is hidden inside adapters
Then refresh behavior becomes inconsistent and hard to debug.

### Pitfall 4: Reference repo becomes implementation dependency
That would reintroduce the Swift coupling the user explicitly rejected.

</common_pitfalls>

<open_questions>
## Open Questions

1. **Workspace manager**
   - Recommendation: `pnpm` workspaces for backend app plus shared contract package.

2. **Subprocess wrapper**
   - Recommendation: start with `node:child_process` or `execa`, whichever keeps interactive CLI handling simpler during implementation.

3. **Default TTL**
   - Recommendation: `30` seconds as the first documented default, then tune later with real usage.

4. **Extension authoring language**
   - Recommendation: plain GJS JavaScript in v1. Avoid adding a frontend TypeScript build step unless it clearly pays for itself.

</open_questions>

## Validation Architecture

Phase 1 should validate three layers:

- contract shape: schema version, provider snapshots, error shape, diagnostics shape
- backend behavior: cache hit versus force refresh
- output alignment: JSON and text represent the same provider state

Tests should prioritize deterministic contract checks over live provider calls. The first useful validation setup is a Vitest suite around request parsing, snapshot mapping, cache behavior, and formatter parity.

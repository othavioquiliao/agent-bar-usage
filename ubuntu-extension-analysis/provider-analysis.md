---
summary: "Provider-by-provider analysis focused on Codex, Claude, Copilot, and Cursor for Ubuntu extension viability."
read_when:
  - Prioritizing the first providers for an Ubuntu extension
  - Designing auth and fetch flows per provider
  - Estimating portability risk by provider
---

# Provider Analysis

This document narrows the analysis to the providers that matter most for the planned Ubuntu extension:

- Codex
- Claude
- Copilot
- Cursor

## 1. Common provider model in CodexBar

Every provider is expressed as:

- one `UsageProvider` id
- one `ProviderDescriptor`
- one fetch pipeline
- one or more `ProviderFetchStrategy` implementations
- one app-side implementation for login/settings/menu hooks

That common model is a major asset.
It gives a repeatable blueprint for adding Ubuntu support provider by provider.

## 2. Codex

### Current shape

Codex is represented by `Sources/CodexBarCore/Providers/Codex/CodexProviderDescriptor.swift`.

Supported source modes:

- `auto`
- `web`
- `cli`
- `oauth`

Strategies in play:

- CLI strategy
- OAuth strategy
- OpenAI web dashboard strategy

### Practical meaning

Codex is not a single-source provider.
It mixes:

- local CLI/RPC information
- OAuth API usage
- optional dashboard scraping for richer extras

### What is reusable for Ubuntu

- CLI/RPC path
- OAuth usage path
- snapshot mapping
- descriptor metadata and pipeline logic

### What is hard to reuse

- OpenAI dashboard extras via WebKit
- browser-cookie driven web dashboard enrichment

### Ubuntu assessment

Codex is a good candidate if the Linux version initially focuses on:

- CLI-backed usage
- optional OAuth-backed usage

It is a bad candidate if v1 depends on the same browser-driven dashboard enrichment as macOS.

## 3. Claude

### Current shape

Claude is the most sophisticated provider in the codebase.

Key file:

- `Sources/CodexBarCore/Providers/Claude/ClaudeProviderDescriptor.swift`

Supported source modes:

- `auto`
- `web`
- `cli`
- `oauth`

The provider does not hardcode a simple fallback order.
It builds a planning input and delegates source ordering to `ClaudeSourcePlanner`.

### Why this is important

Claude already models a real-world provider problem:

- several auth sources
- several transport sources
- context-sensitive fallback
- background-vs-user-initiated behavior
- prompt/keychain policy interactions

This makes the Claude provider a high-value reference design even if parts of its current implementation are
macOS-specific.

### What is reusable for Ubuntu

- source planner pattern
- CLI fetch path
- OAuth path, conceptually
- provider snapshot model
- fallback reasoning structure

### What needs redesign

- macOS keychain assumptions
- browser cookie availability detection
- any flow depending on Apple-managed credentials or Apple prompt policy

### Ubuntu assessment

Claude is a strong candidate for a Linux/Ubuntu version if the implementation is centered on:

- Claude CLI
- explicit OAuth/token storage in a Linux-appropriate secret store

It is less attractive if v1 insists on cookie-derived browser usage parity.

## 4. Copilot

### Current shape

Copilot is comparatively simple in this codebase.

Key files:

- `Sources/CodexBarCore/Providers/Copilot/CopilotProviderDescriptor.swift`
- `Sources/CodexBarCore/Providers/Copilot/CopilotUsageFetcher.swift`
- `Sources/CodexBar/Providers/Copilot/CopilotLoginFlow.swift`

Supported source modes:

- `auto`
- `api`

The effective fetch is API-token-based.
The app-side login uses GitHub device flow.

### Why Copilot is attractive

This provider has the cleanest portability story of the group:

- standard HTTP requests
- device flow login is platform-agnostic
- no browser scraping required
- no local CLI parsing required

### Ubuntu assessment

Copilot should be treated as a first-wave provider for Ubuntu.
It offers a high confidence/low complexity path compared to Cursor and the web-heavy parts of Codex.

## 5. Cursor

### Current shape

Key files:

- `Sources/CodexBarCore/Providers/Cursor/CursorProviderDescriptor.swift`
- `Sources/CodexBarCore/Providers/Cursor/CursorStatusProbe.swift`

Current behavior is heavily cookie-centric.
The provider imports browser cookies for Cursor-related domains and uses those cookies to fetch plan and usage data.

### Why Cursor is difficult

The current implementation assumes:

- browser profiles are locally discoverable
- cookie stores can be read
- session cookie names are known or inferable
- platform-specific browser locations are manageable

This is already tricky on macOS.
On Ubuntu, it becomes more variable:

- browser profile locations differ
- encryption/decryption paths differ
- permissions differ by browser and desktop environment
- extension sandboxes can complicate direct access

### What is still useful

- understanding the API/data shape
- understanding the cookie-domain surface
- understanding how the snapshot is modeled

### Ubuntu assessment

Cursor should not be the first provider implemented if the goal is quick success.
It should be a later phase provider unless an alternative auth path is found.

## 6. Comparative portability table

| Provider | Current main fetch styles | Ubuntu portability | Notes |
| --- | --- | --- | --- |
| Codex | CLI/RPC, OAuth, optional web extras | Medium | Strong if scoped to CLI/OAuth first |
| Claude | CLI, OAuth, web cookies with planner/fallback | Medium | Good architecture, but browser/keychain parts need redesign |
| Copilot | Device flow + API token | High | Best first-wave provider |
| Cursor | Browser cookie/session driven | Low to medium | Technically possible, but costly and fragile |

## 7. Recommended provider order for Ubuntu

### Phase 1

- Copilot
- Codex via CLI
- Claude via CLI

### Phase 2

- Codex OAuth
- Claude OAuth

### Phase 3

- Cursor, only after a stable Linux auth/session strategy exists

## 8. Provider takeaway

If the Ubuntu goal is to deliver value quickly, the project should avoid chasing provider parity from day one.
The best move is to implement the providers whose data sources are already transportable:

- API token
- OAuth
- CLI/PTTY

and delay the providers that are dominated by:

- browser cookie extraction
- embedded/offscreen browser rendering
- platform-specific secret-management behavior

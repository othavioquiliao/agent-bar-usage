# Architecture

**Analysis Date:** 2026-03-25

## Pattern Overview

**Overall:** Multi-repo workspace with mirrored agent-tool distributions plus a nested Swift product repository

**Key Characteristics:**
- The workspace root is an orchestration/documentation layer, not one executable application
- Hidden directories mirror the same GSD toolkit into multiple agent ecosystems (`.codex`, `.claude`, `.opencode`)
- `CodexBar/` is the only substantial product codebase and contains both a macOS app shell and a reusable provider engine
- Planning state is file-based in `.planning/`, while product runtime state lives inside the nested `CodexBar` app/CLI

## Layers

**Workspace Distribution Layer:**
- Purpose: Ship and mirror GSD assets to different agent runtimes
- Contains: Commands, agents, hooks, templates, workflows, manifests, config
- Depends on: Node.js scripts and installer-managed file manifests
- Used by: Codex, Claude Code, Opencode, GitHub Copilot-style agent flows

**Planning & Analysis Layer:**
- Purpose: Capture discovery, roadmap, and architectural understanding for future work
- Contains: `.planning/` and `ubuntu-extension-analysis/`
- Depends on: Human/agent-authored Markdown, GSD templates and workflows
- Used by: `gsd-*` workflows, project planning, future implementation phases

**Product Backend Layer (`CodexBarCore`):**
- Purpose: Provider descriptors, fetch strategies, runtime context, logging, platform gates, and shared domain logic
- Contains: `ProviderDescriptor`, fetch plans, browser/session abstractions, usage models, logging, host/runtime helpers
- Depends on: Swift standard library, `swift-log`, `SweetCookieKit`, platform APIs when available
- Used by: macOS app target, CLI target, watchdog/probe helpers, tests

**Product Shell Layer (`CodexBar`, `CodexBarCLI`, helper executables):**
- Purpose: Present the provider engine through UI, CLI, and platform-specific utilities
- Contains: SwiftUI/AppKit app, CLI command entry points, widget, web probe, watchdog
- Depends on: `CodexBarCore`
- Used by: End users and CI smoke tests

## Data Flow

**GSD Workflow Invocation:**

1. A user invokes a `gsd-*` command or asks for GSD behavior through an agent surface.
2. The relevant command/skill/hook definition is loaded from the matching hidden tool directory.
3. Workflow scripts under `.codex/get-shit-done/` determine required artifacts and next steps.
4. Output is written to `.planning/` as Markdown planning state.
5. The root repo accumulates documentation and coordination context rather than built binaries.

**CodexBar App Refresh Cycle:**

1. `CodexBarApp` boots logging, settings, fetchers, browser detection, and `UsageStore`.
2. `UsageStore` resolves provider specs from `ProviderRegistry`.
3. Each provider executes through a `ProviderDescriptor` and its fetch plan against a `ProviderFetchContext`.
4. Snapshots, errors, token-cost state, and debug traces are stored in observable state.
5. AppKit/SwiftUI menu and preferences surfaces read that state and update the UI.

**CodexBar CLI Execution:**

1. `CodexBarCLI.main()` normalizes argv and resolves the command with `Commander`.
2. Logging is bootstrapped based on flags.
3. The command builds provider descriptors/runtime context.
4. Usage/cost/config logic executes in `CodexBarCore`.
5. Output is returned as text or JSON and the process exits.

**State Management:**
- Root workspace: file-based state in `.planning/`
- `CodexBar` product: observable in-memory state plus persisted local app settings/history/keychain-backed credentials

## Key Abstractions

**Provider Descriptor:**
- Purpose: Describe one provider’s metadata, branding, CLI identity, token-cost capability, and fetch behavior
- Examples: `CodexBar/Sources/CodexBarCore/Providers/ProviderDescriptor.swift`, provider-specific descriptor files
- Pattern: Registry + strategy/pipeline execution

**Provider Fetch Context / Plan:**
- Purpose: Carry runtime, source mode, environment, fetchers, and settings into provider execution
- Examples: `ProviderFetchContext`, `ProviderFetchPlan`
- Pattern: Strategy pipeline with availability checks and fallbacks

**Usage Store:**
- Purpose: Central application state for snapshots, errors, credits, status, timers, and refresh coordination
- Examples: `CodexBar/Sources/CodexBar/UsageStore.swift`
- Pattern: Observable state container used by the app shell

**Workflow Asset:**
- Purpose: Declarative command/skill/template/workflow content for GSD automation
- Examples: `.codex/get-shit-done/workflows/*.md`, `.claude/commands/gsd/*.md`, `.codex/skills/gsd-*`
- Pattern: File-driven orchestration rather than a compiled application module

## Entry Points

**Root Agent Config:**
- Location: `.codex/config.toml`
- Triggers: Codex session startup and GSD-capable agent operation
- Responsibilities: Register GSD agents, enable hooks, point to managed config files

**Claude/Opencode Command Surfaces:**
- Location: `.claude/commands/gsd/`, `.opencode/command/`, mirrored toolkit directories
- Triggers: Slash-command style invocation in those tools
- Responsibilities: Route users into GSD workflows

**macOS App:**
- Location: `CodexBar/Sources/CodexBar/CodexbarApp.swift`
- Triggers: Launching the packaged app
- Responsibilities: Bootstrap logging, stores, settings, updater, and preferences scenes

**CLI:**
- Location: `CodexBar/Sources/CodexBarCLI/CLIEntry.swift`
- Triggers: Running the `CodexBarCLI` executable
- Responsibilities: Parse commands, initialize logging, and dispatch usage/cost/config operations

## Error Handling

**Strategy:** Fail at boundaries, retain provider-level failure detail, and gate unsupported platform paths explicitly

**Patterns:**
- CLI command resolution throws and exits with categorized failure output
- Provider execution records per-provider errors and fetch attempts rather than collapsing all failures into one global exception
- Unsupported platform paths are intentionally surfaced in Linux tests and runtime guards
- GSD/document workflows are file-driven and should fail early when required prerequisites are missing

## Cross-Cutting Concerns

**Logging:**
- `CodexBar` bootstraps structured logging to `oslog` or stderr depending on runtime
- Workflow/tooling layers rely on script/CLI output rather than a centralized logging backend

**Platform Gating:**
- macOS-only features are isolated in the app shell and web/browser helpers
- Linux support is intentionally narrower and centered on the CLI/backend path

**Configuration Distribution:**
- The same GSD capability is mirrored into multiple agent ecosystems, which creates a cross-cutting need for asset synchronization

**Provider Volatility:**
- Many provider integrations depend on third-party auth/session models, so fallback logic and defensive testing are part of the architecture, not incidental implementation detail

---

*Architecture analysis: 2026-03-25*
*Update when the workspace model or product-shell split changes*

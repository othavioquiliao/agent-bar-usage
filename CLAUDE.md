<!-- GSD:project-start source:PROJECT.md -->
## Project

**Agent Bar Ubuntu**

Agent Bar Ubuntu is a Linux-native desktop product that surfaces AI provider usage (Copilot, Codex, Claude) for Ubuntu users through a Node.js/TypeScript backend and a GNOME Shell extension in GJS. v1.0 ships a working end-to-end stack: backend service running under systemd, GNOME top-bar indicator, provider snapshot polling, and `agent-bar auth copilot` for zero-friction Copilot setup.

**Core Value:** Ubuntu users can reliably see the current usage state of their AI providers from a Linux-native surface without depending on the macOS-specific CodexBar shell.

### Constraints

- **Platform**: Ubuntu 24.04.4 LTS first, Linux-native shell
- **Backend stack**: Bun + TypeScript (migrating from Node.js in v2.0)
- **Frontend stack**: GNOME Shell extension in GJS
- **Architecture**: Provider contract stays independent from GNOME-extension specifics
- **Secrets**: Linux secret storage via libsecret/GNOME Keyring only
- **Portability**: Browser-cookie-dependent flows remain secondary
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- Swift 6.2 - Application, CLI, provider engine, tests, and release tooling inside `CodexBar/`
- Markdown - GSD workflows, commands, skills, templates, and analysis docs in the root workspace
- JavaScript (CommonJS/Node.js) - GSD installer/tooling under `.codex/get-shit-done/`, mirrored agent assets, and small manifest packages in `.claude/` and `.opencode/`
- Shell - Build, lint, packaging, and local development scripts under `CodexBar/Scripts/`
- TOML / JSON / YAML - Agent config, file manifests, package metadata, and CI configuration
## Runtime
- macOS 14+ - Required for the full `CodexBar` menubar app, AppKit/SwiftUI shell, Sparkle updater, and browser/keychain integrations
- Linux (Ubuntu CI verified) - Supported for `CodexBarCLI` and Linux-only tests, but not for macOS-only web/browser features
- Node.js - Required for GSD orchestration scripts, hooks, and installer assets mirrored into `.codex/`, `.claude/`, and `.opencode/`
- Swift Package Manager - Primary package/build system for `CodexBar/`
- npm/pnpm-style script layer - Present in `CodexBar/package.json` for developer ergonomics around build/test/lint/release
- No single root package manager - The workspace root is a meta-repo, not one installable app
## Frameworks
- SwiftUI + AppKit - Desktop shell for `CodexBar`
- Swift Observation - Reactive state updates in app-facing stores such as `UsageStore`
- Commander - CLI argument parsing for `CodexBarCLI`
- SwiftLog - Shared logging pipeline in `CodexBarCore`
- Sparkle - macOS auto-update flow
- KeyboardShortcuts - User-configurable shortcuts in the macOS app
- SweetCookieKit - Browser cookie import for web-backed providers
- SwiftSyntax / macros - Macro support targets used by the Swift package
- Swift Testing - Main test framework via `Testing`, `@Suite`, `@Test`, and `#expect`
- GitHub Actions - CI for macOS lint/build/test and Linux CLI build/smoke coverage
- SwiftFormat - Formatting with Swift 6.2-aware config
- SwiftLint - Linting with project-specific rule set
- Node scripts - Auxiliary documentation and workflow tooling
## Key Dependencies
- `Sparkle` - App update distribution for the macOS build
- `Commander` - Command routing and parsing for the CLI entry point
- `swift-log` / `Logging` - Shared structured logging across app and CLI
- `SweetCookieKit` - Cookie import for providers that rely on browser session state
- `swift-syntax` - Macro/plugin support in the Swift package
- GitHub Actions - CI orchestration for macOS and Ubuntu runners
- `Testing` module - Assertion and suite framework used throughout `CodexBar/Tests*`
- Local GSD assets - Workflow engine and command/skill distribution mirrored into hidden tool directories
## Configuration
- Root agent behavior is configured through `.codex/config.toml`, mirrored manifests, and hook registration
- `CodexBar` uses environment variables for logging and local dependency overrides, notably `CODEXBAR_LOG_LEVEL` and `CODEXBAR_USE_LOCAL_SWEETCOOKIEKIT`
- Provider-specific credentials are resolved by the product code from local OS/browser/account state rather than a root `.env` file
- `CodexBar/Package.swift` - Swift package targets, dependencies, and platform gating
- `CodexBar/package.json` - Developer commands for start/build/test/lint/release
- `CodexBar/.swiftformat` and `CodexBar/.swiftlint.yml` - Code style enforcement
- `CodexBar/.github/workflows/ci.yml` - CI matrix and platform checks
## Platform Requirements
- macOS is required to work on the full `CodexBar` desktop product
- Ubuntu/Linux is sufficient for `CodexBarCLI`, Linux tests, and the future Ubuntu extension backend work
- Node.js is required to use the GSD workflow assets stored in the workspace root
- The current shipped desktop product targets macOS only
- The root repository itself is not deployed as a standalone service; it acts as a planning/orchestration workspace plus a nested product repo
- A future Ubuntu extension should treat `CodexBarCore` and `CodexBarCLI` as reusable backend pieces rather than porting the macOS shell directly
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- `kebab-case.md` for GSD commands, workflows, and many documentation files
- `PascalCase.swift` for Swift source and test files in `CodexBar/`
- `*Tests.swift` for test files, usually grouped under `Tests/CodexBarTests/`
- Swift code uses `camelCase` for functions and methods
- Async functions are not prefixed specially; async-ness is conveyed by signature
- Test functions often use backticked descriptive names, for example ``func `descriptor registry is complete and deterministic`()`` 
- `camelCase` for local variables and stored properties
- `UPPER_SNAKE_CASE` is uncommon in Swift code; constants are usually still `camelCase`
- No underscore-heavy private naming convention was observed; access control and scope do the work
- `PascalCase` for structs, enums, protocols, actors, and classes
- Protocols are plain names such as `ClaudeUsageFetching`, not `I*` prefixed
- Registry/store/domain types are descriptive and explicit rather than abbreviated
## Code Style
- `SwiftFormat` is authoritative for `CodexBar`
- 4-space indentation
- 120-character soft limit in both SwiftFormat and SwiftLint
- Explicit `self` is intentionally inserted to stay compatible with Swift 6 strict concurrency
- `MARK:` sections are used heavily to organize larger files
- `SwiftLint` runs on `Sources` and `Tests`
- Many stylistic rules are delegated to SwiftFormat
- Some stricter rules are intentionally disabled to fit the current codebase, including `todo`, `file_name`, and `explicit_self`
- Complexity and size guards exist, but with pragmatic thresholds rather than extremely tight caps
## Import Organization
- SwiftFormat is configured with `--importgrouping testable-bottom`
- Imports are compact and usually separated only when platform conditionals matter
- None observed in Swift
- Directory structure and module names act as the import contract
## Error Handling
- Throw errors from product code and catch them at application or CLI boundaries
- Use provider-specific error types and platform-gated error cases where appropriate
- Prefer explicit branching on error types in tests and provider fallback logic
- Failures that matter to routing/fallback are modeled with domain-specific enums
- CLI exits categorize argument/runtime failures instead of dumping raw stack traces
- Tests frequently assert exact failure behavior via `#expect(throws:)`
## Logging
- `swift-log` / `CodexBarLog` in the product code
- `oslog` for the macOS app path and stderr for CLI/log-oriented paths
- Log bootstrap happens early at app/CLI entry points
- Logging is treated as a first-class operational concern around provider refresh, session state, and diagnostics
- Root planning/workflow docs themselves are not code-logged; they are stateful Markdown artifacts
## Comments
- Comments explain platform quirks, lifecycle workarounds, regression context, or why a behavior exists
- Short doc comments are used where architecture would otherwise be opaque
- `MARK:` separators are common and useful
- Comments tend to explain why a workaround is needed, not restate the next line
- Tests often include regression references and scenario framing in comments
- `todo` is not lint-blocked, but TODOs were not the dominant coordination mechanism in the inspected files
- Planning/roadmap files appear to be the preferred place for larger future-work tracking
## Function Design
- The codebase allows large files and large types where needed, especially in store and provider modules
- Complex logic is often still broken into helper methods or nested supporting types
- Swift initializer and context objects are favored when multiple dependencies must travel together
- Provider execution is driven by rich context structs rather than long positional parameter chains
- Explicit return values and typed outcomes are common
- Provider flows frequently return structured snapshots or fetch outcomes instead of ad-hoc dictionaries
## Module Design
- Swift modules are target-based: `CodexBarCore`, `CodexBar`, `CodexBarCLI`, and helper executables
- Shared logic lives in `CodexBarCore`; shells import it rather than duplicating provider logic
- Swift targets rely on module boundaries, not TypeScript-style barrel files
- Registry types act as the discovery/aggregation mechanism for provider implementations
## Testing Conventions
- Tests use Swift Testing with `@Suite`, `@Test`, and `#expect`
- Serialization is declared explicitly for tests that manipulate global hooks like `URLProtocol`
- Inline stubs/fakes are common, such as `StubClaudeFetcher`
- Network-facing tests often use custom `URLProtocol` subclasses like `OpenCodeStubURLProtocol`
- Temporary fake CLIs/scripts are used to exercise shell integration behavior
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- The workspace root is an orchestration/documentation layer, not one executable application
- Hidden directories mirror the same GSD toolkit into multiple agent ecosystems (`.codex`, `.claude`, `.opencode`)
- `CodexBar/` is the only substantial product codebase and contains both a macOS app shell and a reusable provider engine
- Planning state is file-based in `.planning/`, while product runtime state lives inside the nested `CodexBar` app/CLI
## Layers
- Purpose: Ship and mirror GSD assets to different agent runtimes
- Contains: Commands, agents, hooks, templates, workflows, manifests, config
- Depends on: Node.js scripts and installer-managed file manifests
- Used by: Codex, Claude Code, Opencode, GitHub Copilot-style agent flows
- Purpose: Capture discovery, roadmap, and architectural understanding for future work
- Contains: `.planning/` and `ubuntu-extension-analysis/`
- Depends on: Human/agent-authored Markdown, GSD templates and workflows
- Used by: `gsd-*` workflows, project planning, future implementation phases
- Purpose: Provider descriptors, fetch strategies, runtime context, logging, platform gates, and shared domain logic
- Contains: `ProviderDescriptor`, fetch plans, browser/session abstractions, usage models, logging, host/runtime helpers
- Depends on: Swift standard library, `swift-log`, `SweetCookieKit`, platform APIs when available
- Used by: macOS app target, CLI target, watchdog/probe helpers, tests
- Purpose: Present the provider engine through UI, CLI, and platform-specific utilities
- Contains: SwiftUI/AppKit app, CLI command entry points, widget, web probe, watchdog
- Depends on: `CodexBarCore`
- Used by: End users and CI smoke tests
## Data Flow
- Root workspace: file-based state in `.planning/`
- `CodexBar` product: observable in-memory state plus persisted local app settings/history/keychain-backed credentials
## Key Abstractions
- Purpose: Describe one provider’s metadata, branding, CLI identity, token-cost capability, and fetch behavior
- Examples: `CodexBar/Sources/CodexBarCore/Providers/ProviderDescriptor.swift`, provider-specific descriptor files
- Pattern: Registry + strategy/pipeline execution
- Purpose: Carry runtime, source mode, environment, fetchers, and settings into provider execution
- Examples: `ProviderFetchContext`, `ProviderFetchPlan`
- Pattern: Strategy pipeline with availability checks and fallbacks
- Purpose: Central application state for snapshots, errors, credits, status, timers, and refresh coordination
- Examples: `CodexBar/Sources/CodexBar/UsageStore.swift`
- Pattern: Observable state container used by the app shell
- Purpose: Declarative command/skill/template/workflow content for GSD automation
- Examples: `.codex/get-shit-done/workflows/*.md`, `.claude/commands/gsd/*.md`, `.codex/skills/gsd-*`
- Pattern: File-driven orchestration rather than a compiled application module
## Entry Points
- Location: `.codex/config.toml`
- Triggers: Codex session startup and GSD-capable agent operation
- Responsibilities: Register GSD agents, enable hooks, point to managed config files
- Location: `.claude/commands/gsd/`, `.opencode/command/`, mirrored toolkit directories
- Triggers: Slash-command style invocation in those tools
- Responsibilities: Route users into GSD workflows
- Location: `CodexBar/Sources/CodexBar/CodexbarApp.swift`
- Triggers: Launching the packaged app
- Responsibilities: Bootstrap logging, stores, settings, updater, and preferences scenes
- Location: `CodexBar/Sources/CodexBarCLI/CLIEntry.swift`
- Triggers: Running the `CodexBarCLI` executable
- Responsibilities: Parse commands, initialize logging, and dispatch usage/cost/config operations
## Error Handling
- CLI command resolution throws and exits with categorized failure output
- Provider execution records per-provider errors and fetch attempts rather than collapsing all failures into one global exception
- Unsupported platform paths are intentionally surfaced in Linux tests and runtime guards
- GSD/document workflows are file-driven and should fail early when required prerequisites are missing
## Cross-Cutting Concerns
- `CodexBar` bootstraps structured logging to `oslog` or stderr depending on runtime
- Workflow/tooling layers rely on script/CLI output rather than a centralized logging backend
- macOS-only features are isolated in the app shell and web/browser helpers
- Linux support is intentionally narrower and centered on the CLI/backend path
- The same GSD capability is mirrored into multiple agent ecosystems, which creates a cross-cutting need for asset synchronization
- Many provider integrations depend on third-party auth/session models, so fallback logic and defensive testing are part of the architecture, not incidental implementation detail
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

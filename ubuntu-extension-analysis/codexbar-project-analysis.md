---
summary: "Detailed architectural analysis of CodexBar: module boundaries, startup flow, data flow, provider model, and platform constraints."
read_when:
  - Understanding how CodexBar works internally
  - Mapping reusable vs macOS-specific parts
  - Onboarding before building a Linux or Ubuntu variant
---

# CodexBar Project Analysis

## 1. What the project is

CodexBar is a multi-provider usage monitor built primarily as a macOS menu bar application.
It tracks usage, limits, reset windows, credits, status incidents, and account metadata for multiple AI providers.

The project is not structured as a plugin marketplace or a dynamically loaded provider platform.
Instead, it is a compile-time provider system with a shared core and multiple runtime shells.

## 2. Package structure

The package definition in `Package.swift` shows a deliberate split between reusable backend logic and platform-specific
UI/runtime targets.

### Core targets

- `Sources/CodexBarCore`
  - Shared models, provider descriptors, fetch pipelines, parsers, status probes, cookie/browser helpers, PTY/process
    runners, usage fetchers.
- `Sources/CodexBarCLI`
  - Command-line interface that reuses `CodexBarCore`.
- `TestsLinux`
  - Linux-specific validation and platform gating.

### macOS-only targets

- `Sources/CodexBar`
  - Main menu bar app.
- `Sources/CodexBarWidget`
  - WidgetKit surface.
- `Sources/CodexBarClaudeWatchdog`
  - Helper process for stable Claude PTY sessions.
- `Sources/CodexBarClaudeWebProbe`
  - Probe/diagnostics helper around Claude web fetches.

### Architecture consequence

This split is the strongest part of the project design.
It means the team already treated the data acquisition layer as a separate concern from the desktop shell.

## 3. Startup and application lifecycle

The app entrypoint is `Sources/CodexBar/CodexbarApp.swift`.

Startup flow:

1. Bootstrap logging.
2. Configure keychain gating and keychain prompt coordination.
3. Create `PreferencesSelection`.
4. Create `SettingsStore`.
5. Create `UsageFetcher`.
6. Create `BrowserDetection`.
7. Load account info.
8. Create `UsageStore`.
9. Hand the initialized objects to `AppDelegate`.

This startup is simple and centralized.
The important detail is that nearly all long-lived state is funneled into two stores:

- `SettingsStore`
- `UsageStore`

The UI mostly observes those stores rather than owning provider logic directly.

## 4. State model

`Sources/CodexBar/UsageStore.swift` is the operational heart of the app.

It owns:

- provider snapshots
- fetch errors
- source labels
- fetch attempts
- token-account snapshots
- credits/dashboard snapshots
- provider status state
- refresh flags
- path debugging info
- historical pace/history state
- provider runtimes
- timers/tasks

This is effectively an application state orchestrator plus refresh coordinator.

`UsageStore` also watches settings changes and re-triggers refresh work when refresh-relevant settings change.

## 5. Provider architecture

The provider system is descriptor-driven.

Main pieces:

- `UsageProvider`
  - Stable enum of provider ids.
- `ProviderDescriptor`
  - Source of truth for provider metadata, branding, token-cost support, fetch plan, CLI metadata.
- `ProviderFetchPlan`
  - Describes valid source modes and a pipeline resolver.
- `ProviderFetchStrategy`
  - Concrete fetch implementation such as CLI, OAuth, API token, web, local probe.
- `ProviderDescriptorRegistry`
  - Compile-time registry for descriptors.

This is a strong design for extension-like behavior without runtime plugins.

### Why it matters

The app and the CLI both consume the same provider descriptor/fetch pipeline.
That means provider behavior is centralized and mostly UI-agnostic.

### Limitation

It is still compile-time wiring.
Adding a provider requires source changes in:

- `UsageProvider`
- provider descriptor implementation
- app-side provider implementation
- tests/docs

So the system is extensible for developers, but not pluggable for end users.

## 6. Refresh loop and runtime behavior

Actual provider refresh happens in `Sources/CodexBar/UsageStore+Refresh.swift`.

Provider refresh flow:

1. Skip and clear state if provider is disabled.
2. Resolve token-account handling if needed.
3. Build a `ProviderFetchContext`.
4. Execute the provider descriptor's fetch pipeline off the MainActor.
5. Store attempts for debug visibility.
6. On success:
   - scope identity to the provider
   - update snapshots
   - clear errors
   - record history
   - notify provider runtime hooks
7. On failure:
   - apply failure-gate logic
   - either preserve prior data or surface the error
   - notify runtime hooks

This is one of the most reusable parts of the project.

## 7. Settings and detection

`Sources/CodexBar/SettingsStore.swift` is more than a UI preferences object.
It also owns normalized config, provider order, provider enablement, migrations from legacy stores, and token account
management.

`Sources/CodexBar/SettingsStore+ProviderDetection.swift` contains a useful product behavior:
the app auto-detects whether core CLIs are installed and enables some providers accordingly on first launch.

That is a good idea to keep in an Ubuntu version as well.

## 8. UI design and shell behavior

The UI shell is heavily tied to macOS:

- `NSStatusBar`
- `NSStatusItem`
- `NSMenu`
- `NSAlert`
- Sparkle updater
- AppKit/SwiftUI hybrid app lifecycle
- WidgetKit

`StatusItemController` and `StatusItemController+Menu` show that a lot of effort went into:

- multi-provider status items
- merged menu mode
- provider switching
- overview tab
- menu cards
- token account switchers
- dynamic icons/animations

This is well-designed for macOS, but it should be treated as a UX reference only if the target is Ubuntu.

## 9. CLI architecture

The CLI is the clearest proof that the backend has real portability value.

`Sources/CodexBarCLI/CLIEntry.swift` resolves commands and dispatches to usage/cost/config handlers.
`Sources/CodexBarCLI/CLIUsageCommand.swift` builds provider contexts and executes the same fetch pipeline used by the
app.

Important properties of the CLI layer:

- provider selection
- source mode override
- token-account selection
- JSON/text output
- status inclusion
- platform gating for web-only flows

For an Ubuntu extension, this CLI can act as:

- a direct backend
- a temporary compatibility layer
- or the contract source for a future daemon

## 10. Host integrations inside the core

Several host-level utilities already exist in reusable form:

- `Sources/CodexBarCore/Host/PTY/TTYCommandRunner.swift`
- `Sources/CodexBarCore/Host/Process/SubprocessRunner.swift`
- `Sources/CodexBarCore/BrowserDetection.swift`
- provider-specific cookie/token helpers

The PTY runner is especially valuable.
It gives the system a provider-agnostic way to interact with interactive CLIs.

That is directly relevant for Codex and Claude on Linux.

## 11. Web and browser dependencies

The biggest portability boundary is the browser/web integration layer.

Examples:

- browser cookie import via SweetCookieKit and macOS browser profile paths
- WebKit offscreen scraping for OpenAI dashboard extras
- keychain-backed browser decryption concerns

`Sources/CodexBarCore/OpenAIWeb/OpenAIDashboardFetcher.swift` is strongly macOS-only because it depends on WebKit and
on an offscreen window strategy for SPA hydration.

`Sources/CodexBarCore/BrowserDetection.swift` is also currently written around macOS browser locations and Apple
behavior, though the abstraction itself is valuable.

## 12. Testing and delivery quality

The project has unusually broad provider coverage in tests.

The repository contains:

- large XCTest coverage under `Tests/CodexBarTests`
- Linux-specific tests under `TestsLinux`
- CI for macOS and Ubuntu

The CI setup in `.github/workflows/ci.yml` confirms:

- macOS builds/tests the app and its suite
- Ubuntu builds/tests the CLI
- Linux smoke tests explicitly verify that web-only modes fail in the expected way

This is a strong signal that the maintainers already think in terms of a portable backend with platform-specific
capabilities layered on top.

## 13. Strengths

- Clear split between core logic and macOS shell
- Unified provider model shared by app and CLI
- Good descriptor/pipeline abstraction
- Good operational state management in `UsageStore`
- High provider coverage
- Strong test volume
- Existing Linux build path

## 14. Weaknesses and constraints

- Providers are not runtime plugins
- Many provider implementations are still mixed with host-specific assumptions
- Browser/cookie features are highly macOS-shaped
- UI shell is not portable
- Some provider flows depend on secrets/browser state stored in Apple-specific places

## 15. Final assessment

CodexBar should be understood as:

- a strong provider backend reference
- a partially reusable multiplatform engine
- a non-portable macOS UI shell

For an Ubuntu extension, the right move is not "port the app".
The right move is:

1. reuse or mirror the provider core patterns
2. reuse CLI-compatible fetch flows where possible
3. replace the desktop shell completely
4. selectively redesign the providers whose current fetch paths are browser/WebKit-dependent

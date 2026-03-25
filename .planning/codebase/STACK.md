# Technology Stack

**Analysis Date:** 2026-03-25

## Languages

**Primary:**
- Swift 6.2 - Application, CLI, provider engine, tests, and release tooling inside `CodexBar/`
- Markdown - GSD workflows, commands, skills, templates, and analysis docs in the root workspace

**Secondary:**
- JavaScript (CommonJS/Node.js) - GSD installer/tooling under `.codex/get-shit-done/`, mirrored agent assets, and small manifest packages in `.claude/` and `.opencode/`
- Shell - Build, lint, packaging, and local development scripts under `CodexBar/Scripts/`
- TOML / JSON / YAML - Agent config, file manifests, package metadata, and CI configuration

## Runtime

**Environment:**
- macOS 14+ - Required for the full `CodexBar` menubar app, AppKit/SwiftUI shell, Sparkle updater, and browser/keychain integrations
- Linux (Ubuntu CI verified) - Supported for `CodexBarCLI` and Linux-only tests, but not for macOS-only web/browser features
- Node.js - Required for GSD orchestration scripts, hooks, and installer assets mirrored into `.codex/`, `.claude/`, and `.opencode/`

**Package Manager:**
- Swift Package Manager - Primary package/build system for `CodexBar/`
- npm/pnpm-style script layer - Present in `CodexBar/package.json` for developer ergonomics around build/test/lint/release
- No single root package manager - The workspace root is a meta-repo, not one installable app

## Frameworks

**Core:**
- SwiftUI + AppKit - Desktop shell for `CodexBar`
- Swift Observation - Reactive state updates in app-facing stores such as `UsageStore`
- Commander - CLI argument parsing for `CodexBarCLI`
- SwiftLog - Shared logging pipeline in `CodexBarCore`

**Desktop/Product Dependencies:**
- Sparkle - macOS auto-update flow
- KeyboardShortcuts - User-configurable shortcuts in the macOS app
- SweetCookieKit - Browser cookie import for web-backed providers
- SwiftSyntax / macros - Macro support targets used by the Swift package

**Testing:**
- Swift Testing - Main test framework via `Testing`, `@Suite`, `@Test`, and `#expect`
- GitHub Actions - CI for macOS lint/build/test and Linux CLI build/smoke coverage

**Build/Dev:**
- SwiftFormat - Formatting with Swift 6.2-aware config
- SwiftLint - Linting with project-specific rule set
- Node scripts - Auxiliary documentation and workflow tooling

## Key Dependencies

**Critical:**
- `Sparkle` - App update distribution for the macOS build
- `Commander` - Command routing and parsing for the CLI entry point
- `swift-log` / `Logging` - Shared structured logging across app and CLI
- `SweetCookieKit` - Cookie import for providers that rely on browser session state
- `swift-syntax` - Macro/plugin support in the Swift package

**Infrastructure:**
- GitHub Actions - CI orchestration for macOS and Ubuntu runners
- `Testing` module - Assertion and suite framework used throughout `CodexBar/Tests*`
- Local GSD assets - Workflow engine and command/skill distribution mirrored into hidden tool directories

## Configuration

**Environment:**
- Root agent behavior is configured through `.codex/config.toml`, mirrored manifests, and hook registration
- `CodexBar` uses environment variables for logging and local dependency overrides, notably `CODEXBAR_LOG_LEVEL` and `CODEXBAR_USE_LOCAL_SWEETCOOKIEKIT`
- Provider-specific credentials are resolved by the product code from local OS/browser/account state rather than a root `.env` file

**Build:**
- `CodexBar/Package.swift` - Swift package targets, dependencies, and platform gating
- `CodexBar/package.json` - Developer commands for start/build/test/lint/release
- `CodexBar/.swiftformat` and `CodexBar/.swiftlint.yml` - Code style enforcement
- `CodexBar/.github/workflows/ci.yml` - CI matrix and platform checks

## Platform Requirements

**Development:**
- macOS is required to work on the full `CodexBar` desktop product
- Ubuntu/Linux is sufficient for `CodexBarCLI`, Linux tests, and the future Ubuntu extension backend work
- Node.js is required to use the GSD workflow assets stored in the workspace root

**Production:**
- The current shipped desktop product targets macOS only
- The root repository itself is not deployed as a standalone service; it acts as a planning/orchestration workspace plus a nested product repo
- A future Ubuntu extension should treat `CodexBarCore` and `CodexBarCLI` as reusable backend pieces rather than porting the macOS shell directly

---

*Stack analysis: 2026-03-25*
*Update after major dependency or platform changes*

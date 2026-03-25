# Coding Conventions

**Analysis Date:** 2026-03-25

## Naming Patterns

**Files:**
- `kebab-case.md` for GSD commands, workflows, and many documentation files
- `PascalCase.swift` for Swift source and test files in `CodexBar/`
- `*Tests.swift` for test files, usually grouped under `Tests/CodexBarTests/`

**Functions:**
- Swift code uses `camelCase` for functions and methods
- Async functions are not prefixed specially; async-ness is conveyed by signature
- Test functions often use backticked descriptive names, for example ``func `descriptor registry is complete and deterministic`()`` 

**Variables:**
- `camelCase` for local variables and stored properties
- `UPPER_SNAKE_CASE` is uncommon in Swift code; constants are usually still `camelCase`
- No underscore-heavy private naming convention was observed; access control and scope do the work

**Types:**
- `PascalCase` for structs, enums, protocols, actors, and classes
- Protocols are plain names such as `ClaudeUsageFetching`, not `I*` prefixed
- Registry/store/domain types are descriptive and explicit rather than abbreviated

## Code Style

**Formatting:**
- `SwiftFormat` is authoritative for `CodexBar`
- 4-space indentation
- 120-character soft limit in both SwiftFormat and SwiftLint
- Explicit `self` is intentionally inserted to stay compatible with Swift 6 strict concurrency
- `MARK:` sections are used heavily to organize larger files

**Linting:**
- `SwiftLint` runs on `Sources` and `Tests`
- Many stylistic rules are delegated to SwiftFormat
- Some stricter rules are intentionally disabled to fit the current codebase, including `todo`, `file_name`, and `explicit_self`
- Complexity and size guards exist, but with pragmatic thresholds rather than extremely tight caps

## Import Organization

**Order:**
1. Product/internal imports
2. Platform/framework imports
3. `@testable import` or testable imports at the bottom in tests

**Grouping:**
- SwiftFormat is configured with `--importgrouping testable-bottom`
- Imports are compact and usually separated only when platform conditionals matter

**Path Aliases:**
- None observed in Swift
- Directory structure and module names act as the import contract

## Error Handling

**Patterns:**
- Throw errors from product code and catch them at application or CLI boundaries
- Use provider-specific error types and platform-gated error cases where appropriate
- Prefer explicit branching on error types in tests and provider fallback logic

**Error Types:**
- Failures that matter to routing/fallback are modeled with domain-specific enums
- CLI exits categorize argument/runtime failures instead of dumping raw stack traces
- Tests frequently assert exact failure behavior via `#expect(throws:)`

## Logging

**Framework:**
- `swift-log` / `CodexBarLog` in the product code
- `oslog` for the macOS app path and stderr for CLI/log-oriented paths

**Patterns:**
- Log bootstrap happens early at app/CLI entry points
- Logging is treated as a first-class operational concern around provider refresh, session state, and diagnostics
- Root planning/workflow docs themselves are not code-logged; they are stateful Markdown artifacts

## Comments

**When to Comment:**
- Comments explain platform quirks, lifecycle workarounds, regression context, or why a behavior exists
- Short doc comments are used where architecture would otherwise be opaque
- `MARK:` separators are common and useful

**Observed Style:**
- Comments tend to explain why a workaround is needed, not restate the next line
- Tests often include regression references and scenario framing in comments

**TODO Comments:**
- `todo` is not lint-blocked, but TODOs were not the dominant coordination mechanism in the inspected files
- Planning/roadmap files appear to be the preferred place for larger future-work tracking

## Function Design

**Size:**
- The codebase allows large files and large types where needed, especially in store and provider modules
- Complex logic is often still broken into helper methods or nested supporting types

**Parameters:**
- Swift initializer and context objects are favored when multiple dependencies must travel together
- Provider execution is driven by rich context structs rather than long positional parameter chains

**Return Values:**
- Explicit return values and typed outcomes are common
- Provider flows frequently return structured snapshots or fetch outcomes instead of ad-hoc dictionaries

## Module Design

**Exports:**
- Swift modules are target-based: `CodexBarCore`, `CodexBar`, `CodexBarCLI`, and helper executables
- Shared logic lives in `CodexBarCore`; shells import it rather than duplicating provider logic

**Barrel Files:**
- Swift targets rely on module boundaries, not TypeScript-style barrel files
- Registry types act as the discovery/aggregation mechanism for provider implementations

## Testing Conventions

**Framework Pattern:**
- Tests use Swift Testing with `@Suite`, `@Test`, and `#expect`
- Serialization is declared explicitly for tests that manipulate global hooks like `URLProtocol`

**Test Doubles:**
- Inline stubs/fakes are common, such as `StubClaudeFetcher`
- Network-facing tests often use custom `URLProtocol` subclasses like `OpenCodeStubURLProtocol`
- Temporary fake CLIs/scripts are used to exercise shell integration behavior

---

*Convention analysis: 2026-03-25*
*Update when formatting, testing, or style rules change*

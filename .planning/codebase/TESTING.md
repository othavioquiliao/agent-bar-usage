# Testing Patterns

**Analysis Date:** 2026-03-25

## Test Framework

**Runner:**
- Swift Testing (`import Testing`)
- Config lives in `CodexBar/Package.swift` through `testTarget` declarations and experimental Swift Testing enablement

**Assertion Library:**
- Built-in Swift Testing expectations
- Matchers/patterns observed: `#expect(...)`, `#expect(throws:)`, `Issue.record(...)`

**Run Commands:**
```bash
cd CodexBar && swift test                 # Run the full Swift package test suite
cd CodexBar && swift test --parallel      # Parallelized test run, used in Linux CI
cd CodexBar && swift test --no-parallel   # Serialized run, used in macOS CI
cd CodexBar && npm test                   # Convenience wrapper around swift test
cd CodexBar && npm run test:tty           # TTY-focused subset
cd CodexBar && npm run test:live          # Live account tests when explicitly enabled
```

## Test File Organization

**Location:**
- `CodexBar/Tests/CodexBarTests/` for the main test suite
- `CodexBar/TestsLinux/` for Linux-only platform gating tests

**Naming:**
- `*Tests.swift` for most files
- Test names are descriptive sentences in backticks rather than terse camelCase-only labels

**Structure:**
```text
CodexBar/
├── Tests/
│   └── CodexBarTests/
│       ├── ProviderRegistryTests.swift
│       ├── ClaudeSourcePlannerTests.swift
│       ├── OpenCodeUsageFetcherErrorTests.swift
│       └── ...
└── TestsLinux/
    └── PlatformGatingTests.swift
```

## Test Structure

**Suite Organization:**
```swift
import Testing
@testable import CodexBarCore

struct ProviderRegistryTests {
    @Test
    func `descriptor registry is complete and deterministic`() {
        let descriptors = ProviderDescriptorRegistry.all
        #expect(!descriptors.isEmpty)
    }
}
```

**Patterns:**
- Keep one file focused on one subsystem or regression area
- Use descriptive, behavior-oriented test names
- Prefer direct arrange/act/assert flow inside the test body
- Use `@Suite(.serialized)` when global state such as `URLProtocol` registration would make parallel execution unsafe

## Mocking

**Framework:**
- No dedicated third-party mocking library was observed
- Test doubles are hand-written in Swift

**Patterns:**
```swift
private struct StubClaudeFetcher: ClaudeUsageFetching {
    func loadLatestUsage(model _: String) async throws -> ClaudeUsageSnapshot {
        throw ClaudeUsageError.parseFailed("stub")
    }
}
```

```swift
final class OpenCodeStubURLProtocol: URLProtocol {
    nonisolated(unsafe) static var handler: ((URLRequest) throws -> (HTTPURLResponse, Data))?
}
```

**What to Mock:**
- External HTTP interactions via `URLProtocol` subclasses
- Provider fetch collaborators through protocol-based stubs
- CLI/process behavior with temporary fake binaries or stub shell scripts

**What NOT to Mock:**
- Registry ordering and pure planning logic are usually tested directly
- Simple deterministic domain logic is commonly exercised with real types

## Fixtures and Factories

**Test Data:**
- Inline builders and helper functions are preferred over a large shared fixture framework
- Temporary directories/files are created on demand when testing CLI/path behavior
- Request handler closures on stub `URLProtocol` classes act as ad-hoc scenario fixtures

**Location:**
- Helpers usually live in the same test file as the scenarios they support
- Linux platform checks are isolated in `TestsLinux/`

## Coverage

**Current Shape:**
- Coverage appears broad around provider behavior, planner logic, platform gating, and fetch fallbacks
- The main suite is substantial: 149 files under `CodexBar/Tests/`
- Linux-specific coverage is intentionally small and focused: 2 files under `CodexBar/TestsLinux/`

**Enforcement:**
- No explicit percentage threshold was observed in the inspected files
- CI enforces test execution rather than a published coverage gate

## Test Types

**Unit Tests:**
- Registry determinism, planner logic, parser behavior, availability logic, and error formatting
- Usually fast and isolated

**Integration Tests:**
- Provider fetchers with stubbed HTTP layers
- CLI resolution and process-invocation behavior
- Platform-gated behavior across macOS/Linux

**Live Tests:**
- Explicitly opt-in via `LIVE_TEST=1`
- Intended for real-account/provider verification rather than default CI

## Common Patterns

**Async Testing:**
```swift
@Test
func `extracts api error from detail field`() async throws {
    do {
        _ = try await OpenCodeUsageFetcher.fetchUsage(...)
        Issue.record("Expected error")
    } catch let error as OpenCodeUsageError {
        #expect(...)
    }
}
```

**Error Testing:**
```swift
let error = await #expect(throws: ClaudeWebAPIFetcher.FetchError.self) {
    _ = try await ClaudeWebAPIFetcher.fetchUsage()
}
```

**Platform Testing:**
- `#if os(Linux)` branches are used inside tests when the same file must compile cross-platform
- Linux smoke coverage ensures unsupported web paths fail explicitly instead of silently misbehaving

**Snapshot Testing:**
- No dedicated snapshot-testing framework was observed in the inspected files

---

*Testing analysis: 2026-03-25*
*Update when test runner, organization, or CI expectations change*

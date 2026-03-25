# Codebase Concerns

**Analysis Date:** 2026-03-25

## Tech Debt

**Root workspace identity is ambiguous:**
- Issue: The root repo contains mirrored GSD assets, planning docs, and a nested product repo rather than one coherent application
- Why: It is being used as a multi-purpose workspace for agent orchestration and product incubation
- Impact: New contributors can easily modify the wrong layer or assume the root is the product itself
- Fix approach: Keep `.planning/codebase/` and future `PROJECT.md` explicit about the root-as-workspace model, and document which repo owns which behavior

**Mirrored toolkit assets can drift:**
- Issue: `.codex/`, `.claude/`, and `.opencode/` all carry overlapping GSD assets
- Why: The toolkit is distributed into multiple agent ecosystems
- Impact: Editing one mirror directly can create silent divergence between agents
- Fix approach: Treat manifests and installer-managed sources as the canonical update path; avoid ad-hoc one-off edits inside a single mirror

**Ubuntu target is not implemented yet:**
- Issue: The workspace contains research for an Ubuntu extension, but no Ubuntu shell implementation
- Why: Current product code is still centered on the macOS app
- Impact: It is easy to overestimate how much of `CodexBar` ports directly
- Fix approach: Build the Ubuntu effort as a new shell around `CodexBarCore`/`CodexBarCLI`, not as an AppKit port

## Known Bugs / Behavioral Risks

**Mac-only feature assumptions in the product shell:**
- Symptoms: Browser import, WebKit-backed extras, updater behavior, and status-bar UI do not translate to Linux
- Trigger: Attempting to reuse `CodexBar/Sources/CodexBar/` as the basis for Ubuntu work
- Workaround: Restrict Linux work to `CodexBarCore` and `CodexBarCLI`
- Root cause: The shell layer is intentionally AppKit/SwiftUI-centric

**Provider behavior can change underneath the app:**
- Symptoms: Scrapers, cookie-based fetchers, or undocumented endpoints stop working without local code changes
- Trigger: Third-party provider dashboard/API/session changes
- Workaround: Keep fallback paths and targeted provider tests up to date
- Root cause: Several integrations depend on external systems not controlled by this repo

## Security Considerations

**Credential-heavy local integrations:**
- Risk: Provider flows rely on OAuth tokens, CLI auth state, cookies, or keychain material
- Current mitigation: Product code separates provider contexts and uses OS/browser-local sources rather than storing secrets in root docs
- Recommendations: Keep planning/docs scrubbed of secrets, and treat provider debug logging as sensitive

**Managed docs can accidentally capture sensitive output:**
- Risk: `.planning/` and analysis docs are easy places to paste tokens, cookies, or account identifiers during debugging
- Current mitigation: None intrinsic beyond reviewer discipline
- Recommendations: Run secret scans on planning artifacts before committing and avoid verbatim credential dumps in Markdown

## Performance Bottlenecks

**Centralized refresh/store orchestration in `UsageStore`:**
- Problem: One store coordinates many provider refreshes, timers, and historical state concerns
- Cause: The macOS app chooses a single observable coordinator for broad UI state
- Improvement path: Preserve the central store for the existing app, but avoid copying the whole app-state model into a future Ubuntu shell if a smaller daemon/interface would suffice

**Web-backed provider flows are inherently slower and less deterministic:**
- Problem: Browser/session/dashboard fetches are slower and more failure-prone than direct API or CLI reads
- Cause: They depend on cookies, rendered web flows, and external page behavior
- Improvement path: Prefer OAuth/API/CLI paths where possible and reserve web scraping for features that truly require it

## Fragile Areas

**Nested git repositories:**
- Why fragile: The root repo and `CodexBar/` have separate git histories and intentions
- Common failures: Committing to the wrong repo, assuming one clean status reflects both
- Safe modification: Check git status in both contexts before committing product work
- Test coverage: Not applicable; this is a workflow risk rather than a code-path risk

**Installer-managed hidden directories:**
- Why fragile: These directories are partly generated/mirrored and tied to manifests
- Common failures: One-off edits in `.claude/` or `.opencode/` without corresponding changes elsewhere
- Safe modification: Prefer changing the canonical toolkit source path and then regenerating or syncing mirrors
- Test coverage: There is no visible root-level automated guard against cross-mirror drift

**Provider registry completeness:**
- Why fragile: New providers require coordinated enum/descriptor/metadata wiring
- Common failures: Missing registry entries, ordering regressions, unsupported platform paths
- Safe modification: Add provider tests alongside descriptor changes and verify registry determinism
- Test coverage: Good in the nested Swift repo, but still dependent on maintaining discipline for each new provider

## Scaling Limits

**Human maintainability of provider count:**
- Current capacity: The descriptor registry already spans many providers
- Limit: Each additional provider increases test surface, auth permutations, and platform-specific risk
- Symptoms at limit: Slower onboarding, more brittle fallback logic, and regressions in rarely used providers
- Scaling path: Keep the descriptor/fetch-plan abstraction consistent and avoid provider-specific logic leaking into shells

## Dependencies at Risk

**Third-party provider dashboards and cookies:**
- Risk: Undocumented or semi-documented behavior can change without notice
- Impact: Web/session-backed providers break first and often
- Migration plan: Favor official API/OAuth/CLI paths whenever they exist, and treat web-based probes as fallback-only where possible

**Sparkle / macOS-only shell dependencies:**
- Risk: Useful for the Mac app, irrelevant for Ubuntu work
- Impact: They create false coupling if reused as architectural defaults for the new extension
- Migration plan: Keep them isolated to the macOS shell and exclude them from Ubuntu planning

## Missing Critical Features

**No executable Ubuntu extension yet:**
- Problem: The workspace currently holds analysis only
- Current workaround: Use the docs in `ubuntu-extension-analysis/` plus `CodexBarCLI`/`CodexBarCore` as a planning baseline
- Blocks: Any actual Ubuntu user workflow, packaging, or shell-level validation
- Implementation complexity: Medium to high, depending on GNOME Shell/AppIndicator approach and provider auth requirements

## Test Coverage Gaps

**Root workspace behavior:**
- What's not tested: Synchronization and consistency of mirrored GSD assets across `.codex/`, `.claude/`, and `.opencode/`
- Risk: Tooling surfaces drift while appearing locally “fine” in one ecosystem
- Priority: Medium
- Difficulty to test: Mostly repository/process automation rather than unit testing

**Future Ubuntu path:**
- What's not tested: Any Ubuntu-specific shell integration, packaging, or extension lifecycle
- Risk: Architecture decisions may drift toward macOS assumptions unnoticed
- Priority: High for the new project, currently expected because the feature does not exist yet
- Difficulty to test: Requires creating the new shell and deciding its runtime boundary first

---

*Concerns audit: 2026-03-25*
*Update as architectural risks are reduced or new platform work begins*

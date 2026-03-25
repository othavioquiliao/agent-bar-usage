# External Integrations

**Analysis Date:** 2026-03-25

## APIs & External Services

**AI Provider Services (via `CodexBar`):**
- OpenAI / Codex - Usage, credits, and dashboard-related provider flows
  - Integration method: CLI, OAuth, and web-backed flows depending on provider/source mode
  - Auth: Local account state, OAuth credentials, or imported browser cookies
  - Notes: Some extras rely on browser-rendered/web session behavior and are macOS-specific today
- Anthropic / Claude - Usage retrieval via OAuth, CLI, and web strategies
  - Integration method: Multi-strategy fetch planning in `CodexBarCore`
  - Auth: OAuth credentials, CLI session, or web cookies
  - Notes: Linux support exists for non-web paths; web/session probing is platform-gated
- GitHub Copilot - Copilot entitlement/usage retrieval
  - Integration method: GitHub API/device-flow backed login and fetch paths
  - Auth: GitHub account tokens or device login flow
- Cursor and other providers - Provider-specific status and usage probing
  - Integration method: Often browser-cookie or undocumented web/API behavior
  - Risk: Higher fragility because these integrations depend on third-party site behavior

**Browser Session Integration:**
- Local browser cookie stores - Used by web-backed providers that need authenticated sessions
  - SDK/Client: `SweetCookieKit`
  - Auth: Imported browser cookies from supported browsers
  - Notes: This is one of the main macOS-specific seams in the current product

## Data Storage

**Databases:**
- None observed at the workspace root
- None observed in `CodexBar` as a primary application database

**Local Persistent Storage:**
- `.planning/` - File-based planning state for GSD workflows at the workspace root
  - Contents: `PROJECT.md`, future roadmap/phase artifacts, codebase map docs
  - Access pattern: Written by workflow tooling and agent-driven documentation work
- macOS local app storage - Used by `CodexBar` for settings/history/persistence
  - Connection: UserDefaults, app support files, keychain-backed state, local history stores
  - Notes: This is app-local persistence, not shared infrastructure

**File Storage:**
- Git-tracked Markdown/JSON/TOML/YAML assets - Source of truth for GSD commands, skills, manifests, and docs
- No cloud object storage or blob service was found in the inspected workspace

## Authentication & Identity

**Auth Providers in `CodexBar`:**
- OpenAI/Codex, Anthropic/Claude, GitHub/Copilot, Cursor, and other provider accounts
  - Implementation: Provider-specific login flows and credential resolution in `CodexBar`
  - Token storage: macOS keychain or provider-local session state where applicable
  - Session management: Combination of CLI auth state, OAuth tokens, and imported web sessions

**Agent Tooling Identity:**
- GitHub Copilot instructions and agent manifests shape behavior for Copilot, Codex, Claude, and Opencode tooling
  - Credentials: Managed by the external agent tools, not by this root repo directly
  - Notes: The root repo stores instructions/assets, not centralized auth for those tools

## Monitoring & Observability

**Application Logging:**
- `swift-log` / `oslog` / stderr logging in `CodexBar`
  - Integration: Bootstrapped in app and CLI entry points
  - Levels: Controlled by app settings and CLI flags/environment

**Error Tracking:**
- No external SaaS error tracker was found in the inspected files
- CI and local logging appear to be the primary observability mechanisms

## CI/CD & Deployment

**CI Pipeline:**
- GitHub Actions - `CodexBar/.github/workflows/ci.yml`
  - Workflows: macOS lint/build/test and Ubuntu CLI build/test/smoke jobs
  - Secrets: Not visible in repo; expected to live in GitHub Actions settings if needed

**Desktop Distribution:**
- Sparkle appcast - Update distribution path for the macOS app
  - Deployment: Appcast-driven update checks for signed/bundled builds
  - Constraint: Disabled in non-bundled or Homebrew-managed scenarios

## Environment Configuration

**Development:**
- Root workflow config lives in `.codex/config.toml`
- Hidden mirrors `.codex/`, `.claude/`, and `.opencode/` contain installer-managed assets and manifests
- `CodexBar` uses local env switches for logging and dependency overrides, plus provider-local credentials

**Staging / Production:**
- No conventional staging/production server environments were found for the root workspace
- `CodexBar` behaves as a local desktop app, so most “production” config is local machine state plus signed app packaging

## Webhooks & Callbacks

**Incoming:**
- None observed in the inspected workspace

**Outgoing:**
- None observed as a generalized webhook system
- Provider API calls are request/response fetches initiated by the desktop app or CLI, not webhook-driven flows

---

*Integration audit: 2026-03-25*
*Update when adding or removing provider, CI, or platform integrations*

# Roadmap: Agent Bar Ubuntu

## Milestones

- ✅ **v1.0 Ubuntu v1 MVP** -- Phases 1-6 (shipped 2026-03-25)
- ✅ **v1.1 Provider Reliability** -- Phases 6-7 (shipped 2026-03-26)
- 🚧 **v2.0 Refactor & Polish** -- Phases 8-12 (in progress)

## Phases

<details>
<summary>✅ v1.0 Ubuntu v1 MVP (Phases 1-6) -- SHIPPED 2026-03-25</summary>

- [x] Phase 1: Backend Contract -- completed 2026-03-25
- [x] Phase 2: Linux Config & Secrets -- completed 2026-03-25
- [x] Phase 3: First-Wave Providers -- completed 2026-03-25
- [x] Phase 4: Ubuntu Desktop Surface -- completed 2026-03-25
- [x] Phase 5: Delivery & Hardening -- completed 2026-03-25
- [x] Phase 6: Provider Reliability -- completed 2026-03-25

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Provider Reliability (Phases 6-7) -- SHIPPED 2026-03-26</summary>

- [x] Phase 6: Provider Reliability -- completed 2026-03-26
- [x] Phase 7: GNOME Extension UI Redesign -- completed 2026-03-26

Full details: `.planning/milestones/v1.1-ROADMAP.md`

</details>

### 🚧 v2.0 Refactor & Polish

**Milestone Goal:** Refatorar o Agent Bar Ubuntu para uma arquitetura modular e eficiente inspirada no agent-bar-omarchy, migrando para Bun, eliminando dependencias desnecessarias, e entregando uma experiencia de onboarding/update/CLI de qualidade.

- [ ] **Phase 8: Bun Runtime Migration** - Backend runs on Bun with native PTY, Unix socket IPC, and zero build step
- [ ] **Phase 9: Lifecycle Commands** - Users can setup, remove, update, and uninstall via TypeScript commands with versioned settings
- [ ] **Phase 10: CLI Overhaul** - CLI uses manual parsing without Commander/Zod, with Biome enforcing code quality
- [ ] **Phase 11: Provider Independence & Data** - Each provider is a self-contained module with file-based cache, auto-refresh, and locale-aware formatting
- [ ] **Phase 12: Terminal UI & Code Quality** - Interactive TUI with @clack/prompts, bug fixes, and real OAuth App registration

## Phase Details

### Phase 8: Bun Runtime Migration
**Goal**: Backend service runs entirely on Bun runtime with no Node.js dependency, using Bun-native APIs for PTY, IPC, and TypeScript execution
**Depends on**: Phase 7 (v1.1 baseline)
**Requirements**: RUNTIME-01, RUNTIME-02, RUNTIME-03, RUNTIME-04
**Success Criteria** (what must be TRUE):
  1. Running `bun run src/main.ts` starts the backend service and responds to CLI queries
  2. Codex and Claude CLI providers execute through Bun.Terminal API and return usage data
  3. CLI-to-daemon communication works over a Unix socket created with Bun.serve({ unix })
  4. Developer can edit a .ts file and re-run immediately without any build/compile step
**Plans:** 3 plans
Plans:
- [x] 08-01-PLAN.md -- Runtime infrastructure: tsconfig, package.json, bunfig, shebang, shared-contract exports
- [x] 08-02-PLAN.md -- Subprocess and PTY migration: Bun.spawn for subprocess.ts, interactive-command.ts, codex-appserver-fetcher.ts
- [x] 08-03-PLAN.md -- IPC socket migration: Bun.listen/connect for service-server.ts and service-client.ts

### Phase 9: Lifecycle Commands
**Goal**: Users can install, remove, update, and fully uninstall Agent Bar through interactive TypeScript commands that manage systemd, GNOME extension, and settings safely
**Depends on**: Phase 8
**Requirements**: LIFE-01, LIFE-02, LIFE-03, LIFE-04, DATA-04
**Success Criteria** (what must be TRUE):
  1. Running `agent-bar setup` installs the CLI symlink, systemd service, and GNOME extension with interactive prompts
  2. Running `agent-bar remove` removes all installed files but leaves GNOME Keyring secrets intact
  3. Running `agent-bar update` pulls latest code, rebuilds, and restarts the systemd service without manual intervention
  4. Running `agent-bar uninstall` removes everything including secrets after explicit user confirmation
  5. Settings file includes a version field and migrates automatically when the schema changes across updates
**Plans:** 3 plans
Plans:
- [x] 09-01-PLAN.md -- Foundation: @clack/prompts install, lifecycle paths, dependency check, versioned settings module
- [x] 09-02-PLAN.md -- Setup + Update commands: interactive install and update flows with @clack/prompts
- [x] 09-03-PLAN.md -- Remove + Uninstall + CLI wiring: destructive commands and Commander registration

### Phase 10: CLI Overhaul
**Goal**: CLI routes commands through manual argument parsing with helpful error messages and the codebase uses Biome for consistent formatting and linting
**Depends on**: Phase 9
**Requirements**: CLI-01, CLI-02, CLI-03, QUAL-01
**Success Criteria** (what must be TRUE):
  1. Typing a misspelled command (e.g., `agent-bar stup`) suggests the correct command via Levenshtein distance
  2. Running `agent-bar --help` displays formatted help with box-drawing characters listing all available commands
  3. Invalid config or snapshot data is rejected at runtime by inline type guards without Zod
  4. Running `bun x biome check` passes on the entire codebase with zero errors
**Plans**: TBD

### Phase 11: Provider Independence & Data
**Goal**: Each provider is a self-contained module with zero cross-imports, backed by file-based cache with TTL, periodic auto-refresh, and locale-aware data formatting
**Depends on**: Phase 10
**Requirements**: PROV-01, PROV-02, PROV-03, PROV-04, DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. Adding or removing a provider module requires zero changes to other provider files
  2. Running `agent-bar providers` lets the user select which providers appear in the GNOME topbar
  3. Provider usage data auto-refreshes periodically without manual intervention (default 150s interval)
  4. Restarting the backend service serves cached data immediately from XDG_CACHE_HOME files until fresh data arrives
  5. Date/time values in CLI output and GNOME extension use locale-aware formatting (e.g., "2 hours ago")
**Plans**: TBD
**UI hint**: yes

### Phase 12: Terminal UI & Code Quality
**Goal**: Users interact with Agent Bar through a polished interactive TUI and remaining bugs, code smells, and the OAuth placeholder are resolved
**Depends on**: Phase 11
**Requirements**: TUI-01, TUI-02, TUI-03, TUI-04, QUAL-02, QUAL-03
**Success Criteria** (what must be TRUE):
  1. Running `agent-bar` with no arguments opens an interactive menu with List All, Configure Providers, Provider Login, and Doctor actions
  2. Terminal quota display shows Unicode progress bars with the One Dark Pro color palette
  3. Running `agent-bar doctor` shows check results with spinners and colored pass/fail indicators via @clack/prompts
  4. Provider login TUI guides the user through auth flows for each provider with step-by-step prompts
  5. The DEFAULT_CLIENT_ID placeholder is replaced with a real registered GitHub OAuth App client ID
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 8 -> 9 -> 10 -> 11 -> 12

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Backend Contract | v1.0 | 3/3 | Complete | 2026-03-25 |
| 2. Linux Config & Secrets | v1.0 | 3/3 | Complete | 2026-03-25 |
| 3. First-Wave Providers | v1.0 | 3/3 | Complete | 2026-03-25 |
| 4. Ubuntu Desktop Surface | v1.0 | 3/3 | Complete | 2026-03-25 |
| 5. Delivery & Hardening | v1.0 | 3/3 | Complete | 2026-03-25 |
| 6. Provider Reliability | v1.1 | 2/2 | Complete | 2026-03-26 |
| 7. GNOME Extension UI Redesign | v1.1 | 3/3 | Complete | 2026-03-26 |
| 8. Bun Runtime Migration | v2.0 | 0/3 | Not started | - |
| 9. Lifecycle Commands | v2.0 | 0/3 | Not started | - |
| 10. CLI Overhaul | v2.0 | 0/TBD | Not started | - |
| 11. Provider Independence & Data | v2.0 | 0/TBD | Not started | - |
| 12. Terminal UI & Code Quality | v2.0 | 0/TBD | Not started | - |

# Roadmap: Agent Bar Ubuntu

## Milestones

- ✅ **v1.0 Ubuntu v1 MVP** -- Phases 1-6 (shipped 2026-03-25)
- ✅ **v1.1 Provider Reliability** -- Phases 6-7 (shipped 2026-03-26)
- ✅ **v2.0 Refactor & Polish** -- Phases 8-12 (shipped 2026-03-29)
- **v2.1 Stability & Hardening** -- Phases 13-16 (in progress)

## Phases

<details>
<summary>v1.0 Ubuntu v1 MVP (Phases 1-6) -- SHIPPED 2026-03-25</summary>

- [x] Phase 1: Backend Contract -- completed 2026-03-25
- [x] Phase 2: Linux Config & Secrets -- completed 2026-03-25
- [x] Phase 3: First-Wave Providers -- completed 2026-03-25
- [x] Phase 4: Ubuntu Desktop Surface -- completed 2026-03-25
- [x] Phase 5: Delivery & Hardening -- completed 2026-03-25
- [x] Phase 6: Provider Reliability -- completed 2026-03-25

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>v1.1 Provider Reliability (Phases 6-7) -- SHIPPED 2026-03-26</summary>

- [x] Phase 6: Provider Reliability -- completed 2026-03-26
- [x] Phase 7: GNOME Extension UI Redesign -- completed 2026-03-26

Full details: `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>v2.0 Refactor & Polish (Phases 8-12) -- SHIPPED 2026-03-29</summary>

- [x] Phase 8: Bun Runtime Migration -- completed 2026-03-29
- [x] Phase 9: Lifecycle Commands -- completed 2026-03-29
- [x] Phase 10: CLI Overhaul -- completed 2026-03-29
- [x] Phase 11: Provider Independence & Data -- completed 2026-03-29
- [x] Phase 12: Terminal UI & Code Quality -- completed 2026-03-29

Full details: `.planning/milestones/v2.0-ROADMAP.md`

</details>

### v2.1 Stability & Hardening (In Progress)

**Milestone Goal:** Corrigir os 24 issues encontrados no audit do codebase -- seguranca, memory leaks, production hardening, e developer experience. Zero novas dependencias.

- [ ] **Phase 13: Critical Security & Stability Fixes** - Fix all P0/P1 issues: memory leak, shell injection, atomic writes, error handlers, subprocess timeouts
- [ ] **Phase 14: Quality Gate & Production Hardening** - Stricter lint rules, systemd hardening, theme awareness, schema versioning
- [ ] **Phase 15: Developer Experience & Refactors** - Workspace scripts, contributor docs, provider helpers, code dedup
- [ ] **Phase 16: UX Polish** - i18n preparation and retry semantics fix

## Phase Details

### Phase 13: Critical Security & Stability Fixes
**Goal**: The service cannot be exploited, does not leak memory, does not corrupt data, does not hang on slow providers, and does not die silently
**Depends on**: Phase 12 (v2.0 complete)
**Requirements**: SEC-01, SEC-02, STAB-01, STAB-02, STAB-03, STAB-04, STAB-05, STAB-06
**Success Criteria** (what must be TRUE):
  1. Running `agent-bar auth copilot` with a crafted provider name containing shell metacharacters does not execute arbitrary commands -- `xdg-open` is invoked via `Bun.spawn` array, not shell interpolation
  2. The GNOME indicator can poll and re-render for 1+ hour without Clutter actor count growing -- `destroy()` is called on every removed actor before clearing references
  3. Killing the backend mid-write to `~/.cache/agent-bar/` and restarting produces a valid (or empty) cache file -- writes use temp+rename in the same directory
  4. The service process logs fatal errors to stderr/journal and exits cleanly on uncaughtException, unhandledRejection, and SIGTERM -- no silent deaths, socket file cleaned up
  5. A provider fetch that hangs indefinitely is killed within the configured timeout -- backend coordinator, GNOME extension backend-client, and Codex appserver subprocess all have enforced time limits
**Plans**: TBD

### Phase 14: Quality Gate & Production Hardening
**Goal**: The codebase has stricter lint enforcement and the production service is resource-limited, theme-aware, and schema-safe
**Depends on**: Phase 13
**Requirements**: QUAL-01, QUAL-02, HARD-01, HARD-02, HARD-03, HARD-04
**Success Criteria** (what must be TRUE):
  1. `bun run lint` enforces `noExplicitAny`, `noNonNullAssertion`, and `useNodejsImportProtocol` with zero violations -- stricter Biome rules are active and passing
  2. The systemd user service has `MemoryMax`, `TasksMax`, and `StartLimitBurst` directives -- a runaway process is killed by systemd before it degrades the desktop
  3. The GNOME extension renders correctly on both Adwaita dark and Adwaita light themes -- CSS adapts based on `color-scheme` GSettings value
  4. Loading a snapshot cache file written by a previous schema version either migrates successfully or resets gracefully -- schema version is checked on every load
**Plans**: TBD
**UI hint**: yes

### Phase 15: Developer Experience & Refactors
**Goal**: Contributors can onboard, run standard commands, and the provider code is DRY with shared error/timeout helpers
**Depends on**: Phase 14
**Requirements**: DX-01, DX-02, DX-03, REF-01, REF-02, REF-03
**Success Criteria** (what must be TRUE):
  1. Running `bun run dev`, `bun run test`, `bun run typecheck`, and `bun run clean` from the workspace root works without extra setup -- standard developer workflow exists
  2. A new contributor can read CONTRIBUTING.md and understand how to set up, lint, test, and submit changes
  3. Provider fetchers use shared `createProviderErrorSnapshot`, `withTimeout`, and `withRetry` helpers instead of duplicating error/timeout logic per provider
  4. The `extension-state.js` has a single error field (`lastError`) with no duplicated `error` property
**Plans**: TBD

### Phase 16: UX Polish
**Goal**: The extension is prepared for future localization and polling retry behavior is correct
**Depends on**: Phase 13
**Requirements**: UX-01, UX-02
**Success Criteria** (what must be TRUE):
  1. All user-facing strings in the GNOME extension are wrapped in `_()` with a gettext domain declared in `metadata.json` -- the extension is structurally ready for translation without functional change
  2. The polling service uses `setTimeout` instead of `setInterval` -- after a successful poll the next poll is scheduled from completion (not from start), preventing overlapping fetches on slow networks
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:** Phases execute in numeric order: 13 -> 14 -> 15 -> 16

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Backend Contract | v1.0 | 3/3 | Complete | 2026-03-25 |
| 2. Linux Config & Secrets | v1.0 | 3/3 | Complete | 2026-03-25 |
| 3. First-Wave Providers | v1.0 | 3/3 | Complete | 2026-03-25 |
| 4. Ubuntu Desktop Surface | v1.0 | 3/3 | Complete | 2026-03-25 |
| 5. Delivery & Hardening | v1.0 | 3/3 | Complete | 2026-03-25 |
| 6. Provider Reliability | v1.1 | 2/2 | Complete | 2026-03-26 |
| 7. GNOME Extension UI Redesign | v1.1 | 3/3 | Complete | 2026-03-26 |
| 8. Bun Runtime Migration | v2.0 | 3/3 | Complete | 2026-03-29 |
| 9. Lifecycle Commands | v2.0 | 3/3 | Complete | 2026-03-29 |
| 10. CLI Overhaul | v2.0 | 3/3 | Complete | 2026-03-29 |
| 11. Provider Independence & Data | v2.0 | 3/3 | Complete | 2026-03-29 |
| 12. Terminal UI & Code Quality | v2.0 | 3/3 | Complete | 2026-03-29 |
| 13. Critical Security & Stability Fixes | v2.1 | 0/? | Not started | - |
| 14. Quality Gate & Production Hardening | v2.1 | 0/? | Not started | - |
| 15. Developer Experience & Refactors | v2.1 | 0/? | Not started | - |
| 16. UX Polish | v2.1 | 0/? | Not started | - |

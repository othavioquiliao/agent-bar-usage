# Requirements: Agent Bar Ubuntu v2.0

**Defined:** 2026-03-28
**Core Value:** Ubuntu users can reliably see the current usage state of their AI providers from a Linux-native surface without depending on the macOS-specific CodexBar shell.

## v2.0 Requirements

Requirements for the refactor & polish milestone. Each maps to roadmap phases.

### Runtime Migration

- [x] **RUNTIME-01**: Backend migrates from Node.js to Bun runtime
- [x] **RUNTIME-02**: PTY allocation uses Bun.Terminal API (replaces node-pty native addon)
- [x] **RUNTIME-03**: Service daemon uses Bun.serve({ unix }) for socket IPC (replaces net.createServer)
- [x] **RUNTIME-04**: Backend runs .ts files directly in development (no build step required)

### CLI Overhaul

- [ ] **CLI-01**: CLI uses manual argument parsing without Commander (switch/case + suggestCommand with Levenshtein)
- [ ] **CLI-02**: Schema validation uses inline type guards and assertion functions without Zod
- [ ] **CLI-03**: `--help` displays formatted help output with box-drawing characters

### Lifecycle Commands

- [x] **LIFE-01**: `agent-bar setup` installs CLI symlink, systemd service, GNOME extension via TypeScript with @clack/prompts
- [x] **LIFE-02**: `agent-bar remove` removes all installed files but explicitly preserves GNOME Keyring secrets
- [x] **LIFE-03**: `agent-bar update` pulls latest code, rebuilds, restarts systemd service, re-copies GNOME extension (highest priority)
- [x] **LIFE-04**: `agent-bar uninstall` removes everything including GNOME Keyring secrets with explicit confirmation

### Provider Independence

- [ ] **PROV-01**: Each provider is a self-contained module with zero cross-provider imports
- [ ] **PROV-02**: Provider interface follows minimal contract: `{ id, name, cacheKey, isAvailable(), getQuota() }`
- [ ] **PROV-03**: User can select which providers appear in GNOME topbar via `agent-bar providers` CLI command
- [ ] **PROV-04**: Existing SVG/PNG icon assets are properly integrated and displayed in the GNOME extension

### Data & Formatting

- [ ] **DATA-01**: Backend auto-refreshes provider data periodically via configurable setInterval (default 150s)
- [ ] **DATA-02**: File-based cache with TTL and fetch deduplication stored in XDG_CACHE_HOME
- [ ] **DATA-03**: Date/time formatting is locale-aware using Intl.RelativeTimeFormat and Intl.DateTimeFormat
- [x] **DATA-04**: Settings are versioned with migration logic and atomic writes (temp file + rename)

### Terminal UI

- [ ] **TUI-01**: Interactive menu via @clack/prompts with actions: List All, Configure Providers, Provider Login, Doctor
- [ ] **TUI-02**: Terminal quota display with Unicode progress bars and One Dark Pro color palette
- [ ] **TUI-03**: Doctor command outputs checks with @clack/prompts spinners and colored pass/fail indicators
- [ ] **TUI-04**: Provider login TUI guides user through Claude, Codex, and Copilot auth flows

### Code Quality

- [ ] **QUAL-01**: Biome replaces ESLint/Prettier for linting and formatting
- [ ] **QUAL-02**: Obvious bugs and code smells are fixed throughout the codebase
- [ ] **QUAL-03**: Real GitHub OAuth App registered and DEFAULT_CLIENT_ID placeholder replaced

## Future Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Provider Expansion

- **EXPAND-01**: Cursor provider (Linux cookie/session strategy)
- **EXPAND-02**: Amp provider (CLI-based usage parsing)

### Additional Surfaces

- **SURFACE-01**: Waybar output module (JSON + CSS export like omarchy)
- **SURFACE-02**: AppIndicator surface for non-GNOME desktops

### Advanced Features

- **ADV-01**: Historical usage trends (storage + visualization)
- **ADV-02**: OAuth-backed paths for Codex and Claude
- **ADV-03**: Compiled binary via `bun build --compile` for distribution

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| systemd timer for refresh | Over-engineering -- setInterval inside the process is simpler and matches existing GNOME polling |
| D-Bus interface | Massive complexity for a single consumer -- Unix socket JSON protocol works |
| WebSocket push to extension | GJS WebSocket support is limited, risks GNOME Shell stability |
| GUI settings in GNOME extension | GJS settings UI is fragile across versions -- CLI TUI is more capable |
| Automatic sudo dependency install | Security risk -- setup should check and report, not install with privileges |
| Browser cookie extraction | Linux browser state varies wildly -- CLI-based auth is reliable |
| macOS parity | Ubuntu product is intentionally Linux-native |
| Monorepo flattening | User chose to keep monorepo structure |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RUNTIME-01 | Phase 8 | Complete |
| RUNTIME-02 | Phase 8 | Complete |
| RUNTIME-03 | Phase 8 | Complete |
| RUNTIME-04 | Phase 8 | Complete |
| CLI-01 | Phase 10 | Pending |
| CLI-02 | Phase 10 | Pending |
| CLI-03 | Phase 10 | Pending |
| LIFE-01 | Phase 9 | Complete |
| LIFE-02 | Phase 9 | Complete |
| LIFE-03 | Phase 9 | Complete |
| LIFE-04 | Phase 9 | Complete |
| PROV-01 | Phase 11 | Pending |
| PROV-02 | Phase 11 | Pending |
| PROV-03 | Phase 11 | Pending |
| PROV-04 | Phase 11 | Pending |
| DATA-01 | Phase 11 | Pending |
| DATA-02 | Phase 11 | Pending |
| DATA-03 | Phase 11 | Pending |
| DATA-04 | Phase 9 | Complete |
| TUI-01 | Phase 12 | Pending |
| TUI-02 | Phase 12 | Pending |
| TUI-03 | Phase 12 | Pending |
| TUI-04 | Phase 12 | Pending |
| QUAL-01 | Phase 10 | Pending |
| QUAL-02 | Phase 12 | Pending |
| QUAL-03 | Phase 12 | Pending |

**Coverage:**
- v2.0 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-03-28*
*Last updated: 2026-03-28 after roadmap creation*

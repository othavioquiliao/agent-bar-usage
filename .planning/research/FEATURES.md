# Feature Research

**Domain:** Linux CLI lifecycle management, modular provider selection, auto-refresh, and TUI/formatting for an AI usage monitoring tool
**Researched:** 2026-03-28
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `setup` command in TypeScript | Users expect a single `agent-bar setup` that installs the CLI wrapper, systemd service, GNOME extension, and env overrides. The existing `install-ubuntu.sh` works but is monolithic, untestable, and impossible to extend safely. agent-bar-omarchy proves the pattern: `@clack/prompts` intro, step-by-step spinner feedback, confirmation before action, idempotent execution. | MEDIUM | Mirror omarchy `setup.ts`: `p.intro` -> `p.note` listing what will happen -> `p.confirm` -> spinner per step -> `p.outro`. Must handle: (1) `~/.local/bin/agent-bar` symlink, (2) systemd unit copy + env override write, (3) GNOME extension copy + enable, (4) `systemctl --user daemon-reload && enable && restart`. Each step is a function returning success/failure -- no bash piping. |
| `remove` command (preserves secrets) | Users need a clean way to uninstall the tool without losing their GNOME Keyring credentials. "remove" should be safe -- it removes installed files but deliberately keeps secrets. agent-bar-omarchy proves this exact pattern: `remove.ts` calls `runUninstall({ force: true })`. | LOW | Thin wrapper over `uninstall()` with `force: true`. Removes: CLI symlink, systemd unit + override, GNOME extension directory, cache files, config files. Explicitly skips: GNOME Keyring entries. Show what gets removed via `p.note` before acting. |
| `update` command | Highest priority per PROJECT.md. Users expect `agent-bar update` to pull latest code, rebuild, and restart the service. The omarchy pattern is proven: check git repo, fetch, show incoming commits via `p.note`, confirm, `git pull --ff-only`, `bun install`, reload. For agent-bar-usage the extra steps are: `pnpm build:backend`, `systemctl --user restart agent-bar.service`, copy GNOME extension files. | MEDIUM | Must handle: (1) git fetch + check behind, (2) show incoming commits, (3) confirm, (4) `git pull --ff-only`, (5) `pnpm install` / `bun install`, (6) rebuild backend, (7) restart systemd service, (8) re-copy GNOME extension. Fail gracefully if not a git repo. Show clear error if local changes conflict. |
| Provider selection CLI (`agent-bar providers`) | Users need to choose which providers appear in the GNOME topbar. Currently all 3 are hardcoded. The omarchy `configure-layout.ts` pattern is the gold standard: multiselect with availability detection, ordering, live apply. For GNOME context: write selection to settings, signal the extension via D-Bus or service restart. | MEDIUM | Use `@clack/prompts` `p.multiselect` showing availability status per provider (green = authenticated, dim = not logged in). Save to XDG settings JSON. On save: restart the systemd service so the backend re-reads config. The GNOME extension picks up provider changes on next poll. |
| Auto-refresh (periodic background polling) | Users expect usage data to stay current without manual intervention. The current GNOME extension already has a polling service (`polling-service.js` with 150s interval + exponential retry backoff). The backend service lacks its own periodic refresh -- it only refreshes on-demand. Adding backend-side periodic refresh means the extension always gets fresh cached data. | MEDIUM | Two layers: (1) **Backend auto-refresh**: add a `setInterval` in `service-server.ts` that calls `createUsageSnapshot({ refresh: true })` every N seconds (default 150s, matching GNOME poll). Store result as `lastSnapshot`. This eliminates the race where the extension polls before the cache warms. (2) **GNOME extension polling** already works -- keep it, but it becomes a reader of pre-cached data rather than triggering fresh fetches. The backend interval should be configurable in settings. |
| Human-readable date/time formatting | Users expect "Updated 2 minutes ago" not raw ISO timestamps or epoch values. The GNOME extension already has `formatRelativeTimestamp()` using `Intl.RelativeTimeFormat`. The CLI terminal output (`formatters/shared.ts`) has `formatEta()` with `Xd XXh` / `Xh XXm` patterns and `formatResetTime()` with `(HH:MM)`. Both patterns are correct and should be preserved. For GNOME: continue using `Intl.RelativeTimeFormat` for "Updated X ago" and `Intl.DateTimeFormat` for absolute dates. | LOW | Already implemented in both surfaces. Consolidate: (1) Terminal: keep `formatEta` + `formatResetTime` from omarchy `shared.ts`, (2) GNOME extension: keep `time.js` with `Intl.RelativeTimeFormat`. No GLib.DateTime needed -- GJS supports JS `Intl` APIs natively. Add locale-aware percentage formatting: `new Intl.NumberFormat(undefined, { style: 'percent' })`. |
| `uninstall` command (full removal) | Users expect the ability to completely remove everything including secrets. Separate from `remove` which preserves secrets. The omarchy pattern: `runUninstall()` with confirmation prompt (`initialValue: false` for safety). | LOW | Same as `remove` but additionally: clear GNOME Keyring entries via `secret-tool clear service agent-bar account copilot`. Requires explicit confirmation with `initialValue: false`. Show a warning that secrets will be deleted. |
| Manual CLI argument parsing (no Commander) | PROJECT.md mandates removing Commander. The omarchy `cli.ts` is the proven pattern: switch/case on `process.argv`, `requireNextArg()` helper, Levenshtein-based `suggestCommand()` for typo correction. Zero deps for argument parsing. | LOW | Direct port of omarchy pattern. Define a `CliOptions` interface, iterate `process.argv.slice(2)`, match commands and flags. Include `--help` / `-h` with box-drawn help output. Add `suggestCommand()` with Levenshtein distance for friendly "Did you mean X?" errors. |
| Inline validation (no Zod) | PROJECT.md mandates removing Zod. Config and schema validation should use plain TypeScript type guards and assertion functions. The omarchy codebase validates settings with simple `isValidSeparator()` / `isValidWindowPolicy()` type guards. | LOW | Replace `providerIdSchema.safeParse()` with a plain `isProviderId()` type guard. Replace `snapshotEnvelopeSchema.parse()` with an `assertSnapshotEnvelope()` function that throws descriptive errors. Config validation: `normalizeConfig()` pattern from omarchy `settings.ts` -- merge with defaults, validate each field, fall back to defaults on invalid values. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Interactive TUI menu (`agent-bar menu`) | Omarchy proves this is a high-engagement surface. A `@clack/prompts` TUI loop with: List All quotas, Configure Providers, Provider Login, Doctor. Makes the CLI discoverable without memorizing subcommands. No competitor (Copilot/Claude/Codex CLI themselves) offers a unified quota TUI. | MEDIUM | Mirror omarchy `tui/index.ts`: `p.select` loop with action dispatch. Actions: "List all" (show quotas with progress bars), "Configure providers" (multiselect), "Provider login" (launch auth flows), "Run doctor" (diagnostics). Each action returns to the menu. `p.isCancel` exits cleanly. SIGINT handler restores cursor. |
| Rich terminal quota display with progress bars | Visual quota display with Unicode progress bars (`[filled]░░░░░░░░░░░`) color-coded by severity (green/yellow/orange/red), ETA to reset, and provider-branded box-drawing. Omarchy `formatters/terminal.ts` and `tui/list-all.ts` are the reference. This is the "wow" factor of the tool. | MEDIUM | Port omarchy `terminal.ts`: `buildClaude()`, `buildCodex()`, `buildCopilot()` functions generating box-drawn sections with ANSI colors. Each model gets: name, progress bar, percentage, ETA, reset time. Use One Dark Pro color palette (`ANSI` constants from `theme.ts`). Include `bar()` function mapping percentage to `filled/20` blocks. |
| Versioned settings with migration | Omarchy `settings.ts` uses `version: number` in the settings JSON with a `migrateSettings()` function for schema evolution. This prevents config breakage across updates. The current codebase has `schemaVersion: 1` in backend config but no migration logic. | LOW | Add `version` field to settings. `normalizeSettings()` checks version, calls `migrateSettings()` chain. Write atomically via temp file + rename (omarchy pattern: `Bun.write(tmp)` then `rename(tmp, settingsFile)`). Load with graceful fallback to defaults on parse error. |
| Provider login TUI flows | Launch `claude`, `codex auth login`, `agent-bar auth copilot` from a guided TUI. Omarchy `tui/login.ts` shows the pattern: explain steps via `p.note`, confirm, spawn interactive process, activate provider on success. | MEDIUM | For GNOME/Ubuntu context: Claude login launches `claude` interactively (trust prompt + `/login`), Codex launches `codex auth login`, Copilot runs the existing Device Flow OAuth. After success, update provider settings to include the provider. Signal service restart. |
| Cache with TTL and fetch deduplication | Omarchy `cache.ts` has a `Cache` class with file-based storage, TTL, key validation, `getOrFetch()` with in-flight deduplication. The current codebase has an in-memory `SnapshotCache` that loses data on service restart. Moving to file-based cache means warm restarts. | MEDIUM | Port omarchy `Cache` class. XDG cache directory (`$XDG_CACHE_HOME/agent-bar/`). Each provider gets a `{provider}.json` file with `{ data, fetchedAt, expiresAt }`. `getOrFetch()` deduplicates concurrent calls. Legacy cache migration from current paths. TTL configurable in settings (default 150s). |
| `doctor` with TUI formatting | The existing `doctor` command runs 8 prerequisite checks but outputs plain text. Wrapping it with `@clack/prompts` spinners and colored pass/fail indicators would make it significantly more readable. | LOW | Wrap existing `runPrerequisiteChecks()` with `p.spinner` per check. Use `p.log.success` for pass, `p.log.error` for fail. End with `p.note` showing suggested fix commands for failures. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| systemd timer instead of in-process polling | "Use proper Linux primitives" | Adds a second systemd unit (`.timer`), doubles the systemd surface area, creates boot ordering dependencies, makes the refresh interval harder to configure at runtime. The service is already long-running -- `setInterval` inside the process is simpler and matches the GNOME extension's polling model. | Keep `setInterval` inside `service-server.ts`. Configurable interval in settings. This is what the GNOME extension already does successfully. |
| D-Bus interface for extension-to-backend communication | "D-Bus is the GNOME-native IPC" | Massive complexity increase: GDBus type definitions in GJS, introspection XML, bus name registration, signal handling. The Unix socket JSON protocol already works and is simpler to debug, test, and extend. D-Bus adds no value when there is exactly one consumer. | Keep Unix domain socket + JSON newline protocol. It works, it is tested, it is simpler. The GNOME extension can call the CLI binary as a fallback when the socket is unavailable. |
| Real-time WebSocket push from backend to extension | "Extension should update instantly" | GJS has limited WebSocket support. The extension runs in the GNOME Shell process -- long-lived connections risk shell stability. Polling every 150s is already fast enough for quota data that changes at most every 5 hours. | Keep polling at 150s intervals with exponential backoff retry. The backend auto-refresh ensures data is always warm when the extension polls. |
| GUI settings panel in the GNOME extension | "Users should configure providers from the extension itself" | GJS settings UI (Adw.PreferencesPage) is limited, poorly documented, and varies between GNOME versions. The CLI TUI is more capable and does not depend on GNOME Shell version. | Use `agent-bar menu` for all configuration. The GNOME extension is a read-only display surface. |
| Automatic dependency installation during setup | "Setup should install Node.js, pnpm, secret-tool automatically" | Requires `sudo`, which the setup command should never need. Mixing privilege escalation into the setup flow creates security and UX problems. Dependency installation is a one-time prerequisite, not a repeatable setup step. | `setup` checks prerequisites and tells the user what to install with exact commands (like `doctor` does). The user installs dependencies themselves. `setup` only manages agent-bar's own files. |
| Browser cookie extraction for providers | "Import auth from browser sessions" | Linux browser cookie storage varies wildly (Chrome vs Firefox vs Snap vs Flatpak sandboxing). SweetCookieKit on macOS works because of predictable keychain access. Linux has no equivalent. This is explicitly out of scope in PROJECT.md. | Use CLI-based auth (Device Flow for Copilot, `claude` CLI login, `codex auth login`). These work reliably from any environment. |

## Feature Dependencies

```
[Manual CLI Parsing]
    |
    +---enables---> [setup command]
    |                   |
    |                   +---requires---> [Versioned Settings]
    |                   +---requires---> [systemd service management]
    |
    +---enables---> [remove command]
    |                   +---requires---> [Versioned Settings] (to know what paths to clean)
    |
    +---enables---> [update command]
    |                   +---requires---> [setup command] (re-applies setup steps after pull)
    |
    +---enables---> [provider selection CLI]
    |                   +---requires---> [Versioned Settings]
    |                   +---requires---> [Provider adapter pattern] (already exists)
    |
    +---enables---> [TUI menu]
                        +---requires---> [@clack/prompts]
                        +---enhances---> [provider selection CLI]
                        +---enhances---> [doctor command]

[Inline Validation]
    +---replaces---> [Zod dependency]
    +---used by---> [Versioned Settings]
    +---used by---> [Config loading]

[Cache with TTL]
    +---enables---> [Auto-refresh in backend]
    +---used by---> [Provider adapters]

[Auto-refresh in backend]
    +---requires---> [Cache with TTL]
    +---enhances---> [GNOME extension polling] (data always warm)

[Date/time formatting]
    +---used by---> [GNOME extension] (already works)
    +---used by---> [Terminal formatter] (port from omarchy)
    +---used by---> [TUI list-all view]

[@clack/prompts]
    +---used by---> [setup command]
    +---used by---> [remove command]
    +---used by---> [update command]
    +---used by---> [provider selection CLI]
    +---used by---> [TUI menu]
    +---used by---> [Provider login flows]
```

### Dependency Notes

- **Manual CLI Parsing enables all lifecycle commands:** Must be implemented first since it replaces Commander. Every command routes through the new `parseArgs()` + switch dispatcher.
- **Versioned Settings required by setup/remove/providers:** Settings define what is installed, which providers are selected, and where files live. The settings schema must be stable before commands consume it.
- **update requires setup patterns:** The update command re-applies setup steps (rebuild, restart service, copy extension) after pulling code. It should call shared functions from setup, not duplicate logic.
- **Cache with TTL enables auto-refresh:** The backend auto-refresh writes to the file cache. The GNOME extension reads from it via the socket protocol. Without persistent cache, auto-refresh results are lost on restart.
- **@clack/prompts used by all interactive commands:** This is the single TUI dependency. All commands that interact with the user go through it.
- **Inline Validation replaces Zod:** This is a prerequisite for removing the Zod dependency. Type guards must exist before Zod schemas are deleted.

## MVP Definition

### Launch With (v2.0)

Minimum set to deliver the v2.0 milestone goals from PROJECT.md.

- [x] Manual CLI parsing replacing Commander -- foundation for all commands
- [x] Inline validation replacing Zod -- config and snapshot validation
- [x] `setup` command in TypeScript -- replaces `install-ubuntu.sh`
- [x] `remove` command (preserves secrets) -- clean removal
- [x] `update` command -- highest priority per PROJECT.md
- [x] Provider selection CLI -- choose which providers appear in topbar
- [x] Auto-refresh in backend service -- periodic usage data polling
- [x] Date/time formatting improvements -- human-readable timestamps in terminal and extension
- [x] Versioned settings with migration -- prevent config breakage on updates

### Add After Validation (v2.x)

Features to add once the core refactor is stable.

- [ ] Interactive TUI menu -- after all subcommands work individually
- [ ] Rich terminal quota display with progress bars -- after provider adapters are migrated
- [ ] Provider login TUI flows -- after auth patterns are stable on Bun
- [ ] File-based cache with TTL and deduplication -- after confirming Bun file I/O patterns
- [ ] `doctor` command with TUI formatting -- after @clack/prompts patterns are established
- [ ] `uninstall` command (full removal including secrets) -- after remove is stable

### Future Consideration (v2.1+)

Features to defer until the refactored architecture is proven.

- [ ] Additional providers (Amp, Cursor) -- wait until provider adapter pattern is proven on Bun
- [ ] Historical usage trends -- requires persistent storage beyond cache TTL
- [ ] Waybar surface support -- keep GNOME extension as sole surface for now
- [ ] OAuth-backed paths for Codex and Claude -- CLI auth paths work fine

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `update` command | HIGH | MEDIUM | P1 |
| Manual CLI parsing (no Commander) | HIGH | LOW | P1 |
| Inline validation (no Zod) | MEDIUM | LOW | P1 |
| `setup` command in TypeScript | HIGH | MEDIUM | P1 |
| `remove` command | MEDIUM | LOW | P1 |
| Provider selection CLI | HIGH | MEDIUM | P1 |
| Auto-refresh in backend | HIGH | MEDIUM | P1 |
| Versioned settings | MEDIUM | LOW | P1 |
| Date/time formatting | MEDIUM | LOW | P1 |
| TUI menu | HIGH | MEDIUM | P2 |
| Rich terminal quota display | MEDIUM | MEDIUM | P2 |
| Provider login TUI flows | MEDIUM | MEDIUM | P2 |
| File-based cache with TTL | MEDIUM | MEDIUM | P2 |
| Doctor with TUI formatting | LOW | LOW | P2 |
| `uninstall` command (full) | LOW | LOW | P2 |

**Priority key:**
- P1: Must have for v2.0 launch
- P2: Should have, add in v2.x when core is stable
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | agent-bar-omarchy (Waybar) | Agent Bar Ubuntu (GNOME) | Our v2.0 Approach |
|---------|---------------------------|--------------------------|-------------------|
| Setup | `setup.ts` with @clack/prompts, symlink + Waybar config wiring | `install-ubuntu.sh` monolithic bash | Port to TypeScript: symlink + systemd + GNOME extension copy, @clack/prompts UX |
| Remove | `remove.ts` wraps `uninstall({ force: true })` | Not implemented | Add `remove` preserving GNOME Keyring secrets |
| Update | `update.ts` with git pull + bun install + Waybar reload | Not implemented | Add `update` with git pull + rebuild + systemd restart + extension re-copy |
| Provider selection | `configure-layout.ts` multiselect + order + separator style | Hardcoded 3 providers in config | `p.multiselect` for provider toggle, save to settings, restart service |
| Auto-refresh | Waybar polls the CLI binary on interval (external) | GNOME extension `polling-service.js` at 150s + retry backoff | Add backend-side `setInterval` so data is always warm when polled |
| CLI parsing | Manual switch/case with Levenshtein typo correction | Commander dependency | Port omarchy manual parsing pattern |
| Validation | Inline type guards, no Zod | Zod schemas | Port inline validation, remove Zod |
| Cache | File-based `Cache` class with TTL + dedup | In-memory `SnapshotCache` (lost on restart) | Port file-based cache for warm restarts |
| Date/time | `formatEta()` + `formatResetTime()` in terminal | `Intl.RelativeTimeFormat` in GNOME extension | Keep both patterns, consolidate shared logic |
| TUI | Full @clack/prompts menu with List All, Layout, Models, Login | No TUI (CLI only) | Add `agent-bar menu` after core commands work |
| Settings | Versioned JSON with migration + atomic write | `BackendConfig` with schema version but no migration | Port versioned settings with `normalizeSettings()` + `migrateSettings()` chain |

## @clack/prompts Pattern Reference

Key patterns from agent-bar-omarchy to adopt:

**Flow structure (every command):**
```typescript
import * as p from '@clack/prompts';
import { colorize, semantic } from './tui/colors';

p.intro(colorize('command-name', oneDark.blue));
p.note([...steps].join('\n'), colorize('Title', semantic.title));

const proceed = await p.confirm({ message: 'Apply?', initialValue: true });
if (p.isCancel(proceed) || !proceed) {
  p.outro(colorize('Cancelled', semantic.muted));
  return;
}

const s = p.spinner();
s.start('Working...');
// ... work ...
s.stop('Done');

p.log.success(colorize('Result', semantic.good));
p.outro(colorize('Complete', semantic.good));
```

**Cancellation handling:**
```typescript
// ALWAYS check isCancel after every prompt
if (p.isCancel(result)) {
  p.outro(colorize('Cancelled', semantic.muted));
  return;
}
```

**Multiselect with availability:**
```typescript
const result = await p.multiselect({
  message: 'Select providers',
  options: providers.map(prov => ({
    value: prov.id,
    label: prov.available
      ? colorize(prov.name, oneDark.green)
      : colorize(prov.name, oneDark.text) + colorize(' (not configured)', semantic.muted),
    hint: prov.available ? undefined : 'run agent-bar auth first',
  })),
  initialValues: currentSelection,
  required: false,
});
```

**SIGINT safety:**
```typescript
process.on('SIGINT', () => {
  if (process.stdout.isTTY) process.stdout.write('\x1b[?25h'); // restore cursor
  p.outro(colorize('Cancelled', semantic.muted));
  process.exit(0);
});
```

## Date/Time Formatting Reference

**Terminal (CLI output):**
```typescript
// ETA countdown: "2d 04h" or "3h 12m" or "0m"
function formatEta(iso: string | null, remaining: number | null): string {
  if (remaining === 100) return 'Full';
  if (!iso) return '?';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return '0m';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return d > 0 ? `${d}d ${h.toString().padStart(2, '0')}h` : `${h}h ${m.toString().padStart(2, '0')}m`;
}

// Reset clock: "(14:30)" or "(??:??)"
function formatResetTime(iso: string | null, remaining: number | null): string {
  if (remaining === 100) return '';
  if (!iso) return '(??:??)';
  const d = new Date(iso);
  return `(${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')})`;
}
```

**GNOME Extension (GJS):**
```javascript
// Relative: "2 minutes ago", "in 3 hours"
new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(numericValue, unit);

// Absolute: "Mar 28, 2026, 2:30 PM"
new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
```

## Sources

- [agent-bar-omarchy reference codebase](/home/othavio/Work/agent-bar-omarchy/src/) -- setup.ts, remove.ts, update.ts, uninstall.ts, cli.ts, settings.ts, cache.ts, refresh.ts, tui/, formatters/
- [agent-bar-usage current codebase](/home/othavio/Work/agent-bar-usage/apps/backend/src/) -- cli.ts, service-server.ts, snapshot-cache.ts, commands/
- [agent-bar-usage GNOME extension](/home/othavio/Work/agent-bar-usage/apps/gnome-extension/) -- polling-service.js, time.js, view-model.js, indicator.js
- [agent-bar-usage install script](/home/othavio/Work/agent-bar-usage/scripts/install-ubuntu.sh) -- current monolithic bash installer
- [@clack/prompts documentation](https://www.clack.cc/) -- TUI component API
- [@clack/prompts patterns article](https://www.blacksrc.com/blog/elevate-your-cli-tools-with-clack-prompts) -- async composition, cancellation, validation
- [systemd timers ArchWiki](https://wiki.archlinux.org/title/Systemd/Timers) -- timer vs in-process polling tradeoffs
- [GLib.DateTime format reference](http://webreflection.github.io/gjs-documentation/GLib-2.0/GLib.DateTime.format.html) -- GJS date formatting (not needed; JS Intl works in GJS)

---
*Feature research for: Agent Bar Ubuntu v2.0 CLI lifecycle, provider selection, auto-refresh, TUI, and date/time formatting*
*Researched: 2026-03-28*

# Phase 9: Lifecycle Commands - Research

**Researched:** 2026-03-28
**Domain:** CLI lifecycle management (setup, remove, update, uninstall) + versioned settings with migration
**Confidence:** HIGH

## Summary

Phase 9 replaces the 310-line bash installer (`scripts/install-ubuntu.sh`) with four TypeScript lifecycle commands registered in the existing CLI entry point. The reference implementation at `agent-bar-omarchy` provides a proven pattern: `@clack/prompts` for interactive flows, `Bun.spawn` for subprocess execution, and atomic file writes for settings persistence. The current codebase already has `runSubprocess` (with timeout, stdin piping, error types), `secret-tool` integration (read + write), and `systemctl --user restart` usage in auth-command.ts -- all reusable.

The settings system introduces a new `settings.json` (versioned, with migration) alongside the existing `config.json` (Zod-validated backend config). These serve different purposes: `config.json` holds provider configuration and backend tuning; `settings.json` will hold user preferences and lifecycle metadata (version field). The omarchy reference's `normalizeSettings()` pattern with per-field fallback to defaults is the proven approach.

**Primary recommendation:** Mirror the omarchy lifecycle pattern exactly (intro -> steps with spinner -> outro), using `@clack/prompts` for all interactive flows, `Bun.file`/`Bun.write` for file operations, and the existing `runSubprocess` utility for subprocess calls. Register four new commands (`setup`, `remove`, `update`, `uninstall`) in `cli.ts`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- `agent-bar setup` installs: CLI symlink (~/.local/bin/agent-bar), systemd service + env override, GNOME extension copy + enable -- full omarchy pattern
- Setup does NOT require sudo -- all files go to user-level paths (~/.local/bin, ~/.config/systemd/user/, ~/.local/share/gnome-shell/extensions/)
- Setup detects missing dependencies (bun, secret-tool, gnome-extensions) and reports with exact install commands -- does NOT install automatically
- Setup is idempotent -- re-running updates everything without duplicating
- `agent-bar update` runs: git fetch -> show incoming commits via @clack p.note -> confirm -> git pull --ff-only -> bun install -> rebuild backend -> restart systemd -> re-copy GNOME extension
- If local changes exist: fail with clear message suggesting stash/commit -- no auto-stash
- No rollback in v2.0 -- just error message if pull fails
- Show incoming commits count and summary before confirming
- Settings format: JSON at ~/.config/agent-bar/settings.json with `version: number` field -- omarchy pattern
- `agent-bar remove` preserves: GNOME Keyring secrets AND settings.json (user may want to reinstall)
- `agent-bar uninstall` additionally: deletes Keyring secrets via `secret-tool clear`, deletes settings.json and cache -- requires explicit confirmation with initialValue: false
- Settings migration: `normalizeSettings()` with per-field fallback to defaults for invalid values -- omarchy pattern

### Claude's Discretion
- Internal implementation details of @clack/prompts flows (spinner text, note content, intro/outro messages)
- Error message wording and formatting
- Exact order of setup steps within the install flow
- Whether to add `agent-bar apply-local` command (like omarchy) in this phase or defer

### Deferred Ideas (OUT OF SCOPE)
- `agent-bar apply-local` command (like omarchy) -- evaluate during planning
- Auto-update check on CLI startup (like omarchy's version check) -- defer to Phase 12
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIFE-01 | `agent-bar setup` installs CLI symlink, systemd service, GNOME extension via TypeScript with @clack/prompts | Omarchy setup.ts reference pattern, existing install-ubuntu.sh logic, @clack/prompts API documented below |
| LIFE-02 | `agent-bar remove` removes all installed files but explicitly preserves GNOME Keyring secrets | Omarchy uninstall.ts with `removePathIfExists` pattern, existing secret-tool patterns in codebase |
| LIFE-03 | `agent-bar update` pulls latest code, rebuilds, restarts systemd service, re-copies GNOME extension | Omarchy update.ts reference with git fetch/pull/bun install pattern, existing `runSubprocess` utility |
| LIFE-04 | `agent-bar uninstall` removes everything including GNOME Keyring secrets with explicit confirmation | `secret-tool clear service agent-bar account copilot` pattern, @clack confirm with initialValue: false |
| DATA-04 | Settings are versioned with migration logic and atomic writes (temp file + rename) | Omarchy settings.ts reference with normalizeSettings/migrateSettings/atomic write pattern |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @clack/prompts | 1.1.0 | Interactive CLI flows (intro, outro, spinner, confirm, note, log) | Locked decision from CONTEXT.md; already used in omarchy reference |
| bun (runtime) | latest | Runtime for TypeScript execution, file I/O, subprocess spawn | Already migrated to Bun in Phase 8; `Bun.spawn`, `Bun.file`, `Bun.write` are native |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:fs | (built-in) | `existsSync`, `mkdirSync`, `symlinkSync`, `unlinkSync`, `rmSync` | File system operations compatible with Bun |
| node:fs/promises | (built-in) | `mkdir`, `rename` (for atomic writes) | Async file operations |
| node:os | (built-in) | `homedir()` | Resolve user home directory |
| node:path | (built-in) | `join`, `resolve` | Path construction |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @clack/prompts | inquirer/prompts | @clack is locked decision; lighter weight, better UX |
| node:fs for symlink | Bun.link | Bun.link exists but `symlinkSync` from node:fs is stable and well-tested |
| Custom spinner | ora | Omarchy update.ts uses ora, but @clack/prompts spinner is simpler and consistent with the rest of the flow |

**Installation:**
```bash
cd apps/backend && pnpm add @clack/prompts
```

**Version verification:** `@clack/prompts` 1.1.0 confirmed via `npm view @clack/prompts version` on 2026-03-28.

## Architecture Patterns

### Recommended Project Structure
```
apps/backend/src/
  lifecycle/
    setup.ts           # setup command logic (LIFE-01)
    remove.ts          # remove command logic (LIFE-02)
    update.ts          # update command logic (LIFE-03)
    uninstall.ts       # uninstall command logic (LIFE-04)
    paths.ts           # All install paths as constants (app-identity equivalent)
    dependency-check.ts # Detect missing deps (bun, secret-tool, gnome-extensions)
  settings/
    settings.ts        # Versioned settings load/save/migrate (DATA-04)
    settings-schema.ts # Settings type + defaults + validation
  commands/
    lifecycle-command.ts # Registers setup/remove/update/uninstall in Commander
  cli.ts               # Import + register lifecycle commands
```

### Pattern 1: Omarchy Lifecycle Flow
**What:** Each lifecycle command follows intro -> note (explanation) -> confirm -> spinner steps -> log results -> outro
**When to use:** All four lifecycle commands
**Example:**
```typescript
// Source: agent-bar-omarchy/src/setup.ts (adapted)
import * as p from '@clack/prompts';

export async function runSetup(): Promise<void> {
  console.clear();
  p.intro('agent-bar setup');

  p.note(
    [
      'This will:',
      '  1. Create ~/.local/bin/agent-bar symlink',
      '  2. Install systemd user service + env override',
      '  3. Copy GNOME extension + enable it',
    ].join('\n'),
    'Setup'
  );

  const proceed = await p.confirm({
    message: 'Apply setup now?',
    initialValue: true,
  });

  if (p.isCancel(proceed) || !proceed) {
    p.outro('Setup cancelled');
    return;
  }

  const s = p.spinner();

  s.start('Creating CLI symlink...');
  // ... symlink logic
  s.stop('CLI symlink created');

  s.start('Installing systemd service...');
  // ... systemd logic
  s.stop('Systemd service installed');

  p.outro('Setup complete');
}
```

### Pattern 2: Idempotent File Installation
**What:** Remove existing file/symlink before creating new one; use `mkdirSync({ recursive: true })` for parent dirs
**When to use:** Setup symlink, systemd unit copy, GNOME extension copy
**Example:**
```typescript
// Source: agent-bar-omarchy/src/setup.ts
function createSymlink(target: string, link: string): void {
  const dir = path.dirname(link);
  mkdirSync(dir, { recursive: true });
  try { unlinkSync(link); } catch {} // Remove existing
  symlinkSync(target, link);
}
```

### Pattern 3: Atomic Settings Write
**What:** Write to temp file then rename -- prevents partial writes on crash
**When to use:** All settings persistence
**Example:**
```typescript
// Source: agent-bar-omarchy/src/settings.ts (adapted for agent-bar)
export async function saveSettings(settings: Settings): Promise<void> {
  const { settingsDir, settingsFile } = getSettingsPaths();
  await mkdir(settingsDir, { recursive: true });
  const tmp = `${settingsFile}.tmp`;
  await Bun.write(tmp, JSON.stringify(normalizeSettings(settings), null, 2));
  await rename(tmp, settingsFile);
}
```

### Pattern 4: Subprocess via Existing Utility
**What:** Use the existing `runSubprocess` from `utils/subprocess.ts` for all subprocess calls
**When to use:** systemctl commands, gnome-extensions enable, git operations, bun install
**Example:**
```typescript
// Existing utility in codebase
import { runSubprocess, SubprocessError } from '../utils/subprocess.js';

// systemd reload + enable + restart
await runSubprocess('systemctl', ['--user', 'daemon-reload']);
await runSubprocess('systemctl', ['--user', 'enable', 'agent-bar.service']);
await runSubprocess('systemctl', ['--user', 'restart', 'agent-bar.service']);

// GNOME extension enable (ignore errors if already enabled)
try {
  await runSubprocess('gnome-extensions', ['enable', 'agent-bar-ubuntu@othavio.dev']);
} catch { /* already enabled or gnome-extensions not available */ }
```

### Pattern 5: Dependency Detection Without Auto-Install
**What:** Check for required binaries and report with exact install commands, but never install automatically
**When to use:** Setup command pre-flight check
**Example:**
```typescript
import { resolveCommandInPath } from '../utils/subprocess.js';

interface DependencyCheck {
  name: string;
  command: string;
  installHint: string;
}

const REQUIRED_DEPS: DependencyCheck[] = [
  { name: 'Bun', command: 'bun', installHint: 'curl -fsSL https://bun.sh/install | bash' },
  { name: 'secret-tool', command: 'secret-tool', installHint: 'sudo apt install libsecret-tools' },
  { name: 'gnome-extensions', command: 'gnome-extensions', installHint: 'sudo apt install gnome-shell-extensions' },
];

function checkDependencies(): { missing: DependencyCheck[] } {
  const missing = REQUIRED_DEPS.filter(dep => !resolveCommandInPath(dep.command));
  return { missing };
}
```

### Anti-Patterns to Avoid
- **Do NOT use `sudo` in any lifecycle command:** All paths are user-level (~/.local/bin, ~/.config/systemd/user/, ~/.local/share/gnome-shell/extensions/)
- **Do NOT auto-install missing dependencies:** Report them with install commands, let the user decide
- **Do NOT use `process.exit()` inside command logic:** Return early and let the caller handle exit. The omarchy reference uses `process.exit(1)` in catch blocks, but the agent-bar pattern uses `process.exitCode = 1` (see auth-command.ts)
- **Do NOT mix ora and @clack spinner:** The omarchy update.ts uses ora; agent-bar should use @clack consistently
- **Do NOT modify config.json from lifecycle commands:** Settings.json is separate from the existing config.json (which holds provider configuration)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Interactive CLI prompts | Custom readline flows | @clack/prompts | Battle-tested UX, cancel handling, spinner, confirm, note |
| Subprocess execution | New spawn wrapper | Existing `runSubprocess` from `utils/subprocess.ts` | Already has timeout, stdin piping, typed errors, PATH resolution |
| Secret deletion | Direct D-Bus calls | `secret-tool clear service <svc> account <acct>` via runSubprocess | Standard GNOME Keyring CLI, already used for lookup/store |
| PATH resolution | Manual PATH splitting | Existing `resolveCommandInPath` from `utils/subprocess.ts` | Already handles cross-platform path delimiter, X_OK check |
| XDG path resolution | Hardcoded ~/.config | Existing pattern from `config-path.ts` using `XDG_CONFIG_HOME` env | XDG spec compliance, testable via env injection |

**Key insight:** The codebase already has ~80% of the infrastructure needed. The main new code is the orchestration logic (which steps to run in which order) and the settings module. The subprocess, secret, and config path utilities are all reusable.

## Common Pitfalls

### Pitfall 1: Symlink Target Must Be Absolute
**What goes wrong:** Creating a symlink with a relative target breaks when the user is in a different directory
**Why it happens:** `symlinkSync(target, link)` creates an absolute or relative symlink depending on the target path
**How to avoid:** Always use `path.resolve()` for the symlink target. The omarchy reference does this correctly.
**Warning signs:** "command not found" when running from a different directory

### Pitfall 2: systemd daemon-reload Before restart
**What goes wrong:** Copying a new service file and running `systemctl --user restart` without `daemon-reload` uses the old unit definition
**Why it happens:** systemd caches unit files; it does not re-read them until daemon-reload
**How to avoid:** Always run `systemctl --user daemon-reload` after copying the service file, before enable/restart
**Warning signs:** Service starts with old ExecStart path or environment

### Pitfall 3: GNOME Extension Enable Requires Shell Running
**What goes wrong:** `gnome-extensions enable` silently fails if GNOME Shell is not running (e.g., SSH session, TTY)
**Why it happens:** The command talks to GNOME Shell via D-Bus; no shell = no D-Bus target
**How to avoid:** Wrap in try/catch, log a warning that the user may need to log out/in or run `gnome-extensions enable` manually
**Warning signs:** Extension not visible after setup when run from a headless session

### Pitfall 4: git pull --ff-only Fails With Local Commits
**What goes wrong:** Users who made local commits get a non-fast-forward error
**Why it happens:** `--ff-only` requires linear history from HEAD to the remote
**How to avoid:** Pre-check with `git status --porcelain` for dirty state AND `git rev-list HEAD..origin/master` count check. Show clear error message.
**Warning signs:** "fatal: Not possible to fast-forward, aborting." error message

### Pitfall 5: Environment Override File Must Capture Current Session State
**What goes wrong:** systemd service starts without PATH, DBUS_SESSION_BUS_ADDRESS, or token env vars
**Why it happens:** systemd user services run in a minimal environment; they don't inherit shell env vars
**How to avoid:** Generate `~/.config/systemd/user/agent-bar.service.d/env.conf` during setup, capturing key env vars from the current shell session
**Warning signs:** Service fails to find `bun`, secret-tool fails with D-Bus errors

### Pitfall 6: secret-tool clear Deletes ALL Matching Secrets
**What goes wrong:** Calling `secret-tool clear service agent-bar` without specifying account deletes ALL agent-bar secrets
**Why it happens:** `secret-tool clear` removes ALL items matching the given attribute pattern
**How to avoid:** Always specify both `service` AND `account` attributes: `secret-tool clear service agent-bar account copilot`
**Warning signs:** Other provider secrets disappear after uninstall

### Pitfall 7: Bun.write Needs Parent Directory to Exist
**What goes wrong:** `Bun.write('/path/to/new/dir/file.json', data)` throws ENOENT if parent dir doesn't exist
**Why it happens:** Unlike some Node.js write utilities, Bun.write doesn't create parent directories
**How to avoid:** Always `mkdirSync(parentDir, { recursive: true })` before writing
**Warning signs:** ENOENT error on first-time setup when ~/.config/agent-bar/ doesn't exist

## Code Examples

### Setup: CLI Symlink Creation
```typescript
// Adapted from agent-bar-omarchy/src/setup.ts
import { mkdirSync, symlinkSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(join(import.meta.dir, '..', '..', '..'));
const LOCAL_BIN = join(homedir(), '.local', 'bin');
const CLI_ENTRY = join(REPO_ROOT, 'apps', 'backend', 'src', 'cli.ts');

function createCliSymlink(): string {
  const link = join(LOCAL_BIN, 'agent-bar');
  // Create a shell wrapper that invokes bun with the CLI entry
  const wrapperContent = `#!/usr/bin/env bash\nset -euo pipefail\nexec bun "${CLI_ENTRY}" "$@"\n`;

  mkdirSync(LOCAL_BIN, { recursive: true });
  try { unlinkSync(link); } catch {}
  // Write wrapper script instead of symlink (bun needs explicit invocation)
  Bun.writeSync(link, wrapperContent);
  // Make executable
  Bun.spawnSync(['chmod', '+x', link]);
  return link;
}
```

### Setup: Systemd Service + Environment Override
```typescript
// Adapted from scripts/install-ubuntu.sh
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';

const SYSTEMD_DIR = join(homedir(), '.config', 'systemd', 'user');
const SERVICE_SRC = join(REPO_ROOT, 'packaging', 'systemd', 'user', 'agent-bar.service');
const SERVICE_DEST = join(SYSTEMD_DIR, 'agent-bar.service');
const OVERRIDE_DIR = join(SYSTEMD_DIR, 'agent-bar.service.d');
const ENV_OVERRIDE = join(OVERRIDE_DIR, 'env.conf');

const ENV_VARS_TO_CAPTURE = [
  'PATH', 'GITHUB_TOKEN', 'GH_TOKEN',
  'COPILOT_TOKEN', 'COPILOT_API_TOKEN', 'ANTHROPIC_API_KEY',
  'DBUS_SESSION_BUS_ADDRESS',
];

function installSystemdService(): void {
  mkdirSync(SYSTEMD_DIR, { recursive: true });
  cpSync(SERVICE_SRC, SERVICE_DEST);

  mkdirSync(OVERRIDE_DIR, { recursive: true });
  const lines = ['[Service]'];
  for (const name of ENV_VARS_TO_CAPTURE) {
    const value = process.env[name];
    if (value) lines.push(`Environment=${name}=${value}`);
  }
  writeFileSync(ENV_OVERRIDE, lines.join('\n') + '\n');
}
```

### Setup: GNOME Extension Copy
```typescript
// Adapted from scripts/install-ubuntu.sh
import { cpSync, mkdirSync } from 'node:fs';

const EXT_UUID = 'agent-bar-ubuntu@othavio.dev';
const EXT_SRC = join(REPO_ROOT, 'apps', 'gnome-extension');
const EXT_DEST = join(homedir(), '.local', 'share', 'gnome-shell', 'extensions', EXT_UUID);

const EXT_ITEMS = [
  'extension.js', 'metadata.json', 'panel', 'services',
  'state', 'utils', 'assets', 'stylesheet.css',
];

function installGnomeExtension(): void {
  mkdirSync(EXT_DEST, { recursive: true });
  for (const item of EXT_ITEMS) {
    const src = join(EXT_SRC, item);
    try {
      cpSync(src, join(EXT_DEST, item), { recursive: true });
    } catch { /* item may not exist */ }
  }
}
```

### Update: Git Fetch + Dirty Check + Pull
```typescript
// Adapted from agent-bar-omarchy/src/update.ts
import { runSubprocess, SubprocessError } from '../utils/subprocess.js';

async function runGit(args: string[]): Promise<{ ok: boolean; output: string }> {
  try {
    const result = await runSubprocess('git', args, { cwd: REPO_ROOT, timeoutMs: 30_000 });
    return { ok: true, output: result.stdout };
  } catch (error) {
    if (error instanceof SubprocessError) {
      return { ok: false, output: error.result.stderr || error.message };
    }
    return { ok: false, output: String(error) };
  }
}

async function checkDirtyState(): Promise<boolean> {
  const status = await runGit(['status', '--porcelain']);
  return status.ok && status.output.trim().length > 0;
}
```

### Uninstall: Secret Clearing
```typescript
// secret-tool clear deletes all matching secrets
import { runSubprocess } from '../utils/subprocess.js';

const KNOWN_SECRETS = [
  { service: 'agent-bar', account: 'copilot' },
  // Future providers can be added here
];

async function clearSecrets(): Promise<void> {
  for (const { service, account } of KNOWN_SECRETS) {
    try {
      await runSubprocess('secret-tool', ['clear', 'service', service, 'account', account]);
    } catch { /* secret may not exist */ }
  }
}
```

### Settings: Versioned Load + Normalize + Atomic Save
```typescript
// Adapted from agent-bar-omarchy/src/settings.ts
import { existsSync, mkdirSync } from 'node:fs';
import { mkdir, rename } from 'node:fs/promises';

const CURRENT_VERSION = 1;

interface Settings {
  version: number;
  // Phase 9 v1: minimal -- future phases add fields
}

const DEFAULT_SETTINGS: Settings = {
  version: CURRENT_VERSION,
};

function normalizeSettings(data: Partial<Settings> | undefined): Settings {
  const version = (data as Record<string, unknown>)?.version;
  if (typeof version === 'number' && version < CURRENT_VERSION) {
    data = migrateSettings(data as Record<string, unknown>, version) as Partial<Settings>;
  }
  return {
    version: CURRENT_VERSION,
    ...data,
  };
}

function migrateSettings(data: Record<string, unknown>, _fromVersion: number): Record<string, unknown> {
  // Future: if (fromVersion < 2) { /* v1 -> v2 migration */ }
  return data;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bash installer (install-ubuntu.sh) | TypeScript lifecycle commands | Phase 9 (now) | Full interactivity, idempotency, better error handling |
| Manual systemctl commands | Integrated in setup/update | Phase 9 (now) | Users don't need to remember systemd commands |
| No versioned settings | settings.json with version + migration | Phase 9 (now) | Safe schema evolution for future phases |
| Commander-based CLI | Commander (still, until Phase 10) | Phase 10 | Phase 9 still uses Commander for command registration |

**Important note:** Phase 10 will remove Commander in favor of manual parsing. Phase 9 commands should be written in a way that minimizes coupling to Commander -- isolate the logic in lifecycle/*.ts files and keep Commander registration thin (like the existing pattern in service-command.ts).

## Open Questions

1. **CLI wrapper vs direct symlink**
   - What we know: The current bash installer creates a shell wrapper (`#!/usr/bin/env bash\nexec node dist/cli.js "$@"`). With Bun, we could symlink directly to the `.ts` file or create a `bun`-based wrapper.
   - What's unclear: Whether `bun apps/backend/src/cli.ts` works reliably from a symlink, or if we need a wrapper script.
   - Recommendation: Create a bash wrapper like the current installer does, but with `exec bun` instead of `exec node`. This is the safest approach and matches the current pattern. Example: `#!/usr/bin/env bash\nset -euo pipefail\nexec bun "/absolute/path/to/apps/backend/src/cli.ts" "$@"`

2. **tmpfiles.d configuration**
   - What we know: The current installer copies `packaging/tmpfiles.d/agent-bar.conf` to `~/.config/user-tmpfiles.d/` and runs `systemd-tmpfiles --user --create`
   - What's unclear: Whether this should be part of the TypeScript setup or remain a separate concern
   - Recommendation: Include it in the setup flow -- it's a single file copy + subprocess call and protects the runtime socket directory

3. **Settings fields for v1**
   - What we know: The omarchy settings.ts has waybar-specific fields. Agent-bar settings will need different fields.
   - What's unclear: Exactly which fields beyond `version` are needed in Phase 9
   - Recommendation: Start with `{ version: number }` as the minimal schema. Future phases (11, 12) will add provider selection, display preferences, etc. The migration pattern handles evolution.

4. **Commander dependency during transition**
   - What we know: Phase 10 removes Commander. Phase 9 still needs to register new commands.
   - What's unclear: Nothing -- the approach is clear.
   - Recommendation: Register lifecycle commands via Commander (consistent with existing commands), but keep the logic completely separate in lifecycle/*.ts files. Phase 10's Commander removal will only touch the thin registration layer.

## Environment Availability

> Dev machine is NOT Ubuntu (noted in STATE.md blockers). systemd, gnome-extensions, and secret-tool cannot be validated locally.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| bun | Runtime, CLI entry | TBD (Ubuntu) | -- | Cannot run without Bun |
| systemctl | Setup, update (service management) | TBD (Ubuntu) | -- | Skip with warning on non-systemd systems |
| gnome-extensions | Setup (extension enable) | TBD (Ubuntu) | -- | Skip with warning; user enables manually |
| secret-tool | Uninstall (secret clearing) | TBD (Ubuntu) | -- | Skip secret clearing with warning |
| git | Update (fetch, pull) | Yes | system git | Cannot update without git |
| @clack/prompts | All lifecycle commands | Not installed | 1.1.0 (to install) | -- |

**Missing dependencies with no fallback:**
- `@clack/prompts` must be added to `apps/backend/package.json` before implementation

**Missing dependencies with fallback:**
- systemctl, gnome-extensions, secret-tool: all should be wrapped in try/catch with informative warnings when unavailable. The setup dependency-check handles detection.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (existing) + bun:test for Bun-native tests |
| Config file | `apps/backend/vitest.config.ts` |
| Quick run command | `cd apps/backend && bun run vitest run --config vitest.config.ts` |
| Full suite command | `pnpm test:backend` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIFE-01 | Setup creates symlink, copies systemd service, copies GNOME extension, generates env override | unit | `cd apps/backend && bun run vitest run test/lifecycle/setup.test.ts -x` | Wave 0 |
| LIFE-02 | Remove deletes installed files but preserves secrets and settings | unit | `cd apps/backend && bun run vitest run test/lifecycle/remove.test.ts -x` | Wave 0 |
| LIFE-03 | Update checks git status, fetches, shows commits, pulls, rebuilds, restarts | unit | `cd apps/backend && bun run vitest run test/lifecycle/update.test.ts -x` | Wave 0 |
| LIFE-04 | Uninstall removes everything including secrets after confirmation | unit | `cd apps/backend && bun run vitest run test/lifecycle/uninstall.test.ts -x` | Wave 0 |
| DATA-04 | Settings load/save with version, normalize, migrate, atomic write | unit | `cd apps/backend && bun run vitest run test/settings/settings.test.ts -x` | Wave 0 |

### Testing Strategy for Lifecycle Commands

All lifecycle commands interact with the filesystem and subprocesses. Tests should use **dependency injection** (consistent with the existing pattern in auth-command.ts):

```typescript
// Each lifecycle function accepts a dependencies object
interface SetupDependencies {
  runSubprocessFn?: typeof runSubprocess;
  existsFn?: typeof existsSync;
  mkdirFn?: typeof mkdirSync;
  symlinkFn?: typeof symlinkSync;
  // etc.
}
```

This allows unit tests to stub filesystem and subprocess calls without touching the real system. The existing `auth-command.test.ts` demonstrates this pattern with `storeSecret`, `ensureConfigRef`, and `restartService` stubs.

### Sampling Rate
- **Per task commit:** `cd apps/backend && bun run vitest run --config vitest.config.ts`
- **Per wave merge:** `pnpm test:backend`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `test/lifecycle/setup.test.ts` -- covers LIFE-01
- [ ] `test/lifecycle/remove.test.ts` -- covers LIFE-02
- [ ] `test/lifecycle/update.test.ts` -- covers LIFE-03
- [ ] `test/lifecycle/uninstall.test.ts` -- covers LIFE-04
- [ ] `test/settings/settings.test.ts` -- covers DATA-04
- [ ] Install @clack/prompts: `cd apps/backend && pnpm add @clack/prompts`

## Existing Code Inventory

### Files to Reuse (DO NOT rewrite)
| File | What It Provides | How Lifecycle Uses It |
|------|-----------------|----------------------|
| `src/utils/subprocess.ts` | `runSubprocess`, `resolveCommandInPath`, `SubprocessError` | All subprocess calls (systemctl, git, gnome-extensions, secret-tool, bun) |
| `src/auth/secret-tool-writer.ts` | `storeSecretViaSecretTool` | Not directly used by lifecycle (lifecycle uses `secret-tool clear`, not store) |
| `src/secrets/secret-tool-store.ts` | `SecretToolStore.resolve()` | Not directly used by lifecycle |
| `src/config/config-path.ts` | `resolveBackendConfigPath`, `CONFIG_DIR_NAME` | Reuse `CONFIG_DIR_NAME` for consistent path naming |
| `packaging/systemd/user/agent-bar.service` | systemd unit template | Setup copies this file |
| `packaging/tmpfiles.d/agent-bar.conf` | tmpfiles config | Setup copies this file |

### Files to Create
| File | Purpose |
|------|---------|
| `src/lifecycle/paths.ts` | Centralized install path constants (symlink, systemd dir, extension dir, settings dir, etc.) |
| `src/lifecycle/setup.ts` | Setup command: dependency check, symlink, systemd, GNOME extension, tmpfiles |
| `src/lifecycle/remove.ts` | Remove command: delete installed files, preserve secrets + settings |
| `src/lifecycle/update.ts` | Update command: git fetch/pull, bun install, rebuild, restart, re-copy extension |
| `src/lifecycle/uninstall.ts` | Uninstall command: full remove + secret clearing + settings deletion |
| `src/lifecycle/dependency-check.ts` | Pre-flight dependency detection (bun, secret-tool, gnome-extensions) |
| `src/settings/settings.ts` | Versioned settings: load, save, normalize, migrate |
| `src/settings/settings-schema.ts` | Settings interface, defaults, version constant |
| `src/commands/lifecycle-command.ts` | Commander registration for setup/remove/update/uninstall |

### Files to Modify
| File | Change |
|------|--------|
| `src/cli.ts` | Import and register lifecycle commands |
| `package.json` | Add `@clack/prompts` dependency |

## Key Constants Reference

These paths come from the existing `scripts/install-ubuntu.sh` and should be mirrored exactly in `lifecycle/paths.ts`:

```typescript
// All paths are user-level, no sudo needed
export const APP_NAME = 'agent-bar';
export const GNOME_EXT_UUID = 'agent-bar-ubuntu@othavio.dev';

// Derived from homedir() and XDG
export function getInstallPaths(home: string = homedir()) {
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(home, '.config');
  const xdgData = process.env.XDG_DATA_HOME || join(home, '.local', 'share');

  return {
    cliSymlink:     join(home, '.local', 'bin', APP_NAME),
    systemdDir:     join(xdgConfig, 'systemd', 'user'),
    serviceFile:    join(xdgConfig, 'systemd', 'user', `${APP_NAME}.service`),
    overrideDir:    join(xdgConfig, 'systemd', 'user', `${APP_NAME}.service.d`),
    envOverride:    join(xdgConfig, 'systemd', 'user', `${APP_NAME}.service.d`, 'env.conf'),
    tmpfilesDir:    join(xdgConfig, 'user-tmpfiles.d'),
    tmpfilesConf:   join(xdgConfig, 'user-tmpfiles.d', `${APP_NAME}.conf`),
    extensionDir:   join(xdgData, 'gnome-shell', 'extensions', GNOME_EXT_UUID),
    settingsDir:    join(xdgConfig, APP_NAME),
    settingsFile:   join(xdgConfig, APP_NAME, 'settings.json'),
    configFile:     join(xdgConfig, APP_NAME, 'config.json'),
  };
}
```

## Sources

### Primary (HIGH confidence)
- `agent-bar-omarchy/src/setup.ts` -- reference setup implementation, read in full
- `agent-bar-omarchy/src/update.ts` -- reference update implementation, read in full
- `agent-bar-omarchy/src/uninstall.ts` -- reference uninstall implementation, read in full
- `agent-bar-omarchy/src/remove.ts` -- reference remove wrapper, read in full
- `agent-bar-omarchy/src/settings.ts` -- reference settings with versioning, read in full
- `agent-bar-omarchy/src/app-identity.ts` -- reference app identity constants, read in full
- `scripts/install-ubuntu.sh` -- current bash installer (310 lines), read in full
- `apps/backend/src/cli.ts` -- current CLI entry point, read in full
- `apps/backend/src/commands/service-command.ts` -- command registration pattern, read in full
- `apps/backend/src/commands/auth-command.ts` -- dependency injection, systemctl restart, secret-tool patterns, read in full
- `apps/backend/src/utils/subprocess.ts` -- runSubprocess, resolveCommandInPath, read in full
- `apps/backend/src/config/config-path.ts` -- XDG path resolution, read in full
- `packaging/systemd/user/agent-bar.service` -- systemd unit template, read in full
- `@clack/prompts` README -- API docs: intro, outro, confirm, spinner, note, log, isCancel

### Secondary (MEDIUM confidence)
- [Ubuntu Manpage: secret-tool](https://manpages.ubuntu.com/manpages/bionic/man1/secret-tool.1.html) -- `secret-tool clear` command syntax
- [secret-tool man | Linux Command Library](https://linuxcommandlibrary.com/man/secret-tool) -- attribute matching behavior

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- @clack/prompts is locked decision, Bun runtime is Phase 8 output, all verified
- Architecture: HIGH -- Based on direct reading of omarchy reference + current codebase patterns
- Pitfalls: HIGH -- Based on install-ubuntu.sh real-world patterns and systemd/GNOME known behaviors
- Settings: HIGH -- Direct adaptation of omarchy settings.ts pattern

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable domain, no fast-moving dependencies)

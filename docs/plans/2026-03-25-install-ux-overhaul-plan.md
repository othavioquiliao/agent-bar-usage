# Install + UX + Provider Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the GNOME extension "Backend error", replace Claude PTY fetcher with HTTP API, redesign the installer for auto-detection/install, and improve CLI/extension UX with actionable error messages.

**Architecture:** Five independent workstreams in priority order: (1) Extension resilience with logging/retry, (2) Claude HTTP API fetcher replacing node-pty, (3) Smart installer with auto-install, (4) CLI UX improvements, (5) Config system with provider enable/disable. Each workstream produces a working, testable commit.

**Tech Stack:** TypeScript (backend), JavaScript/GJS (GNOME extension), Bash (installer), Zod (schemas), vitest (tests), systemd (service)

**Design doc:** `docs/plans/2026-03-25-install-ux-overhaul-design.md`

---

## Task 1: Extension — Add structured logging to backend-client and polling-service

**Files:**
- Modify: `apps/gnome-extension/services/backend-client.js`
- Modify: `apps/gnome-extension/services/polling-service.js`
- Test: `apps/gnome-extension/test/services/backend-client.test.js` (existing)
- Test: `apps/gnome-extension/test/services/polling-service.test.js` (existing)

- [ ] **Step 1: Write failing test — backend-client logs on subprocess failure**

In `apps/gnome-extension/test/services/backend-client.test.js`, add a test that verifies `console.error` is called when `runCommand` returns a failure result. The test should assert the log includes the mode, argv, and stderr.

```javascript
it("logs structured error when subprocess fails", async () => {
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => errors.push(args.join(" "));

  const client = createBackendClient({
    runCommand: async () => ({ success: false, stdout: "", stderr: "ENOENT", exitCode: 127 }),
    findProgramInPath: () => "/usr/bin/agent-bar",
  });

  await expect(client.fetchUsageSnapshot()).rejects.toThrow();
  expect(errors.some((e) => e.includes("[agent-bar]") && e.includes("ENOENT"))).toBe(true);

  console.error = originalError;
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:gnome -- --grep "logs structured error"`
Expected: FAIL — no console.error call exists yet

- [ ] **Step 3: Add logging to backend-client.js**

In `apps/gnome-extension/services/backend-client.js`, modify `fetchUsageSnapshot`:

```javascript
async fetchUsageSnapshot(options = {}) {
  const invocation = resolveBackendInvocation(options, commandDependencies);
  let result;
  try {
    result = await runCommand(invocation.argv, {
      cwd: invocation.cwd,
      Gio: dependencies.Gio,
      mode: invocation.mode,
    });
  } catch (spawnError) {
    console.error(`[agent-bar] Subprocess spawn failed (mode=${invocation.mode}): ${spawnError?.message ?? spawnError}`);
    console.error(`[agent-bar]   argv: ${invocation.argv.join(" ")}`);
    console.error(`[agent-bar]   cwd: ${invocation.cwd ?? "none"}`);
    throw new BackendClientError(`Subprocess spawn failed: ${spawnError?.message ?? spawnError}`, {
      argv: invocation.argv,
      cwd: invocation.cwd,
      mode: invocation.mode,
      cause: spawnError,
    });
  }

  if (!result?.success) {
    console.error(`[agent-bar] Backend command failed (mode=${invocation.mode}, exit=${result?.exitCode ?? "?"})`);
    console.error(`[agent-bar]   argv: ${invocation.argv.join(" ")}`);
    console.error(`[agent-bar]   stderr: ${result?.stderr?.trim() || "none"}`);
    throw createFailureError(invocation, result);
  }

  return parseStrictJson(result.stdout ?? "", "backend stdout");
},
```

- [ ] **Step 4: Add logging to polling-service.js**

In `apps/gnome-extension/services/polling-service.js`, add logging in the `.catch` block of `refreshNow` (around line 88):

```javascript
.catch((error) => {
  if (generation !== currentGeneration) {
    return undefined;
  }

  console.error(`[agent-bar] Snapshot fetch failed: ${error?.message ?? error}`);
  if (error?.argv) {
    console.error(`[agent-bar]   command: ${error.argv.join(" ")}`);
  }
  if (error?.stderr) {
    console.error(`[agent-bar]   stderr: ${error.stderr}`);
  }

  emit(applySnapshotError(state, error));
})
```

- [ ] **Step 5: Run all GNOME extension tests**

Run: `pnpm test:gnome`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/gnome-extension/services/backend-client.js apps/gnome-extension/services/polling-service.js apps/gnome-extension/test/
git commit -m "feat(gnome-extension): adicionar logging estruturado em backend-client e polling-service"
```

---

## Task 2: Extension — Add retry with exponential backoff on failure

**Files:**
- Modify: `apps/gnome-extension/services/polling-service.js`
- Test: `apps/gnome-extension/test/services/polling-service.test.js`

- [ ] **Step 1: Write failing test — retry after first failure**

```javascript
it("retries with backoff after failure", async () => {
  let callCount = 0;
  const backendClient = {
    fetchUsageSnapshot: async () => {
      callCount++;
      if (callCount <= 2) throw new Error("connection refused");
      return { schema_version: "1", generated_at: new Date().toISOString(), providers: [] };
    },
  };

  const timeouts = [];
  const scheduler = {
    setInterval: (cb, ms) => { timeouts.push({ cb, ms }); return timeouts.length; },
    clearInterval: () => {},
    now: () => new Date(),
  };

  const service = createPollingService({ backendClient, scheduler, retryDelays: [100, 200] });
  service.start();
  await service.refreshNow();

  // After first failure, a retry should be scheduled
  expect(timeouts.length).toBeGreaterThanOrEqual(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:gnome -- --grep "retries with backoff"`
Expected: FAIL

- [ ] **Step 3: Implement retry logic in polling-service.js**

Add to `createPollingService` parameters:
```javascript
export function createPollingService({
  backendClient,
  onStateChange = () => {},
  intervalMs = DEFAULT_INTERVAL_MS,
  scheduler = defaultScheduler(),
  initialState = createInitialState(),
  retryDelays = [2_000, 8_000, 30_000],
} = {}) {
```

Add retry state and scheduling:
```javascript
  let consecutiveFailures = 0;
  let retryHandle = null;

  function clearRetry() {
    if (retryHandle !== null) {
      scheduler.clearInterval(retryHandle);
      retryHandle = null;
    }
  }

  function scheduleRetry() {
    clearRetry();
    if (!isActive || consecutiveFailures === 0) return;
    const delay = retryDelays[Math.min(consecutiveFailures - 1, retryDelays.length - 1)];
    retryHandle = scheduler.setInterval(() => {
      clearRetry();
      void refreshNow();
    }, delay);
  }
```

In `refreshNow`, after `.then` success reset failures:
```javascript
  consecutiveFailures = 0;
  clearRetry();
```

In `.catch`, increment and schedule:
```javascript
  consecutiveFailures += 1;
  scheduleRetry();
```

In `stop()`, add `clearRetry(); consecutiveFailures = 0;`

- [ ] **Step 4: Run tests**

Run: `pnpm test:gnome`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add apps/gnome-extension/services/polling-service.js apps/gnome-extension/test/
git commit -m "feat(gnome-extension): retry com backoff exponencial apos falha do backend"
```

---

## Task 3: Extension — Actionable error messages in menu dropdown

**Files:**
- Modify: `apps/gnome-extension/utils/view-model.js`
- Test: `apps/gnome-extension/test/utils/view-model.test.js` (existing)

- [ ] **Step 1: Write failing test — error code maps to actionable message**

```javascript
it("maps copilot_token_missing to actionable suggestion", () => {
  const snapshot = { provider: "copilot", status: "error", error: { code: "copilot_token_missing", message: "No token" } };
  const vm = buildProviderRowViewModel(snapshot);
  expect(vm.suggestedCommandText).toContain("agent-bar auth copilot");
});

it("maps claude_auth_expired to actionable suggestion", () => {
  const snapshot = { provider: "claude", status: "error", error: { code: "claude_auth_expired", message: "Expired" } };
  const vm = buildProviderRowViewModel(snapshot);
  expect(vm.suggestedCommandText).toContain("claude auth login");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:gnome -- --grep "maps.*actionable"`
Expected: FAIL — current code always returns `"agent-bar doctor --json"`

- [ ] **Step 3: Implement error-code-to-command mapping in view-model.js**

Replace the `formatSuggestedCommand` function (lines 70-80):

```javascript
const ERROR_CODE_COMMANDS = {
  copilot_token_missing: "agent-bar auth copilot",
  claude_auth_expired: "claude auth login",
  claude_cli_missing: "npm i -g @anthropic-ai/claude-code",
  claude_cli_failed: "agent-bar doctor",
  codex_cli_missing: "npm i -g @openai/codex",
  codex_cli_failed: "agent-bar doctor",
  codex_pty_unavailable: "sudo apt install build-essential python3 && pnpm install",
  secret_store_unavailable: "sudo apt install libsecret-tools",
};

function formatSuggestedCommand(providerSnapshot) {
  if (!providerSnapshot) return null;
  const code = providerSnapshot.error?.code;
  if (code && ERROR_CODE_COMMANDS[code]) {
    return `Run: ${ERROR_CODE_COMMANDS[code]}`;
  }
  if (providerSnapshot.error || (providerSnapshot.diagnostics?.attempts?.length ?? 0) > 0) {
    return "Run: agent-bar doctor";
  }
  return null;
}
```

- [ ] **Step 4: Run all tests**

Run: `pnpm test:gnome`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add apps/gnome-extension/utils/view-model.js apps/gnome-extension/test/
git commit -m "feat(gnome-extension): mensagens de erro acionaveis com comando sugerido por provider"
```

---

## Task 4: Backend — Claude HTTP API fetcher (replace PTY)

**Files:**
- Create: `apps/backend/src/providers/claude/claude-api-fetcher.ts`
- Create: `apps/backend/src/providers/claude/claude-credentials.ts`
- Modify: `apps/backend/src/providers/claude/claude-cli-adapter.ts`
- Create: `apps/backend/test/providers/claude/claude-api-fetcher.test.ts`
- Create: `apps/backend/test/providers/claude/claude-credentials.test.ts`
- Modify: `packages/shared-contract/src/snapshot.ts` (add `claude_auth_expired` error code)

- [ ] **Step 1: Add `claude_auth_expired` to shared-contract error codes**

In `packages/shared-contract/src/snapshot.ts`, add `"claude_auth_expired"` to the error code union if not already present. Rebuild shared-contract: `pnpm build:shared`.

- [ ] **Step 2: Write claude-credentials.ts — read OAuth token from disk**

Create `apps/backend/src/providers/claude/claude-credentials.ts`:

```typescript
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface ClaudeCredentials {
  accessToken: string;
  expiresAt: string | null;
}

export async function readClaudeCredentials(
  credentialsPath?: string,
): Promise<ClaudeCredentials | null> {
  const filePath = credentialsPath ?? join(homedir(), ".claude", ".credentials.json");

  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const oauth = (parsed as Record<string, unknown>)?.claudeAiOauth;
  if (!oauth || typeof oauth !== "object") return null;

  const record = oauth as Record<string, unknown>;
  const accessToken = record.accessToken;
  if (typeof accessToken !== "string" || !accessToken) return null;

  return {
    accessToken,
    expiresAt: typeof record.expiresAt === "string" ? record.expiresAt : null,
  };
}
```

- [ ] **Step 3: Write failing test for claude-credentials.ts**

Create `apps/backend/test/providers/claude/claude-credentials.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readClaudeCredentials } from "../../../src/providers/claude/claude-credentials.js";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("readClaudeCredentials", () => {
  it("returns null when file does not exist", async () => {
    const result = await readClaudeCredentials("/nonexistent/path.json");
    expect(result).toBeNull();
  });

  it("reads accessToken from valid credentials file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "claude-creds-"));
    const path = join(dir, ".credentials.json");
    await writeFile(path, JSON.stringify({
      claudeAiOauth: { accessToken: "sk-ant-test-123", expiresAt: "2026-12-31T00:00:00Z" },
    }));

    const result = await readClaudeCredentials(path);
    expect(result).toEqual({ accessToken: "sk-ant-test-123", expiresAt: "2026-12-31T00:00:00Z" });

    await rm(dir, { recursive: true });
  });

  it("returns null when claudeAiOauth missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "claude-creds-"));
    const path = join(dir, ".credentials.json");
    await writeFile(path, JSON.stringify({ someOtherKey: true }));

    const result = await readClaudeCredentials(path);
    expect(result).toBeNull();

    await rm(dir, { recursive: true });
  });
});
```

- [ ] **Step 4: Run test**

Run: `pnpm test:backend -- --grep "readClaudeCredentials"`
Expected: All PASS

- [ ] **Step 5: Write claude-api-fetcher.ts**

Create `apps/backend/src/providers/claude/claude-api-fetcher.ts`:

```typescript
import type { ProviderSnapshot } from "shared-contract";
import { readClaudeCredentials, type ClaudeCredentials } from "./claude-credentials.js";

const USAGE_ENDPOINT = "https://api.anthropic.com/api/oauth/usage";
const REQUEST_TIMEOUT_MS = 10_000;

interface UsageWindow {
  utilization: number | null;
  resets_at: string | null;
}

interface ClaudeUsageResponse {
  five_hour?: UsageWindow | null;
  seven_day?: UsageWindow | null;
  [key: string]: unknown;
}

function formatResetLabel(resetsAt: string | null): string {
  if (!resetsAt) return "Unknown reset";
  const now = Date.now();
  const resetMs = new Date(resetsAt).getTime();
  const diffMs = resetMs - now;
  if (diffMs <= 0) return "Resets soon";
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  if (hours > 0) return `Resets in ${hours}h ${minutes}m`;
  return `Resets in ${minutes}m`;
}

function mapToSnapshot(response: ClaudeUsageResponse): ProviderSnapshot {
  const fiveHour = response.five_hour;
  const sevenDay = response.seven_day;
  const primary = fiveHour ?? sevenDay;
  const utilization = primary?.utilization ?? null;

  const status = utilization === null
    ? "unavailable"
    : utilization >= 90
      ? "degraded"
      : "ok";

  return {
    provider: "claude",
    status,
    source: "api",
    updated_at: new Date().toISOString(),
    usage: utilization !== null
      ? { kind: "quota", used: Math.round(utilization), limit: 100, percent_used: Math.round(utilization) }
      : null,
    reset_window: primary?.resets_at
      ? { label: formatResetLabel(primary.resets_at), resets_at: primary.resets_at }
      : null,
    error: null,
  };
}

export async function fetchClaudeUsageViaApi(
  dependencies: { credentials?: ClaudeCredentials | null; credentialsPath?: string; fetch?: typeof globalThis.fetch } = {},
): Promise<ProviderSnapshot> {
  const credentials = dependencies.credentials ?? await readClaudeCredentials(dependencies.credentialsPath);

  if (!credentials) {
    return {
      provider: "claude",
      status: "error",
      source: "api",
      updated_at: new Date().toISOString(),
      usage: null,
      reset_window: null,
      error: { code: "claude_cli_missing", message: "Claude credentials not found at ~/.claude/.credentials.json. Run: claude auth login", retryable: false },
    };
  }

  const fetchFn = dependencies.fetch ?? globalThis.fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchFn(USAGE_ENDPOINT, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${credentials.accessToken}`,
        "anthropic-beta": "oauth-2025-04-20",
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      return {
        provider: "claude",
        status: "error",
        source: "api",
        updated_at: new Date().toISOString(),
        usage: null,
        reset_window: null,
        error: { code: "claude_auth_expired", message: "Claude login expired. Run: claude auth login", retryable: false },
      };
    }

    if (response.status === 429) {
      return {
        provider: "claude",
        status: "error",
        source: "api",
        updated_at: new Date().toISOString(),
        usage: null,
        reset_window: null,
        error: { code: "claude_cli_failed", message: "Claude API rate limited. Data will refresh on next cycle.", retryable: true },
      };
    }

    if (!response.ok) {
      return {
        provider: "claude",
        status: "error",
        source: "api",
        updated_at: new Date().toISOString(),
        usage: null,
        reset_window: null,
        error: { code: "claude_cli_failed", message: `Claude API returned HTTP ${response.status}`, retryable: true },
      };
    }

    const body = (await response.json()) as ClaudeUsageResponse;
    return mapToSnapshot(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      provider: "claude",
      status: "error",
      source: "api",
      updated_at: new Date().toISOString(),
      usage: null,
      reset_window: null,
      error: { code: "claude_cli_failed", message: `Claude API fetch failed: ${message}`, retryable: true },
    };
  } finally {
    clearTimeout(timeout);
  }
}
```

- [ ] **Step 6: Write failing tests for claude-api-fetcher.ts**

Create `apps/backend/test/providers/claude/claude-api-fetcher.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { fetchClaudeUsageViaApi } from "../../../src/providers/claude/claude-api-fetcher.js";

function mockFetch(status: number, body: unknown) {
  return async () => ({ ok: status >= 200 && status < 300, status, json: async () => body } as Response);
}

describe("fetchClaudeUsageViaApi", () => {
  it("returns snapshot with utilization from five_hour", async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: "sk-test", expiresAt: null },
      fetch: mockFetch(200, { five_hour: { utilization: 45.0, resets_at: "2026-03-26T04:00:00Z" }, seven_day: { utilization: 29.0, resets_at: "2026-03-29T00:00:00Z" } }),
    });

    expect(result.provider).toBe("claude");
    expect(result.status).toBe("ok");
    expect(result.usage?.percent_used).toBe(45);
    expect(result.error).toBeNull();
  });

  it("returns degraded when utilization >= 90", async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: "sk-test", expiresAt: null },
      fetch: mockFetch(200, { five_hour: { utilization: 95.0, resets_at: "2026-03-26T04:00:00Z" } }),
    });

    expect(result.status).toBe("degraded");
  });

  it("returns claude_auth_expired on 401", async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: "sk-expired", expiresAt: null },
      fetch: mockFetch(401, {}),
    });

    expect(result.error?.code).toBe("claude_auth_expired");
    expect(result.error?.message).toContain("claude auth login");
  });

  it("returns error when no credentials file", async () => {
    const result = await fetchClaudeUsageViaApi({
      credentialsPath: "/nonexistent/path.json",
    });

    expect(result.error?.code).toBe("claude_cli_missing");
  });

  it("handles rate limiting (429)", async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: "sk-test", expiresAt: null },
      fetch: mockFetch(429, {}),
    });

    expect(result.error?.retryable).toBe(true);
  });
});
```

- [ ] **Step 7: Run tests**

Run: `pnpm test:backend -- --grep "fetchClaudeUsageViaApi|readClaudeCredentials"`
Expected: All PASS

- [ ] **Step 8: Wire API fetcher into claude-cli-adapter.ts**

Modify `apps/backend/src/providers/claude/claude-cli-adapter.ts` to prefer API when credentials exist:

```typescript
// Add import at top:
import { readClaudeCredentials } from "./claude-credentials.js";
import { fetchClaudeUsageViaApi } from "./claude-api-fetcher.js";

// In the fetch method, add API-first logic:
async fetch(context) {
  // Prefer HTTP API when Claude credentials exist
  const credentials = await readClaudeCredentials();
  if (credentials) {
    return fetchClaudeUsageViaApi({ credentials });
  }

  // Fallback to PTY
  return existingPtyFetchLogic(context);
}
```

- [ ] **Step 9: Build and run all backend tests**

Run: `pnpm build:backend && pnpm test:backend`
Expected: All PASS

- [ ] **Step 10: Commit**

```bash
git add apps/backend/src/providers/claude/ apps/backend/test/providers/claude/ packages/shared-contract/
git commit -m "feat(claude): fetcher HTTP via /api/oauth/usage substituindo PTY como metodo primario"
```

---

## Task 5: Smart installer — rewrite install-ubuntu.sh

**Files:**
- Modify: `scripts/install-ubuntu.sh`
- Modify: `scripts/verify-ubuntu-install.sh`

- [ ] **Step 1: Rewrite install-ubuntu.sh with auto-detection and install**

Replace `scripts/install-ubuntu.sh` with a new version that:

1. Defines helper functions: `step_ok()`, `step_warn()`, `step_fail()`, `confirm_install()`
2. Pre-flight: checks Ubuntu/GNOME Shell version
3. For each dep (node, pnpm, libsecret-tools, claude, codex):
   - Check if installed (`command -v`)
   - If missing, ask `Install X? [Y/n]` then install
   - Node: via nvm if not present
   - pnpm: via `corepack enable && corepack prepare`
   - libsecret-tools: via `sudo apt install -y libsecret-tools`
   - Claude CLI: via `npm install -g @anthropic-ai/claude-code`
   - Codex CLI: via `npm install -g @openai/codex`
4. Run existing build+install logic (pnpm install, build, wrapper, systemd, extension)
5. Post-install: run `agent-bar doctor` and display colorized results
6. If Copilot token missing: print setup instructions

Key design rules:
- Every `sudo` command requires explicit Y/n confirmation
- If user says N, skip gracefully with warning
- Idempotent: safe to run multiple times
- Each step prints `[ok]`, `[!!]`, or `[FAIL]` prefix

- [ ] **Step 2: Test installer manually**

Run: `bash scripts/install-ubuntu.sh`
Expected: Detects existing installations, skips already-installed deps, builds, installs, validates

- [ ] **Step 3: Update verify-ubuntu-install.sh**

Add checks for: Claude CLI, Codex CLI, agent-bar doctor exit code.

- [ ] **Step 4: Commit**

```bash
git add scripts/install-ubuntu.sh scripts/verify-ubuntu-install.sh
git commit -m "feat(installer): smart install com auto-deteccao e instalacao de dependencias"
```

---

## Task 6: CLI — Human-readable doctor output

**Files:**
- Modify: `apps/backend/src/commands/diagnostics-command.ts`
- Create: `apps/backend/src/formatters/doctor-text-formatter.ts`
- Test: `apps/backend/test/formatters/doctor-text-formatter.test.ts`

- [ ] **Step 1: Write failing test for doctor text formatter**

```typescript
import { describe, it, expect } from "vitest";
import { formatDoctorAsText } from "../../../src/formatters/doctor-text-formatter.js";

describe("formatDoctorAsText", () => {
  it("formats ok check with green prefix", () => {
    const result = formatDoctorAsText({
      generated_at: "2026-01-01T00:00:00Z",
      runtime_mode: "service",
      checks: [{ id: "secret-tool", label: "secret-tool", status: "ok", message: "Available at /usr/bin/secret-tool", suggested_command: "" }],
    });

    expect(result).toContain("[ok]");
    expect(result).toContain("secret-tool");
  });

  it("formats fail check with suggested command", () => {
    const result = formatDoctorAsText({
      generated_at: "2026-01-01T00:00:00Z",
      runtime_mode: "cli",
      checks: [{ id: "copilot-token", label: "Copilot token", status: "warn", message: "Not configured", suggested_command: "agent-bar auth copilot" }],
    });

    expect(result).toContain("[!!]");
    expect(result).toContain("agent-bar auth copilot");
  });
});
```

- [ ] **Step 2: Implement doctor-text-formatter.ts**

Create `apps/backend/src/formatters/doctor-text-formatter.ts`:

```typescript
interface DoctorCheck {
  id: string;
  label: string;
  status: string;
  message: string;
  suggested_command?: string;
}

interface DoctorReport {
  generated_at: string;
  runtime_mode: string;
  checks: DoctorCheck[];
}

function statusPrefix(status: string): string {
  switch (status) {
    case "ok": return "[ok]";
    case "warn": return "[!!]";
    default: return "[FAIL]";
  }
}

export function formatDoctorAsText(report: DoctorReport): string {
  const lines: string[] = ["Agent Bar Doctor", ""];

  for (const check of report.checks) {
    lines.push(`  ${statusPrefix(check.status)} ${check.label}: ${check.message}`);
    if (check.status !== "ok" && check.suggested_command) {
      lines.push(`       -> ${check.suggested_command}`);
    }
  }

  lines.push("");
  lines.push(`Mode: ${report.runtime_mode}`);
  return lines.join("\n");
}
```

- [ ] **Step 3: Wire into diagnostics-command.ts**

Modify `apps/backend/src/commands/diagnostics-command.ts` to use text formatter when `--json` is not passed:

```typescript
import { formatDoctorAsText } from "../formatters/doctor-text-formatter.js";

// In the action handler:
if (options.json) {
  process.stdout.write(JSON.stringify(report, null, options.pretty ? 2 : 0) + "\n");
} else {
  process.stdout.write(formatDoctorAsText(report) + "\n");
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test:backend`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/formatters/doctor-text-formatter.ts apps/backend/src/commands/diagnostics-command.ts apps/backend/test/
git commit -m "feat(cli): output human-readable para agent-bar doctor com sugestoes de fix"
```

---

## Task 7: Config — Provider enable/disable and source preference

**Files:**
- Modify: `apps/backend/src/config/config-loader.ts`
- Modify: `apps/backend/src/core/backend-coordinator.ts`
- Test: `apps/backend/test/config/config-loader.test.ts` (existing)

- [ ] **Step 1: Extend config schema with provider source and enabled**

In `apps/backend/src/config/config-loader.ts`, add to the config Zod schema:

```typescript
const providerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  source: z.enum(["auto", "api", "cli"]).default("auto"),
}).default({});

// Add to main config schema:
providers: z.object({
  copilot: providerConfigSchema,
  claude: providerConfigSchema,
  codex: providerConfigSchema,
}).default({}),
cache: z.object({
  ttl_seconds: z.number().min(30).default(300),
}).default({}),
```

- [ ] **Step 2: Write test for new config shape**

```typescript
it("loads config with provider enabled/source defaults", () => {
  const config = loadBackendConfig();
  expect(config.providers.claude.enabled).toBe(true);
  expect(config.providers.claude.source).toBe("auto");
});
```

- [ ] **Step 3: Wire into backend-coordinator.ts**

In `backend-coordinator.ts`, check `config.providers[id].enabled` before building context. Skip disabled providers.

- [ ] **Step 4: Run tests**

Run: `pnpm test:backend`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/config/ apps/backend/src/core/ apps/backend/test/
git commit -m "feat(config): suporte a provider enabled/disabled e source preference no config"
```

---

## Task 8: Auth — Claude and Codex auth validation commands

**Files:**
- Modify: `apps/backend/src/commands/auth-command.ts`
- Test: `apps/backend/test/commands/auth-command.test.ts` (if exists)

- [ ] **Step 1: Add `agent-bar auth claude` subcommand**

```typescript
authCommand
  .command("claude")
  .description("Validate Claude CLI authentication.")
  .action(async () => {
    const credentials = await readClaudeCredentials();
    if (!credentials) {
      process.stderr.write("Claude credentials not found.\n  -> Run: claude auth login\n");
      process.exitCode = 1;
      return;
    }
    process.stdout.write("Claude: authenticated (token found in ~/.claude/.credentials.json)\n");
  });
```

- [ ] **Step 2: Add `agent-bar auth codex` subcommand**

Similar pattern: check if `~/.codex/auth.json` exists and has valid tokens.

- [ ] **Step 3: Run tests**

Run: `pnpm test:backend`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/commands/auth-command.ts apps/backend/src/auth/ apps/backend/test/
git commit -m "feat(auth): comandos agent-bar auth claude e agent-bar auth codex para validacao"
```

---

## Task 9: Integration — Rebuild, reinstall, and validate end-to-end

**Files:**
- No new files — integration verification

- [ ] **Step 1: Full rebuild**

Run: `pnpm build:backend`
Expected: Clean build, no errors

- [ ] **Step 2: Reinstall**

Run: `pnpm install:ubuntu`
Expected: All steps pass, GNOME extension updated

- [ ] **Step 3: Run all tests**

Run: `pnpm test:backend && pnpm test:gnome`
Expected: All PASS

- [ ] **Step 4: Verify service**

Run: `agent-bar service status --json`
Expected: `running: true`

- [ ] **Step 5: Test Claude HTTP fetcher live**

Run: `agent-bar usage --provider claude --json --refresh`
Expected: Returns snapshot with `source: "api"` and real utilization data

- [ ] **Step 6: Test doctor human-readable output**

Run: `agent-bar doctor`
Expected: Formatted output with `[ok]`/`[!!]`/`[FAIL]` prefixes

- [ ] **Step 7: Check GNOME extension logs**

Run: `journalctl --user -b | grep "\[agent-bar\]" | tail -10`
Expected: If extension still fails, now we have diagnostic logs showing the exact error

- [ ] **Step 8: Final commit with updated README**

Update README.md troubleshooting section to reference new `agent-bar doctor` text output and auth commands.

```bash
git add README.md
git commit -m "docs: atualizar README com novos comandos auth e doctor formatado"
```

import { spawn } from "node:child_process";

import type { ProviderSnapshot } from "shared-contract";

import { resolveCommandInPath } from "../../utils/subprocess.js";

const REQUEST_TIMEOUT_MS = 10_000;

interface RateLimitPrimary {
  usedPercent: number;
  windowDurationMins: number;
  resetsAt: number; // Unix timestamp in seconds
}

interface RateLimitsResult {
  rateLimits: {
    primary: RateLimitPrimary | null;
    secondary: RateLimitPrimary | null;
    credits?: { hasCredits: boolean; balance: number | null } | null;
    planType?: string | null;
  };
}

export function formatResetLabel(resetsAtUnix: number, now = Date.now()): string {
  const resetMs = resetsAtUnix * 1000;
  const diffMs = resetMs - now;
  if (diffMs <= 0) return "Resets soon";
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `Resets in ${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `Resets in ${hours}h ${minutes}m`;
  return `Resets in ${minutes}m`;
}

export function mapToSnapshot(result: RateLimitsResult, now = Date.now()): ProviderSnapshot {
  const primary = result.rateLimits.primary;
  const usedPercent = primary?.usedPercent ?? null;

  const status = usedPercent === null
    ? "unavailable"
    : usedPercent >= 90
      ? "degraded"
      : "ok";

  return {
    provider: "codex",
    status,
    source: "cli",
    updated_at: new Date(now).toISOString(),
    usage: usedPercent !== null
      ? { kind: "quota", used: Math.round(usedPercent), limit: 100, percent_used: Math.round(usedPercent) }
      : null,
    reset_window: primary?.resetsAt
      ? { label: formatResetLabel(primary.resetsAt, now), resets_at: new Date(primary.resetsAt * 1000).toISOString() }
      : null,
    error: null,
  };
}

export interface AppServerDependencies {
  env?: NodeJS.ProcessEnv;
  codexBinary?: string;
  timeoutMs?: number;
}

export async function fetchCodexUsageViaAppServer(
  dependencies: AppServerDependencies = {},
): Promise<ProviderSnapshot> {
  const env = dependencies.env ?? process.env;
  const binary = dependencies.codexBinary ?? resolveCommandInPath("codex", env);
  const timeoutMs = dependencies.timeoutMs ?? REQUEST_TIMEOUT_MS;

  if (!binary) {
    return {
      provider: "codex",
      status: "error",
      source: "cli",
      updated_at: new Date().toISOString(),
      usage: null,
      reset_window: null,
      error: { code: "codex_cli_missing", message: "Codex CLI not found on PATH.", retryable: false },
    };
  }

  return new Promise<ProviderSnapshot>((resolve) => {
    let settled = false;

    const settle = (snapshot: ProviderSnapshot) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      resolve(snapshot);
    };

    const child = spawn(binary, ["app-server"], {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let initDone = false;

    const timer = setTimeout(() => {
      settle({
        provider: "codex",
        status: "error",
        source: "cli",
        updated_at: new Date().toISOString(),
        usage: null,
        reset_window: null,
        error: { code: "codex_cli_failed", message: "Codex app-server timed out.", retryable: true },
      });
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();

      // Parse line-delimited JSON-RPC responses
      const lines = stdout.split("\n");
      stdout = lines.pop() ?? ""; // keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let msg: { id?: number; result?: unknown; error?: unknown };
        try {
          msg = JSON.parse(trimmed);
        } catch {
          continue;
        }

        // Response to initialize (id=1)
        if (msg.id === 1 && !initDone) {
          initDone = true;
          child.stdin.write(
            '{"jsonrpc":"2.0","method":"account/rateLimits/read","id":2,"params":{}}\n',
          );
        }

        // Response to rateLimits (id=2)
        if (msg.id === 2) {
          if (msg.error) {
            settle({
              provider: "codex",
              status: "error",
              source: "cli",
              updated_at: new Date().toISOString(),
              usage: null,
              reset_window: null,
              error: {
                code: "codex_cli_failed",
                message: `Codex app-server error: ${JSON.stringify(msg.error)}`,
                retryable: true,
              },
            });
            return;
          }

          try {
            const result = msg.result as RateLimitsResult;
            settle(mapToSnapshot(result));
          } catch (e) {
            settle({
              provider: "codex",
              status: "error",
              source: "cli",
              updated_at: new Date().toISOString(),
              usage: null,
              reset_window: null,
              error: {
                code: "codex_cli_failed",
                message: `Failed to parse rate limits: ${e instanceof Error ? e.message : String(e)}`,
                retryable: true,
              },
            });
          }
          return;
        }
      }
    });

    child.on("error", (err) => {
      settle({
        provider: "codex",
        status: "error",
        source: "cli",
        updated_at: new Date().toISOString(),
        usage: null,
        reset_window: null,
        error: { code: "codex_cli_failed", message: `Codex app-server failed: ${err.message}`, retryable: true },
      });
    });

    child.on("close", () => {
      // If close fires before we got the response, it's an unexpected exit
      settle({
        provider: "codex",
        status: "error",
        source: "cli",
        updated_at: new Date().toISOString(),
        usage: null,
        reset_window: null,
        error: { code: "codex_cli_failed", message: "Codex app-server exited before returning rate limits.", retryable: true },
      });
    });

    // Send initialize request immediately
    child.stdin.write(
      '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"clientInfo":{"name":"agent-bar","version":"1.0.0"}}}\n',
    );
  });
}

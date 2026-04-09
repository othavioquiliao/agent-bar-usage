import type { ProviderSnapshot } from 'shared-contract';

import { resolveCommandInPath } from '../../utils/subprocess.js';

const REQUEST_TIMEOUT_MS = 15_000;
const STDIN_CLOSE_DELAY_MS = 5_000;

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
  if (diffMs <= 0) return 'Resets soon';
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

  const status = usedPercent === null ? 'unavailable' : usedPercent >= 90 ? 'degraded' : 'ok';

  return {
    provider: 'codex',
    status,
    source: 'cli',
    updated_at: new Date(now).toISOString(),
    usage:
      usedPercent !== null
        ? { kind: 'quota', used: Math.round(usedPercent), limit: 100, percent_used: Math.round(usedPercent) }
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
  stdinCloseDelayMs?: number;
}

export async function fetchCodexUsageViaAppServer(dependencies: AppServerDependencies = {}): Promise<ProviderSnapshot> {
  const env = dependencies.env ?? process.env;
  const binary = dependencies.codexBinary ?? resolveCommandInPath('codex', env);
  const timeoutMs = dependencies.timeoutMs ?? REQUEST_TIMEOUT_MS;

  if (!binary) {
    return {
      provider: 'codex',
      status: 'error',
      source: 'cli',
      updated_at: new Date().toISOString(),
      usage: null,
      reset_window: null,
      error: { code: 'codex_cli_missing', message: 'Codex CLI not found on PATH.', retryable: false },
    };
  }

  const stdinCloseDelay = dependencies.stdinCloseDelayMs ?? STDIN_CLOSE_DELAY_MS;

  return new Promise<ProviderSnapshot>((resolve) => {
    let settled = false;
    let closeTimer: ReturnType<typeof setTimeout>;

    const settle = (snapshot: ProviderSnapshot) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(closeTimer);
      child.kill();
      resolve(snapshot);
    };

    const child = Bun.spawn([binary, 'app-server'], {
      env: { ...process.env, ...env },
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const timer = setTimeout(() => {
      settle({
        provider: 'codex',
        status: 'error',
        source: 'cli',
        updated_at: new Date().toISOString(),
        usage: null,
        reset_window: null,
        error: { code: 'codex_cli_failed', message: 'Codex app-server timed out.', retryable: true },
      });
    }, timeoutMs);

    // Collect ALL stdout, then parse after process exits.
    // This avoids a race between child.exited and the stream reader —
    // in a busy event loop (e.g. systemd service), child.exited can resolve
    // before the reader processes the flushed stdout bytes.
    const stdoutChunks: string[] = [];
    const streamDone = (async () => {
      const reader = child.stdout.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done || settled) break;
          stdoutChunks.push(new TextDecoder().decode(value));
        }
      } catch {
        // Stream closed
      }
    })();

    child.exited.then(async () => {
      clearTimeout(closeTimer);
      // Wait for the stream reader to drain any remaining buffered data
      await streamDone;
      if (settled) return;

      // Parse all collected stdout for the rateLimits response (id=2)
      const output = stdoutChunks.join('');
      for (const line of output.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let msg: { id?: number; result?: unknown; error?: unknown };
        try {
          msg = JSON.parse(trimmed);
        } catch {
          continue;
        }

        if (msg.id === 2) {
          if (msg.error) {
            settle({
              provider: 'codex',
              status: 'error',
              source: 'cli',
              updated_at: new Date().toISOString(),
              usage: null,
              reset_window: null,
              error: {
                code: 'codex_cli_failed',
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
              provider: 'codex',
              status: 'error',
              source: 'cli',
              updated_at: new Date().toISOString(),
              usage: null,
              reset_window: null,
              error: {
                code: 'codex_cli_failed',
                message: `Failed to parse rate limits: ${e instanceof Error ? e.message : String(e)}`,
                retryable: true,
              },
            });
          }
          return;
        }
      }

      settle({
        provider: 'codex',
        status: 'error',
        source: 'cli',
        updated_at: new Date().toISOString(),
        usage: null,
        reset_window: null,
        error: {
          code: 'codex_cli_failed',
          message: 'Codex app-server exited before returning rate limits.',
          retryable: true,
        },
      });
    });

    // Send both requests at once — codex app-server uses block-buffered stdout
    // when connected to a pipe, so responses only arrive when the process exits.
    // We close stdin after a delay to trigger exit + flush.
    child.stdin.write(
      '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"clientInfo":{"name":"agent-bar","version":"1.0.0"}}}\n' +
        '{"jsonrpc":"2.0","method":"account/rateLimits/read","id":2,"params":{}}\n',
    );
    child.stdin.flush();

    closeTimer = setTimeout(() => {
      try {
        child.stdin.end();
      } catch {
        // stdin may already be closed if process exited early
      }
    }, stdinCloseDelay);
  });
}

import type { ProviderSnapshot } from 'shared-contract';
import { type ClaudeCredentials, readClaudeCredentials } from './claude-credentials.js';

const USAGE_ENDPOINT = 'https://api.anthropic.com/api/oauth/usage';
const REQUEST_TIMEOUT_MS = 10_000;

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

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
  if (!resetsAt) return 'Unknown reset';
  const now = Date.now();
  const resetMs = new Date(resetsAt).getTime();
  const diffMs = resetMs - now;
  if (diffMs <= 0) return 'Resets soon';
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

  const status = utilization === null ? 'unavailable' : utilization >= 90 ? 'degraded' : 'ok';

  return {
    provider: 'claude',
    status,
    source: 'api',
    updated_at: new Date().toISOString(),
    usage:
      utilization !== null
        ? { kind: 'quota', used: Math.round(utilization), limit: 100, percent_used: Math.round(utilization) }
        : null,
    reset_window: primary?.resets_at
      ? { label: formatResetLabel(primary.resets_at), resets_at: primary.resets_at }
      : null,
    error: null,
  };
}

export async function fetchClaudeUsageViaApi(
  dependencies: { credentials?: ClaudeCredentials | null; credentialsPath?: string; fetch?: FetchLike } = {},
): Promise<ProviderSnapshot> {
  const credentials = dependencies.credentials ?? (await readClaudeCredentials(dependencies.credentialsPath));

  if (!credentials) {
    return {
      provider: 'claude',
      status: 'error',
      source: 'api',
      updated_at: new Date().toISOString(),
      usage: null,
      reset_window: null,
      error: {
        code: 'claude_cli_missing',
        message: 'Claude credentials not found at ~/.claude/.credentials.json. Run: claude auth login',
        retryable: false,
      },
    };
  }

  const fetchFn = dependencies.fetch ?? globalThis.fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchFn(USAGE_ENDPOINT, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'anthropic-beta': 'oauth-2025-04-20',
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      return {
        provider: 'claude',
        status: 'error',
        source: 'api',
        updated_at: new Date().toISOString(),
        usage: null,
        reset_window: null,
        error: {
          code: 'claude_auth_expired',
          message: 'Claude login expired. Run: claude auth login',
          retryable: false,
        },
      };
    }

    if (response.status === 429) {
      return {
        provider: 'claude',
        status: 'error',
        source: 'api',
        updated_at: new Date().toISOString(),
        usage: null,
        reset_window: null,
        error: {
          code: 'claude_cli_failed',
          message: 'Claude API rate limited. Data will refresh on next cycle.',
          retryable: true,
        },
      };
    }

    if (!response.ok) {
      return {
        provider: 'claude',
        status: 'error',
        source: 'api',
        updated_at: new Date().toISOString(),
        usage: null,
        reset_window: null,
        error: { code: 'claude_cli_failed', message: `Claude API returned HTTP ${response.status}`, retryable: true },
      };
    }

    const body = (await response.json()) as ClaudeUsageResponse;
    return mapToSnapshot(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      provider: 'claude',
      status: 'error',
      source: 'api',
      updated_at: new Date().toISOString(),
      usage: null,
      reset_window: null,
      error: { code: 'claude_cli_failed', message: `Claude API fetch failed: ${message}`, retryable: true },
    };
  } finally {
    clearTimeout(timeout);
  }
}

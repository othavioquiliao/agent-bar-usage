import type { ProviderSnapshot, ResetWindow, UsageSnapshot } from 'shared-contract';
import { type ClaudeCredentials, readClaudeCredentials } from './claude-credentials.js';

const USAGE_ENDPOINT = 'https://api.anthropic.com/api/oauth/usage';
const REQUEST_TIMEOUT_MS = 10_000;

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface UsageWindow {
  utilization: number | null;
  resets_at: string | null;
}

interface ExtraUsageWindow {
  is_enabled?: boolean;
  monthly_limit?: number | null;
  used_credits?: number | null;
  utilization?: number | null;
}

interface ClaudeUsageResponse {
  five_hour?: UsageWindow | null;
  seven_day?: UsageWindow | null;
  seven_day_sonnet?: UsageWindow | null;
  seven_day_opus?: UsageWindow | null;
  extra_usage?: ExtraUsageWindow | null;
  [key: string]: unknown;
}

type PrimarySource = 'five_hour' | 'seven_day' | 'extra_usage' | 'seven_day_sonnet';

interface PrimaryResolution {
  source: PrimarySource;
  utilization: number;
  resets_at: string | null;
}

function formatResetLabel(resetsAt: string | null): string {
  if (!resetsAt) return 'Unknown reset';
  const now = Date.now();
  const resetMs = new Date(resetsAt).getTime();
  const diffMs = resetMs - now;
  if (diffMs <= 0) return 'Resets soon';
  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  if (days > 0) return `Resets in ${days}d ${hours}h`;
  if (hours > 0) return `Resets in ${hours}h ${minutes}m`;
  return `Resets in ${minutes}m`;
}

function toQuotaSnapshot(utilization: number): UsageSnapshot {
  const rounded = Math.round(utilization);
  return { kind: 'quota', used: rounded, limit: 100, percent_used: rounded };
}

function toResetWindow(resetsAt: string | null): ResetWindow | null {
  return resetsAt ? { label: formatResetLabel(resetsAt), resets_at: resetsAt } : null;
}

function resolvePrimary(response: ClaudeUsageResponse): PrimaryResolution | null {
  const fiveHour = response.five_hour?.utilization ?? null;
  if (fiveHour !== null) {
    return { source: 'five_hour', utilization: fiveHour, resets_at: response.five_hour?.resets_at ?? null };
  }
  const sevenDay = response.seven_day?.utilization ?? null;
  if (sevenDay !== null) {
    return { source: 'seven_day', utilization: sevenDay, resets_at: response.seven_day?.resets_at ?? null };
  }
  const extra = response.extra_usage?.utilization ?? null;
  if (extra !== null) {
    return { source: 'extra_usage', utilization: extra, resets_at: null };
  }
  const sonnet = response.seven_day_sonnet?.utilization ?? null;
  if (sonnet !== null) {
    return {
      source: 'seven_day_sonnet',
      utilization: sonnet,
      resets_at: response.seven_day_sonnet?.resets_at ?? null,
    };
  }
  return null;
}

function mapToSnapshot(response: ClaudeUsageResponse): ProviderSnapshot {
  const primary = resolvePrimary(response);
  const updatedAt = new Date().toISOString();

  if (primary === null) {
    console.error('[agent-bar] claude: all utilization fields null — possible API schema change', response);
    return {
      provider: 'claude',
      status: 'error',
      source: 'api',
      updated_at: updatedAt,
      usage: null,
      reset_window: null,
      error: {
        code: 'claude_usage_transient',
        message: 'Anthropic API returned no usage data (temporary). Data will refresh on next cycle.',
        retryable: true,
      },
    };
  }

  if (primary.source !== 'five_hour') {
    console.warn('[agent-bar] claude: five_hour.utilization null, using fallback', {
      fallback_source: primary.source,
      five_hour: response.five_hour?.utilization ?? null,
      seven_day: response.seven_day?.utilization ?? null,
      extra_usage: response.extra_usage?.utilization ?? null,
      seven_day_sonnet: response.seven_day_sonnet?.utilization ?? null,
    });
  }

  const status: ProviderSnapshot['status'] = primary.utilization >= 90 ? 'degraded' : 'ok';

  // Secondary (7-day) only populated when primary is five_hour, to avoid duplication
  // when the fallback itself was seven_day.
  const includeSecondary = primary.source === 'five_hour';
  const sevenDayUtilization = response.seven_day?.utilization ?? null;
  const secondary_usage: UsageSnapshot | null =
    includeSecondary && sevenDayUtilization !== null ? toQuotaSnapshot(sevenDayUtilization) : null;
  const secondary_reset_window: ResetWindow | null =
    includeSecondary && response.seven_day?.resets_at ? toResetWindow(response.seven_day.resets_at) : null;

  return {
    provider: 'claude',
    status,
    source: 'api',
    updated_at: updatedAt,
    usage: toQuotaSnapshot(primary.utilization),
    reset_window: toResetWindow(primary.resets_at),
    secondary_usage,
    secondary_reset_window,
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

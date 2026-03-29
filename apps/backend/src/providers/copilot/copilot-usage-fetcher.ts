import type { ProviderSnapshot, ProviderSourceMode, ResetWindow, UsageSnapshot } from 'shared-contract';

import {
  createProviderError,
  createUnavailableSnapshot,
  type ProviderAdapterContext,
} from '../../core/provider-adapter.js';
import { normalizeLineEndings, stripAnsi } from '../shared/interactive-command.js';
import { resolveCopilotToken } from './copilot-token-resolver.js';

const COPILOT_ENDPOINT = 'https://api.github.com/copilot_internal/user';
const COPILOT_SOURCE: ProviderSourceMode = 'api';
const REQUEST_TIMEOUT_MS = 15_000;

interface CopilotQuotaSnapshot {
  used?: number | null;
  limit?: number | null;
  percentUsed?: number | null;
  percent_used?: number | null;
  percentRemaining?: number | null;
  percent_remaining?: number | null;
  resetsAt?: string | null;
  resets_at?: string | null;
  resetAt?: string | null;
  reset_at?: string | null;
  label?: string | null;
  name?: string | null;
}

interface CopilotUsageResponse {
  quotaSnapshots?: Record<string, CopilotQuotaSnapshot | null | undefined>;
  quota_snapshots?: Record<string, CopilotQuotaSnapshot | null | undefined>;
}

export async function fetchCopilotUsage(context: ProviderAdapterContext): Promise<ProviderSnapshot> {
  const startedAt = Date.now();
  const updatedAt = context.now().toISOString();
  const source = normalizeSourceMode(context.sourceMode, COPILOT_SOURCE);

  if (source !== COPILOT_SOURCE) {
    return createUnavailableSnapshot(
      context.providerId,
      source,
      updatedAt,
      createProviderError(
        'copilot_source_unsupported',
        'Copilot usage is only available through the API source mode on Ubuntu.',
      ),
    );
  }

  const tokenResolution = resolveCopilotToken(context);
  if (!tokenResolution) {
    return buildErrorSnapshot(
      context,
      source,
      updatedAt,
      'copilot_token_missing',
      'No Copilot token was found in the environment or resolved secret store.',
      false,
      startedAt,
      'copilot.api',
      false,
    );
  }

  try {
    const response = await fetchWithTimeout(COPILOT_ENDPOINT, {
      headers: buildHeaders(tokenResolution.token),
    });

    if (response.status === 401 || response.status === 403) {
      return buildErrorSnapshot(
        context,
        source,
        updatedAt,
        'copilot_auth_failed',
        'Copilot token was rejected by the GitHub API.',
        false,
        startedAt,
        'copilot.api',
        true,
      );
    }

    if (!response.ok) {
      return buildErrorSnapshot(
        context,
        source,
        updatedAt,
        'copilot_fetch_failed',
        `Copilot API returned HTTP ${response.status}.`,
        true,
        startedAt,
        'copilot.api',
        true,
      );
    }

    const rawText = stripAnsi(normalizeLineEndings(await response.text()));
    const payload = tryParseJson(rawText);
    const mapped = mapCopilotUsage(payload, rawText);

    if (!mapped) {
      return buildErrorSnapshot(
        context,
        source,
        updatedAt,
        'copilot_response_invalid',
        'Copilot API payload did not contain quota snapshots.',
        true,
        startedAt,
        'copilot.api',
        true,
      );
    }

    return {
      provider: context.providerId,
      status: 'ok',
      source,
      updated_at: updatedAt,
      usage: mapped.usage,
      reset_window: mapped.resetWindow,
      error: null,
      diagnostics: {
        attempts: [
          {
            strategy: 'copilot.api',
            available: true,
            duration_ms: Date.now() - startedAt,
            error: null,
          },
        ],
      },
    };
  } catch (error) {
    return buildErrorSnapshot(
      context,
      source,
      updatedAt,
      'copilot_fetch_failed',
      error instanceof Error ? error.message : 'Copilot API request failed.',
      true,
      startedAt,
      'copilot.api',
      true,
    );
  }
}

function normalizeSourceMode(sourceMode: ProviderSourceMode, defaultSource: ProviderSourceMode): ProviderSourceMode {
  if (sourceMode === 'auto') {
    return defaultSource;
  }

  return sourceMode;
}

function buildHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/json',
    Authorization: `token ${token}`,
    'Editor-Version': 'vscode/1.96.2',
    'Editor-Plugin-Version': 'copilot-chat/0.26.7',
    'User-Agent': 'GitHubCopilotChat/0.26.7',
    'X-Github-Api-Version': '2025-04-01',
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException('Copilot request timed out', 'AbortError')),
    timeoutMs,
  );

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function mapCopilotUsage(
  payload: unknown,
  rawText: string,
): { usage: UsageSnapshot; resetWindow: ResetWindow | null } | null {
  const snapshotMap = extractQuotaSnapshots(payload);
  const prioritized = snapshotMap.premiumInteractions ?? snapshotMap.chat ?? firstSnapshot(snapshotMap);
  if (!prioritized) {
    return null;
  }

  const usage = buildUsageSnapshot(prioritized.snapshot);
  if (!usage) {
    return null;
  }

  const resetWindow = buildResetWindow(prioritized.key, prioritized.snapshot);
  if (!usage.used && rawText.length === 0) {
    return null;
  }

  return {
    usage,
    resetWindow,
  };
}

function extractQuotaSnapshots(payload: unknown): Record<string, { key: string; snapshot: CopilotQuotaSnapshot }> {
  const record = new Map<string, { key: string; snapshot: CopilotQuotaSnapshot }>();
  if (!payload || typeof payload !== 'object') {
    return Object.fromEntries(record);
  }

  const objectPayload = payload as CopilotUsageResponse & Record<string, unknown>;
  const sources = [objectPayload.quotaSnapshots, objectPayload.quota_snapshots];

  for (const source of sources) {
    if (!source || typeof source !== 'object') {
      continue;
    }

    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') {
        continue;
      }
      record.set(key, { key, snapshot: value as CopilotQuotaSnapshot });
    }
  }

  return Object.fromEntries(record);
}

function firstSnapshot(
  snapshots: Record<string, { key: string; snapshot: CopilotQuotaSnapshot }>,
): { key: string; snapshot: CopilotQuotaSnapshot } | null {
  const first = Object.values(snapshots)[0];
  return first ?? null;
}

function buildUsageSnapshot(snapshot: CopilotQuotaSnapshot): UsageSnapshot | null {
  const percentUsed = normalizePercentUsed(snapshot);
  const used = normalizeUsed(snapshot, percentUsed);
  const limit = normalizeLimit(snapshot, percentUsed);

  if (used == null && limit == null && percentUsed == null) {
    return null;
  }

  return {
    kind: 'quota',
    used,
    limit,
    percent_used: percentUsed,
  };
}

function normalizeUsed(snapshot: CopilotQuotaSnapshot, percentUsed: number | null): number | null {
  if (typeof snapshot.used === 'number') {
    return snapshot.used;
  }

  if (percentUsed == null) {
    return null;
  }

  return percentUsed;
}

function normalizeLimit(snapshot: CopilotQuotaSnapshot, percentUsed: number | null): number | null {
  if (typeof snapshot.limit === 'number') {
    return snapshot.limit;
  }

  if (percentUsed == null) {
    return null;
  }

  return 100;
}

function normalizePercentUsed(snapshot: CopilotQuotaSnapshot): number | null {
  if (typeof snapshot.percentUsed === 'number') {
    return clampPercent(snapshot.percentUsed);
  }

  if (typeof snapshot.percent_used === 'number') {
    return clampPercent(snapshot.percent_used);
  }

  if (typeof snapshot.percentRemaining === 'number') {
    return clampPercent(100 - snapshot.percentRemaining);
  }

  if (typeof snapshot.percent_remaining === 'number') {
    return clampPercent(100 - snapshot.percent_remaining);
  }

  if (typeof snapshot.used === 'number' && typeof snapshot.limit === 'number' && snapshot.limit > 0) {
    return clampPercent((snapshot.used / snapshot.limit) * 100);
  }

  return null;
}

function buildResetWindow(key: string, snapshot: CopilotQuotaSnapshot): ResetWindow | null {
  const resetsAt = snapshot.resetsAt ?? snapshot.resets_at ?? snapshot.resetAt ?? snapshot.reset_at;
  if (!resetsAt || !isValidDatetime(resetsAt)) {
    return null;
  }

  return {
    resets_at: resetsAt,
    label: snapshot.label?.trim() || snapshot.name?.trim() || key,
  };
}

function isValidDatetime(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildErrorSnapshot(
  context: ProviderAdapterContext,
  source: ProviderSourceMode,
  updatedAt: string,
  code: string,
  message: string,
  retryable: boolean,
  startedAt: number,
  strategy: string,
  available: boolean,
): ProviderSnapshot {
  return {
    provider: context.providerId,
    status: 'error',
    source,
    updated_at: updatedAt,
    usage: null,
    reset_window: null,
    error: createProviderError(code, message, retryable),
    diagnostics: {
      attempts: [
        {
          strategy,
          available,
          duration_ms: Date.now() - startedAt,
          error: createProviderError(code, message, retryable),
        },
      ],
    },
  };
}

import { assertProviderId, assertProviderSourceMode, type ProviderId, type ProviderSourceMode } from './request.js';

export const snapshotSchemaVersion = '1' as const;

export const PROVIDER_STATUSES = ['ok', 'degraded', 'error', 'unavailable'] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export interface ProviderError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface UsageSnapshot {
  kind: 'quota';
  used?: number | null;
  limit?: number | null;
  percent_used?: number | null;
}

export interface ResetWindow {
  resets_at: string;
  label: string;
}

export const CONNECTED_ACCOUNT_STATUSES = ['connected', 'missing'] as const;
export type ConnectedAccountStatus = (typeof CONNECTED_ACCOUNT_STATUSES)[number];

export interface ConnectedAccount {
  status: ConnectedAccountStatus;
  label?: string | null;
}

export interface ProviderAttempt {
  strategy: string;
  available: boolean;
  duration_ms?: number;
  error?: ProviderError | null;
}

export interface ProviderDiagnostics {
  attempts: ProviderAttempt[];
}

export interface ProviderSnapshot {
  provider: ProviderId;
  status: ProviderStatus;
  source: ProviderSourceMode;
  updated_at: string;
  connected_account?: ConnectedAccount | null;
  usage?: UsageSnapshot | null;
  reset_window?: ResetWindow | null;
  secondary_usage?: UsageSnapshot | null;
  secondary_reset_window?: ResetWindow | null;
  error: ProviderError | null;
  diagnostics?: ProviderDiagnostics;
}

export interface SnapshotEnvelope {
  schema_version: typeof snapshotSchemaVersion;
  generated_at: string;
  providers: ProviderSnapshot[];
}

const PROVIDER_STATUS_SET = new Set<string>(PROVIDER_STATUSES);
const CONNECTED_ACCOUNT_STATUS_SET = new Set<string>(CONNECTED_ACCOUNT_STATUSES);
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
}

function assertNoExtraKeys(value: Record<string, unknown>, allowedKeys: readonly string[], label: string): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      throw new TypeError(`${label} contains unexpected field: ${key}.`);
    }
  }
}

function assertNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  return value;
}

function assertIsoDatetime(value: unknown, label: string): string {
  const stringValue = assertNonEmptyString(value, label);
  if (!ISO_DATETIME_PATTERN.test(stringValue)) {
    throw new TypeError(`${label} must be an ISO-8601 datetime string.`);
  }
  return stringValue;
}

function assertNonNegativeNumber(value: unknown, label: string, maximum?: number): number {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative number.`);
  }
  if (maximum !== undefined && value > maximum) {
    throw new TypeError(`${label} must be less than or equal to ${maximum}.`);
  }
  return value;
}

export function assertProviderStatus(value: unknown, label = 'status'): ProviderStatus {
  if (typeof value !== 'string' || !PROVIDER_STATUS_SET.has(value)) {
    throw new TypeError(`${label} must be one of: ${PROVIDER_STATUSES.join(', ')}.`);
  }
  return value as ProviderStatus;
}

export function assertProviderError(value: unknown, label = 'error'): ProviderError {
  assertRecord(value, label);
  assertNoExtraKeys(value, ['code', 'message', 'retryable'], label);
  if (typeof value.retryable !== 'boolean') {
    throw new TypeError(`${label}.retryable must be a boolean.`);
  }
  return {
    code: assertNonEmptyString(value.code, `${label}.code`),
    message: assertNonEmptyString(value.message, `${label}.message`),
    retryable: value.retryable,
  };
}

export function assertConnectedAccountStatus(value: unknown, label = 'connected_account.status'): ConnectedAccountStatus {
  if (typeof value !== 'string' || !CONNECTED_ACCOUNT_STATUS_SET.has(value)) {
    throw new TypeError(`${label} must be one of: ${CONNECTED_ACCOUNT_STATUSES.join(', ')}.`);
  }
  return value as ConnectedAccountStatus;
}

function assertConnectedAccount(value: unknown, label = 'connected_account'): ConnectedAccount {
  assertRecord(value, label);
  assertNoExtraKeys(value, ['status', 'label'], label);

  const connectedAccount: ConnectedAccount = {
    status: assertConnectedAccountStatus(value.status, `${label}.status`),
  };

  if (value.label !== undefined) {
    connectedAccount.label = value.label === null ? null : assertNonEmptyString(value.label, `${label}.label`);
  }

  return connectedAccount;
}

function assertUsageSnapshot(value: unknown, label = 'usage'): UsageSnapshot {
  assertRecord(value, label);
  assertNoExtraKeys(value, ['kind', 'used', 'limit', 'percent_used'], label);
  if (value.kind !== 'quota') {
    throw new TypeError(`${label}.kind must be 'quota'.`);
  }

  const usage: UsageSnapshot = { kind: 'quota' };

  if (value.used !== undefined) {
    usage.used = value.used === null ? null : assertNonNegativeNumber(value.used, `${label}.used`);
  }
  if (value.limit !== undefined) {
    usage.limit = value.limit === null ? null : assertNonNegativeNumber(value.limit, `${label}.limit`);
  }
  if (value.percent_used !== undefined) {
    usage.percent_used =
      value.percent_used === null ? null : assertNonNegativeNumber(value.percent_used, `${label}.percent_used`, 100);
  }

  return usage;
}

function assertResetWindow(value: unknown, label = 'reset_window'): ResetWindow {
  assertRecord(value, label);
  assertNoExtraKeys(value, ['resets_at', 'label'], label);
  return {
    resets_at: assertIsoDatetime(value.resets_at, `${label}.resets_at`),
    label: assertNonEmptyString(value.label, `${label}.label`),
  };
}

function assertProviderAttempt(value: unknown, label = 'attempt'): ProviderAttempt {
  assertRecord(value, label);
  assertNoExtraKeys(value, ['strategy', 'available', 'duration_ms', 'error'], label);
  if (typeof value.available !== 'boolean') {
    throw new TypeError(`${label}.available must be a boolean.`);
  }

  const attempt: ProviderAttempt = {
    strategy: assertNonEmptyString(value.strategy, `${label}.strategy`),
    available: value.available,
  };

  if (value.duration_ms !== undefined) {
    attempt.duration_ms = assertNonNegativeNumber(value.duration_ms, `${label}.duration_ms`);
  }

  if (value.error !== undefined) {
    attempt.error = value.error === null ? null : assertProviderError(value.error, `${label}.error`);
  }

  return attempt;
}

function assertProviderDiagnostics(value: unknown, label = 'diagnostics'): ProviderDiagnostics {
  assertRecord(value, label);
  assertNoExtraKeys(value, ['attempts'], label);
  if (value.attempts !== undefined && !Array.isArray(value.attempts)) {
    throw new TypeError(`${label}.attempts must be an array.`);
  }
  return {
    attempts: (value.attempts ?? []).map((attempt, index) =>
      assertProviderAttempt(attempt, `${label}.attempts[${index}]`),
    ),
  };
}

export function assertProviderSnapshot(value: unknown, label = 'provider'): ProviderSnapshot {
  assertRecord(value, label);
  assertNoExtraKeys(
    value,
    [
      'provider',
      'status',
      'source',
      'updated_at',
      'connected_account',
      'usage',
      'reset_window',
      'secondary_usage',
      'secondary_reset_window',
      'error',
      'diagnostics',
    ],
    label,
  );

  if (!Object.hasOwn(value, 'error')) {
    throw new TypeError(`${label}.error is required.`);
  }

  return {
    provider: assertProviderId(value.provider, `${label}.provider`),
    status: assertProviderStatus(value.status, `${label}.status`),
    source: assertProviderSourceMode(value.source, `${label}.source`),
    updated_at: assertIsoDatetime(value.updated_at, `${label}.updated_at`),
    ...(value.connected_account !== undefined
      ? {
          connected_account:
            value.connected_account === null
              ? null
              : assertConnectedAccount(value.connected_account, `${label}.connected_account`),
        }
      : {}),
    ...(value.usage !== undefined
      ? { usage: value.usage === null ? null : assertUsageSnapshot(value.usage, `${label}.usage`) }
      : {}),
    ...(value.reset_window !== undefined
      ? {
          reset_window:
            value.reset_window === null ? null : assertResetWindow(value.reset_window, `${label}.reset_window`),
        }
      : {}),
    ...(value.secondary_usage !== undefined
      ? {
          secondary_usage:
            value.secondary_usage === null
              ? null
              : assertUsageSnapshot(value.secondary_usage, `${label}.secondary_usage`),
        }
      : {}),
    ...(value.secondary_reset_window !== undefined
      ? {
          secondary_reset_window:
            value.secondary_reset_window === null
              ? null
              : assertResetWindow(value.secondary_reset_window, `${label}.secondary_reset_window`),
        }
      : {}),
    error: value.error === null ? null : assertProviderError(value.error, `${label}.error`),
    ...(value.diagnostics !== undefined
      ? { diagnostics: assertProviderDiagnostics(value.diagnostics, `${label}.diagnostics`) }
      : {}),
  };
}

export function assertSnapshotEnvelope(value: unknown): SnapshotEnvelope {
  assertRecord(value, 'Snapshot envelope');
  assertNoExtraKeys(value, ['schema_version', 'generated_at', 'providers'], 'Snapshot envelope');

  if (value.schema_version !== snapshotSchemaVersion) {
    throw new TypeError(`schema_version must be '${snapshotSchemaVersion}'.`);
  }
  if (!Array.isArray(value.providers)) {
    throw new TypeError('providers must be an array.');
  }

  return {
    schema_version: snapshotSchemaVersion,
    generated_at: assertIsoDatetime(value.generated_at, 'generated_at'),
    providers: value.providers.map((provider, index) => assertProviderSnapshot(provider, `providers[${index}]`)),
  };
}

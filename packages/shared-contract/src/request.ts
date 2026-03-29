export const PROVIDER_IDS = ['copilot', 'codex', 'claude'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PROVIDER_SOURCE_MODES = ['auto', 'cli', 'oauth', 'api', 'web'] as const;
export type ProviderSourceMode = (typeof PROVIDER_SOURCE_MODES)[number];

const PROVIDER_ID_SET = new Set<string>(PROVIDER_IDS);
const PROVIDER_SOURCE_MODE_SET = new Set<string>(PROVIDER_SOURCE_MODES);

export interface BackendUsageRequest {
  providers: ProviderId[];
  source_mode_override: ProviderSourceMode;
  force_refresh: boolean;
  include_diagnostics: boolean;
  ttl_seconds: number;
}

export type RefreshRequest = BackendUsageRequest;

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

function coercePositiveInteger(value: unknown, label: string): number {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value)
        : Number.NaN;

  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw new TypeError(`${label} must be a positive integer.`);
  }

  return numericValue;
}

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && PROVIDER_ID_SET.has(value);
}

export function assertProviderId(value: unknown, label = 'provider'): ProviderId {
  if (!isProviderId(value)) {
    throw new TypeError(`${label} must be one of: ${PROVIDER_IDS.join(', ')}.`);
  }

  return value;
}

export function isProviderSourceMode(value: unknown): value is ProviderSourceMode {
  return typeof value === 'string' && PROVIDER_SOURCE_MODE_SET.has(value);
}

export function assertProviderSourceMode(value: unknown, label = 'source_mode_override'): ProviderSourceMode {
  if (!isProviderSourceMode(value)) {
    throw new TypeError(`${label} must be one of: ${PROVIDER_SOURCE_MODES.join(', ')}.`);
  }

  return value;
}

export function assertBackendUsageRequest(value: unknown): BackendUsageRequest {
  assertRecord(value, 'Backend usage request');
  assertNoExtraKeys(
    value,
    ['providers', 'source_mode_override', 'force_refresh', 'include_diagnostics', 'ttl_seconds'],
    'Backend usage request',
  );

  const providers = value.providers;
  const normalizedProviders =
    providers === undefined
      ? []
      : Array.isArray(providers)
        ? providers.map((provider, index) => assertProviderId(provider, `providers[${index}]`))
        : (() => {
            throw new TypeError('providers must be an array.');
          })();

  const sourceMode =
    value.source_mode_override === undefined ? 'auto' : assertProviderSourceMode(value.source_mode_override);

  if (value.force_refresh !== undefined && typeof value.force_refresh !== 'boolean') {
    throw new TypeError('force_refresh must be a boolean.');
  }

  if (value.include_diagnostics !== undefined && typeof value.include_diagnostics !== 'boolean') {
    throw new TypeError('include_diagnostics must be a boolean.');
  }

  const ttlSeconds = value.ttl_seconds === undefined ? 30 : coercePositiveInteger(value.ttl_seconds, 'ttl_seconds');

  return {
    providers: normalizedProviders,
    source_mode_override: sourceMode,
    force_refresh: value.force_refresh ?? false,
    include_diagnostics: value.include_diagnostics ?? false,
    ttl_seconds: ttlSeconds,
  };
}

export function assertRefreshRequest(value: unknown): RefreshRequest {
  return assertBackendUsageRequest(value);
}

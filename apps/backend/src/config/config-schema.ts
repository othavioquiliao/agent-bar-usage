import { assertProviderId, assertProviderSourceMode, type ProviderId, type ProviderSourceMode } from 'shared-contract';

export const SECRET_STORES = ['secret-tool', 'env'] as const;
export type SecretStore = (typeof SECRET_STORES)[number];

const SECRET_STORE_SET = new Set<string>(SECRET_STORES);

export interface ConfigSecretReference {
  store: SecretStore;
  service?: string;
  account?: string;
  env?: string;
}

export interface ProviderConfig {
  id: ProviderId;
  enabled: boolean;
  sourceMode: ProviderSourceMode;
  secretRef?: ConfigSecretReference;
}

export interface BackendConfig {
  schemaVersion: number;
  defaults: {
    ttlSeconds: number;
  };
  providers: ProviderConfig[];
}

export interface SanitizedSecretReference {
  store: SecretStore;
  configured: true;
}

export interface SanitizedProviderConfig {
  id: ProviderConfig['id'];
  enabled: boolean;
  sourceMode: ProviderConfig['sourceMode'];
  secretRef: SanitizedSecretReference | null;
}

export interface SanitizedBackendConfig {
  schemaVersion: number;
  defaults: {
    ttlSeconds: number;
  };
  providers: SanitizedProviderConfig[];
}

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

function assertNonEmptyTrimmedString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function assertPositiveInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer.`);
  }
  return value;
}

function assertSecretStore(value: unknown, label = 'store'): SecretStore {
  if (typeof value !== 'string' || !SECRET_STORE_SET.has(value)) {
    throw new TypeError(`${label} must be one of: ${SECRET_STORES.join(', ')}.`);
  }
  return value as SecretStore;
}

function assertConfigSecretReference(value: unknown, label = 'secretRef'): ConfigSecretReference {
  assertRecord(value, label);
  assertNoExtraKeys(value, ['store', 'service', 'account', 'env'], label);

  return {
    store: value.store === undefined ? 'secret-tool' : assertSecretStore(value.store, `${label}.store`),
    ...(value.service !== undefined ? { service: assertNonEmptyTrimmedString(value.service, `${label}.service`) } : {}),
    ...(value.account !== undefined ? { account: assertNonEmptyTrimmedString(value.account, `${label}.account`) } : {}),
    ...(value.env !== undefined ? { env: assertNonEmptyTrimmedString(value.env, `${label}.env`) } : {}),
  };
}

function assertProviderConfig(value: unknown, label = 'provider'): ProviderConfig {
  assertRecord(value, label);
  assertNoExtraKeys(value, ['id', 'enabled', 'sourceMode', 'secretRef'], label);

  if (value.enabled !== undefined && typeof value.enabled !== 'boolean') {
    throw new TypeError(`${label}.enabled must be a boolean.`);
  }

  return {
    id: assertProviderId(value.id, `${label}.id`),
    enabled: value.enabled ?? true,
    sourceMode:
      value.sourceMode === undefined ? 'auto' : assertProviderSourceMode(value.sourceMode, `${label}.sourceMode`),
    ...(value.secretRef !== undefined
      ? { secretRef: assertConfigSecretReference(value.secretRef, `${label}.secretRef`) }
      : {}),
  };
}

export function assertBackendConfig(value: unknown): BackendConfig {
  assertRecord(value, 'Backend config');
  assertNoExtraKeys(value, ['schemaVersion', 'defaults', 'providers'], 'Backend config');

  const schemaVersion = value.schemaVersion ?? 1;
  if (schemaVersion !== 1) {
    throw new TypeError('schemaVersion must be 1.');
  }

  let ttlSeconds = 150;
  if (value.defaults !== undefined) {
    assertRecord(value.defaults, 'defaults');
    assertNoExtraKeys(value.defaults, ['ttlSeconds'], 'defaults');
    ttlSeconds =
      value.defaults.ttlSeconds === undefined
        ? 150
        : assertPositiveInteger(value.defaults.ttlSeconds, 'defaults.ttlSeconds');
  }

  if (value.providers !== undefined && !Array.isArray(value.providers)) {
    throw new TypeError('providers must be an array.');
  }

  return {
    schemaVersion: 1,
    defaults: {
      ttlSeconds,
    },
    providers: (value.providers ?? []).map((provider, index) => assertProviderConfig(provider, `providers[${index}]`)),
  };
}

export function sanitizeBackendConfig(config: BackendConfig): SanitizedBackendConfig {
  return {
    schemaVersion: config.schemaVersion,
    defaults: {
      ttlSeconds: config.defaults.ttlSeconds,
    },
    providers: config.providers.map((provider) => ({
      id: provider.id,
      enabled: provider.enabled,
      sourceMode: provider.sourceMode,
      secretRef: provider.secretRef
        ? {
            store: provider.secretRef.store,
            configured: true,
          }
        : null,
    })),
  };
}

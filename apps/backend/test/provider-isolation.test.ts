import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { ProviderId, ProviderSnapshot } from 'shared-contract';
import { describe, expect, it } from 'vitest';

import { SnapshotCache } from '../src/cache/snapshot-cache.js';
import { normalizeBackendRequest } from '../src/config/backend-request.js';
import type { BackendConfig } from '../src/config/config-schema.js';
import { BackendCoordinator } from '../src/core/backend-coordinator.js';
import type { ProviderAdapter, ProviderAdapterContext } from '../src/core/provider-adapter.js';
import { ProviderRegistry } from '../src/core/provider-registry.js';
import { EnvSecretStore } from '../src/secrets/env-secret-store.js';
import { SecretResolver } from '../src/secrets/secret-store.js';
import { serializeSnapshotEnvelope } from '../src/serializers/snapshot-serializer.js';

describe('provider isolation', () => {
  it('keeps the full envelope when availability checks fail for one provider', async () => {
    const codex = createThrowingAvailabilityAdapter('codex');
    const claude = createCaptureAdapter('claude', 'cli');
    const secretValue = 'secret-value-123';
    const coordinator = new BackendCoordinator({
      cache: createTestSnapshotCache(),
      registry: new ProviderRegistry([codex.adapter, claude.adapter]),
      config: createBackendConfig(['codex', 'claude']),
      secretResolver: new SecretResolver([
        new EnvSecretStore({
          env: {
            CLAUDE_TOKEN: secretValue,
          },
        }),
      ]),
    });

    const envelope = await coordinator.getSnapshot(
      normalizeBackendRequest({
        ttl_seconds: 30,
      }),
    );
    const serialized = serializeSnapshotEnvelope(envelope, {
      includeDiagnostics: false,
    });
    const serializedJson = JSON.stringify(serialized);

    expect(envelope.providers).toHaveLength(2);
    expect(envelope.providers[0]?.provider).toBe('codex');
    expect(envelope.providers[0]?.status).toBe('error');
    expect(envelope.providers[0]?.error?.code).toBe('provider_availability_failed');
    expect(envelope.providers[1]?.provider).toBe('claude');
    expect(envelope.providers[1]?.status).toBe('ok');
    expect(claude.lastContext()?.secrets?.primary).toBe(secretValue);
    expect(serializedJson).not.toContain(secretValue);
  });

  it('keeps the full envelope when one provider throws during fetch', async () => {
    const codex = createThrowingFetchAdapter('codex');
    const claude = createCaptureAdapter('claude', 'cli');
    const coordinator = new BackendCoordinator({
      cache: createTestSnapshotCache(),
      registry: new ProviderRegistry([codex.adapter, claude.adapter]),
      config: createBackendConfig(['codex', 'claude']),
      secretResolver: new SecretResolver([
        new EnvSecretStore({
          env: {
            CLAUDE_TOKEN: 'secret-value-123',
          },
        }),
      ]),
    });

    const envelope = await coordinator.getSnapshot(
      normalizeBackendRequest({
        ttl_seconds: 30,
      }),
    );

    expect(envelope.providers).toHaveLength(2);
    expect(envelope.providers[0]?.provider).toBe('codex');
    expect(envelope.providers[0]?.status).toBe('error');
    expect(envelope.providers[0]?.error?.code).toBe('provider_fetch_failed');
    expect(envelope.providers[1]?.provider).toBe('claude');
    expect(envelope.providers[1]?.status).toBe('ok');
  });
});

function createThrowingAvailabilityAdapter(providerId: ProviderId): {
  adapter: ProviderAdapter;
} {
  return {
    adapter: {
      id: providerId,
      name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
      cacheKey: `${providerId}-quota`,
      defaultSourceMode: 'cli',
      async isAvailable() {
        throw new Error(`${providerId} availability exploded`);
      },
      async getQuota() {
        throw new Error('fetch should not be called');
      },
    },
  };
}

function createThrowingFetchAdapter(providerId: ProviderId): {
  adapter: ProviderAdapter;
} {
  return {
    adapter: {
      id: providerId,
      name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
      cacheKey: `${providerId}-quota`,
      defaultSourceMode: 'cli',
      async isAvailable() {
        return true;
      },
      async getQuota() {
        throw new Error(`${providerId} fetch exploded`);
      },
    },
  };
}

function createCaptureAdapter(
  providerId: ProviderId,
  defaultSourceMode: ProviderSnapshot['source'],
): {
  adapter: ProviderAdapter;
  lastContext: () => ProviderAdapterContext | null;
} {
  let lastContext: ProviderAdapterContext | null = null;

  return {
    adapter: {
      id: providerId,
      name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
      cacheKey: `${providerId}-quota`,
      defaultSourceMode,
      async isAvailable() {
        return true;
      },
      async getQuota(context) {
        lastContext = context;
        return {
          provider: providerId,
          status: 'ok',
          source: context.sourceMode,
          updated_at: context.now().toISOString(),
          usage: {
            kind: 'quota',
            used: 10,
            limit: 100,
            percent_used: 10,
          },
          reset_window: null,
          error: null,
        };
      },
    },
    lastContext: () => lastContext,
  };
}

function createBackendConfig(providerOrder: ProviderId[]): BackendConfig {
  return {
    schemaVersion: 1,
    defaults: {
      ttlSeconds: 30,
    },
    providers: providerOrder.map((providerId) => ({
      id: providerId,
      enabled: true,
      sourceMode: 'cli',
      secretRef:
        providerId === 'claude'
          ? {
              store: 'env',
              env: 'CLAUDE_TOKEN',
            }
          : undefined,
    })),
  };
}

function createTestSnapshotCache(): SnapshotCache {
  return new SnapshotCache({
    cacheDir: mkdtempSync(path.join(tmpdir(), 'agent-bar-provider-isolation-')),
  });
}

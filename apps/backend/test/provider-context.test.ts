import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { ProviderId, ProviderSnapshot } from 'shared-contract';
import { describe, expect, it } from 'vitest';

import { SnapshotCache } from '../src/cache/snapshot-cache.js';
import { normalizeBackendRequest } from '../src/config/backend-request.js';
import { BackendCoordinator } from '../src/core/backend-coordinator.js';
import type { ProviderAdapter, ProviderAdapterContext } from '../src/core/provider-adapter.js';
import { ProviderRegistry } from '../src/core/provider-registry.js';
import { EnvSecretStore } from '../src/secrets/env-secret-store.js';
import { SecretResolver } from '../src/secrets/secret-store.js';
import { serializeSnapshotEnvelope } from '../src/serializers/snapshot-serializer.js';

describe('provider context integration', () => {
  it('preserves config-defined provider order', async () => {
    const codex = createCaptureAdapter('codex', 'cli');
    const claude = createCaptureAdapter('claude', 'cli');
    const coordinator = new BackendCoordinator({
      cache: createTestSnapshotCache(),
      registry: new ProviderRegistry([codex.adapter, claude.adapter]),
      config: {
        schemaVersion: 1,
        defaults: {
          ttlSeconds: 30,
        },
        providers: [
          { id: 'claude', enabled: true, sourceMode: 'cli' },
          { id: 'codex', enabled: true, sourceMode: 'cli' },
        ],
      },
    });

    const envelope = await coordinator.getSnapshot(
      normalizeBackendRequest({
        ttl_seconds: 30,
      }),
    );

    expect(envelope.providers.map((provider) => provider.provider)).toEqual(['claude', 'codex']);
  });

  it('skips disabled providers unless explicitly requested', async () => {
    const codex = createCaptureAdapter('codex', 'cli');
    const claude = createCaptureAdapter('claude', 'cli');
    const coordinator = new BackendCoordinator({
      cache: createTestSnapshotCache(),
      registry: new ProviderRegistry([codex.adapter, claude.adapter]),
      config: {
        schemaVersion: 1,
        defaults: {
          ttlSeconds: 30,
        },
        providers: [
          { id: 'codex', enabled: false, sourceMode: 'cli' },
          { id: 'claude', enabled: true, sourceMode: 'cli' },
        ],
      },
    });

    const defaultEnvelope = await coordinator.getSnapshot(
      normalizeBackendRequest({
        ttl_seconds: 30,
      }),
    );
    const explicitEnvelope = await coordinator.getSnapshot(
      normalizeBackendRequest({
        providers: ['codex'],
        ttl_seconds: 30,
      }),
    );

    expect(defaultEnvelope.providers.map((provider) => provider.provider)).toEqual(['claude']);
    expect(explicitEnvelope.providers.map((provider) => provider.provider)).toEqual(['codex']);
  });

  it('applies source-mode precedence: request override beats config', async () => {
    const codex = createCaptureAdapter('codex', 'cli');
    const coordinator = new BackendCoordinator({
      cache: createTestSnapshotCache(),
      registry: new ProviderRegistry([codex.adapter]),
      config: {
        schemaVersion: 1,
        defaults: {
          ttlSeconds: 30,
        },
        providers: [{ id: 'codex', enabled: true, sourceMode: 'api' }],
      },
    });

    const configEnvelope = await coordinator.getSnapshot(
      normalizeBackendRequest({
        providers: ['codex'],
      }),
    );
    const requestOverrideEnvelope = await coordinator.getSnapshot(
      normalizeBackendRequest({
        providers: ['codex'],
        source_mode_override: 'oauth',
        force_refresh: true,
      }),
    );

    expect(configEnvelope.providers[0]?.source).toBe('api');
    expect(requestOverrideEnvelope.providers[0]?.source).toBe('oauth');
  });

  it('injects resolved secret material into adapter context without leaking to snapshots', async () => {
    const codex = createCaptureAdapter('codex', 'cli');
    const coordinator = new BackendCoordinator({
      cache: createTestSnapshotCache(),
      registry: new ProviderRegistry([codex.adapter]),
      config: {
        schemaVersion: 1,
        defaults: {
          ttlSeconds: 30,
        },
        providers: [
          {
            id: 'codex',
            enabled: true,
            sourceMode: 'cli',
            secretRef: {
              store: 'env',
              env: 'CODEX_TOKEN',
            },
          },
        ],
      },
      secretResolver: new SecretResolver([
        new EnvSecretStore({
          env: {
            CODEX_TOKEN: 'secret-value-123',
          },
        }),
      ]),
    });

    const envelope = await coordinator.getSnapshot(
      normalizeBackendRequest({
        providers: ['codex'],
      }),
    );
    const serialized = serializeSnapshotEnvelope(envelope, {
      includeDiagnostics: false,
    });
    const serializedJson = JSON.stringify(serialized);

    expect(codex.lastContext()?.secrets?.primary).toBe('secret-value-123');
    expect(serializedJson).not.toContain('secret-value-123');
  });

  it('keeps provider failures isolated when a secret is missing', async () => {
    const codex = createCaptureAdapter('codex', 'cli');
    const claude = createCaptureAdapter('claude', 'cli');
    const coordinator = new BackendCoordinator({
      cache: createTestSnapshotCache(),
      registry: new ProviderRegistry([codex.adapter, claude.adapter]),
      config: {
        schemaVersion: 1,
        defaults: {
          ttlSeconds: 30,
        },
        providers: [
          {
            id: 'codex',
            enabled: true,
            sourceMode: 'cli',
            secretRef: {
              store: 'env',
              env: 'MISSING_CODEX_SECRET',
            },
          },
          {
            id: 'claude',
            enabled: true,
            sourceMode: 'cli',
          },
        ],
      },
      secretResolver: new SecretResolver([
        new EnvSecretStore({
          env: {},
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
    expect(envelope.providers[0]?.error?.code).toBe('secret_not_found');
    expect(envelope.providers[1]?.provider).toBe('claude');
    expect(envelope.providers[1]?.status).toBe('ok');
    expect(codex.fetchCount()).toBe(0);
    expect(claude.fetchCount()).toBe(1);
  });
});

function createCaptureAdapter(
  providerId: ProviderId,
  defaultSourceMode: ProviderSnapshot['source'],
): {
  adapter: ProviderAdapter;
  lastContext: () => ProviderAdapterContext | null;
  fetchCount: () => number;
} {
  let fetchCount = 0;
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
        fetchCount += 1;
        lastContext = context;

        return {
          provider: providerId,
          status: 'ok',
          source: context.sourceMode,
          updated_at: context.now().toISOString(),
          usage: {
            kind: 'quota',
            used: fetchCount,
            limit: 100,
            percent_used: fetchCount,
          },
          reset_window: null,
          error: null,
        };
      },
    },
    lastContext: () => lastContext,
    fetchCount: () => fetchCount,
  };
}

function createTestSnapshotCache(): SnapshotCache {
  return new SnapshotCache({
    cacheDir: mkdtempSync(path.join(tmpdir(), 'agent-bar-provider-context-')),
  });
}

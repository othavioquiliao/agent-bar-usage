import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { ProviderId, ProviderSnapshot } from 'shared-contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SnapshotCache } from '../src/cache/snapshot-cache.js';
import { normalizeBackendRequest } from '../src/config/backend-request.js';
import type { BackendConfig } from '../src/config/config-schema.js';
import { BackendCoordinator } from '../src/core/backend-coordinator.js';
import type { ProviderAdapter, ProviderAdapterContext } from '../src/core/provider-adapter.js';
import { ProviderRegistry } from '../src/core/provider-registry.js';

describe('coordinator per-provider timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('produces an error snapshot when a provider hangs past PROVIDER_TIMEOUT_MS', async () => {
    const hanging = createHangingAdapter('codex');
    const coordinator = new BackendCoordinator({
      cache: createTestSnapshotCache(),
      registry: new ProviderRegistry([hanging.adapter]),
      config: createBackendConfig(['codex']),
    });

    const snapshotPromise = coordinator.getSnapshot(
      normalizeBackendRequest({ ttl_seconds: 30 }),
    );

    // Advance past 15s timeout
    await vi.advanceTimersByTimeAsync(16_000);

    const envelope = await snapshotPromise;

    expect(envelope.providers).toHaveLength(1);
    expect(envelope.providers[0]?.provider).toBe('codex');
    expect(envelope.providers[0]?.status).toBe('error');
    expect(envelope.providers[0]?.error?.message).toContain('timed out');
  });

  it('returns a normal snapshot when a provider responds within the timeout', async () => {
    const fast = createFastAdapter('claude');
    const coordinator = new BackendCoordinator({
      cache: createTestSnapshotCache(),
      registry: new ProviderRegistry([fast.adapter]),
      config: createBackendConfig(['claude']),
    });

    const snapshotPromise = coordinator.getSnapshot(
      normalizeBackendRequest({ ttl_seconds: 30 }),
    );

    // Advance a small amount so microtasks resolve
    await vi.advanceTimersByTimeAsync(100);

    const envelope = await snapshotPromise;

    expect(envelope.providers).toHaveLength(1);
    expect(envelope.providers[0]?.provider).toBe('claude');
    expect(envelope.providers[0]?.status).toBe('ok');
    expect(envelope.providers[0]?.error).toBeNull();
  });

  it('does not block other providers when one hangs', async () => {
    const hanging = createHangingAdapter('codex');
    const fast = createFastAdapter('claude');
    const coordinator = new BackendCoordinator({
      cache: createTestSnapshotCache(),
      registry: new ProviderRegistry([hanging.adapter, fast.adapter]),
      config: createBackendConfig(['codex', 'claude']),
    });

    const snapshotPromise = coordinator.getSnapshot(
      normalizeBackendRequest({ ttl_seconds: 30 }),
    );

    // Advance past timeout so hanging provider times out
    await vi.advanceTimersByTimeAsync(16_000);

    const envelope = await snapshotPromise;

    expect(envelope.providers).toHaveLength(2);

    const codexSnapshot = envelope.providers.find((p) => p.provider === 'codex');
    const claudeSnapshot = envelope.providers.find((p) => p.provider === 'claude');

    expect(codexSnapshot?.status).toBe('error');
    expect(codexSnapshot?.error?.message).toContain('timed out');
    expect(claudeSnapshot?.status).toBe('ok');
    expect(claudeSnapshot?.error).toBeNull();
  });
});

function createHangingAdapter(providerId: ProviderId): {
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
      getQuota() {
        // Returns a promise that never resolves — simulates a hanging provider
        return new Promise<ProviderSnapshot>(() => {});
      },
    },
  };
}

function createFastAdapter(providerId: ProviderId): {
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
      async getQuota(context: ProviderAdapterContext) {
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
    })),
  };
}

function createTestSnapshotCache(): SnapshotCache {
  return new SnapshotCache({
    cacheDir: mkdtempSync(path.join(tmpdir(), 'agent-bar-coordinator-timeout-')),
  });
}

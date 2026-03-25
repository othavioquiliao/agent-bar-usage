import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProviderId, ProviderSnapshot } from "shared-contract";

import { SnapshotCache } from "../src/cache/snapshot-cache.js";
import { normalizeBackendRequest } from "../src/config/backend-request.js";
import type { BackendConfig } from "../src/config/config-schema.js";
import { BackendCoordinator } from "../src/core/backend-coordinator.js";
import type { ProviderAdapter } from "../src/core/provider-adapter.js";
import { ProviderRegistry } from "../src/core/provider-registry.js";

describe("BackendCoordinator cache refresh behavior", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reuses cached data for a single provider within ttl_seconds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T15:00:00Z"));

    const codex = createStubAdapter("codex");
    const coordinator = new BackendCoordinator({
      registry: new ProviderRegistry([codex.adapter]),
      cache: new SnapshotCache(),
      config: createBackendConfig(["codex"]),
    });
    const request = normalizeBackendRequest({
      providers: ["codex"],
      ttl_seconds: 30,
    });

    const first = await coordinator.getSnapshot(request);
    vi.setSystemTime(new Date("2026-03-25T15:00:10Z"));
    const second = await coordinator.getSnapshot(request);
    vi.setSystemTime(new Date("2026-03-25T15:00:11Z"));
    const forcedRefresh = await coordinator.getSnapshot({
      ...request,
      forceRefresh: true,
    });

    expect(codex.fetchCount()).toBe(2);
    expect(second.providers).toHaveLength(1);
    expect(second.providers[0]?.provider).toBe("codex");
    expect(second.providers[0]?.updated_at).toBe(first.providers[0]?.updated_at);
    expect(second.generated_at).toBe(first.generated_at);
    expect(forcedRefresh.generated_at > second.generated_at).toBe(true);
    expect(forcedRefresh.providers[0]?.updated_at > second.providers[0]?.updated_at).toBe(true);
  });

  it("reuses cache for all providers and bypasses it on force_refresh", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T16:00:00Z"));

    const codex = createStubAdapter("codex");
    const claude = createStubAdapter("claude");
    const coordinator = new BackendCoordinator({
      registry: new ProviderRegistry([codex.adapter, claude.adapter]),
      cache: new SnapshotCache(),
      config: createBackendConfig(["codex", "claude"]),
    });
    const request = normalizeBackendRequest({
      ttl_seconds: 30,
    });

    const first = await coordinator.getSnapshot(request);
    vi.setSystemTime(new Date("2026-03-25T16:00:05Z"));
    const second = await coordinator.getSnapshot(request);
    vi.setSystemTime(new Date("2026-03-25T16:00:07Z"));
    const forcedRefresh = await coordinator.getSnapshot({
      ...request,
      forceRefresh: true,
    });

    expect(first.providers).toHaveLength(2);
    expect(second.providers).toHaveLength(2);
    expect(codex.fetchCount()).toBe(2);
    expect(claude.fetchCount()).toBe(2);
    expect(second.providers[0]?.updated_at).toBe(first.providers[0]?.updated_at);
    expect(second.providers[1]?.updated_at).toBe(first.providers[1]?.updated_at);
    expect(second.generated_at).toBe(first.generated_at);
    expect(forcedRefresh.generated_at > second.generated_at).toBe(true);
    expect(forcedRefresh.providers[0]?.updated_at > second.providers[0]?.updated_at).toBe(true);
    expect(forcedRefresh.providers[1]?.updated_at > second.providers[1]?.updated_at).toBe(true);
  });
});

function createStubAdapter(providerId: ProviderId): {
  adapter: ProviderAdapter;
  fetchCount: () => number;
} {
  let fetchCount = 0;

  return {
    adapter: {
      id: providerId,
      defaultSourceMode: "cli",
      async isAvailable() {
        return true;
      },
      async fetch(context) {
        fetchCount += 1;

        return createSnapshot({
          provider: providerId,
          source: context.sourceMode,
          updated_at: context.now().toISOString(),
          used: fetchCount,
        });
      },
    },
    fetchCount: () => fetchCount,
  };
}

function createSnapshot(input: {
  provider: ProviderId;
  source: ProviderSnapshot["source"];
  updated_at: string;
  used: number;
}): ProviderSnapshot {
  return {
    provider: input.provider,
    status: "ok",
    source: input.source,
    updated_at: input.updated_at,
    usage: {
      kind: "quota",
      used: input.used,
      limit: 100,
      percent_used: input.used,
    },
    reset_window: null,
    error: null,
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
      sourceMode: "cli",
    })),
  };
}

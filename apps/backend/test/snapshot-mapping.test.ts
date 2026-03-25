import { describe, expect, it } from "vitest";
import type { ProviderId, ProviderSnapshot } from "shared-contract";

import { normalizeBackendRequest } from "../src/config/backend-request.js";
import { BackendCoordinator } from "../src/core/backend-coordinator.js";
import type { ProviderAdapter } from "../src/core/provider-adapter.js";
import { ProviderRegistry } from "../src/core/provider-registry.js";
import { serializeSnapshotEnvelope } from "../src/serializers/snapshot-serializer.js";

describe("snapshot mapping", () => {
  it("fills source and updated_at when adapter omits them", async () => {
    const now = () => new Date("2026-03-25T17:00:00Z");
    const adapter: ProviderAdapter = {
      id: "codex",
      defaultSourceMode: "cli",
      async isAvailable() {
        return true;
      },
      async fetch() {
        return {
          provider: "codex",
          status: "ok",
          usage: {
            kind: "quota",
            used: 10,
            limit: 100,
            percent_used: 10,
          },
          reset_window: null,
          error: null,
        } as unknown as ProviderSnapshot;
      },
    };

    const coordinator = new BackendCoordinator({
      registry: new ProviderRegistry([adapter]),
      now,
    });
    const request = normalizeBackendRequest({
      providers: ["codex"],
      source_mode_override: "api",
    });
    const envelope = await coordinator.getSnapshot(request);

    expect(envelope.providers[0]?.provider).toBe("codex");
    expect(envelope.providers[0]?.source).toBe("api");
    expect(envelope.providers[0]?.updated_at).toBe("2026-03-25T17:00:00.000Z");
  });

  it("maps adapter failures to structured provider errors", async () => {
    const now = () => new Date("2026-03-25T17:30:00Z");
    const adapter: ProviderAdapter = {
      id: "claude",
      defaultSourceMode: "cli",
      async isAvailable() {
        return true;
      },
      async fetch() {
        throw new Error("adapter exploded");
      },
    };

    const coordinator = new BackendCoordinator({
      registry: new ProviderRegistry([adapter]),
      now,
    });
    const request = normalizeBackendRequest({
      providers: ["claude"],
    });
    const envelope = await coordinator.getSnapshot(request);

    expect(envelope.providers[0]?.status).toBe("error");
    expect(envelope.providers[0]?.source).toBe("cli");
    expect(envelope.providers[0]?.updated_at).toBe("2026-03-25T17:30:00.000Z");
    expect(envelope.providers[0]?.error?.code).toBe("provider_fetch_failed");
    expect(envelope.providers[0]?.error?.message).toContain("adapter exploded");
  });

  it("keeps diagnostics optional via serializer options", async () => {
    const adapter: ProviderAdapter = {
      id: "copilot",
      defaultSourceMode: "api",
      async isAvailable() {
        return true;
      },
      async fetch(context) {
        return {
          provider: "copilot",
          status: "ok",
          source: context.sourceMode,
          updated_at: context.now().toISOString(),
          usage: {
            kind: "quota",
            used: 5,
            limit: 100,
            percent_used: 5,
          },
          reset_window: null,
          error: null,
          diagnostics: {
            attempts: [
              {
                strategy: "copilot-api",
                available: true,
                duration_ms: 9,
                error: null,
              },
            ],
          },
        };
      },
    };

    const coordinator = new BackendCoordinator({
      registry: new ProviderRegistry([adapter]),
      now: () => new Date("2026-03-25T18:00:00Z"),
    });
    const request = normalizeBackendRequest({
      providers: ["copilot"],
      include_diagnostics: true,
    });
    const envelope = await coordinator.getSnapshot(request);
    const withoutDiagnostics = serializeSnapshotEnvelope(envelope, {
      includeDiagnostics: false,
    });
    const withDiagnostics = serializeSnapshotEnvelope(envelope, {
      includeDiagnostics: true,
    });

    expect(withoutDiagnostics.providers[0]?.diagnostics).toBeUndefined();
    expect(withDiagnostics.providers[0]?.diagnostics?.attempts.length).toBe(1);
  });
});

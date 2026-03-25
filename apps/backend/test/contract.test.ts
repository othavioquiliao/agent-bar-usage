import { describe, expect, it } from "vitest";

import { backendUsageRequestSchema, snapshotEnvelopeSchema } from "shared-contract";
import type { ProviderAdapter } from "../src/core/provider-adapter.js";
import { ProviderRegistry } from "../src/core/provider-registry.js";
import { runUsageCommand } from "../src/cli.js";

describe("backend contract", () => {
  it("emits the normalized JSON envelope", async () => {
    const output = await runUsageCommand({
      provider: ["codex"],
      json: true,
      pretty: false,
      refresh: false,
      diagnostics: true,
    }, {
      createProviderRegistry: createTestProviderRegistry,
    });

    const payload = snapshotEnvelopeSchema.parse(JSON.parse(output));

    expect(payload.schema_version).toBe("1");
    expect(payload.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(payload.providers).toHaveLength(1);
    expect(payload.providers[0]).toMatchObject({
      provider: "codex",
      source: "cli",
    });
    expect(payload.providers[0].diagnostics?.attempts).toHaveLength(1);
  });

  it("rejects invalid request fields through the shared schema", () => {
    expect(() =>
      backendUsageRequestSchema.parse({
        providers: ["claude"],
        source_mode_override: "auto",
        force_refresh: false,
        include_diagnostics: false,
        ttl_seconds: -1
      })
    ).toThrow();

    expect(() =>
      backendUsageRequestSchema.parse({
        providers: ["claude"],
        source_mode_override: "auto",
        force_refresh: false,
        include_diagnostics: false,
        ttl_seconds: 30,
        unexpected: true
      })
    ).toThrow();
  });
});

function createTestProviderRegistry(): ProviderRegistry {
  return new ProviderRegistry([createProvider("codex", 35), createProvider("claude", 60)]);
}

function createProvider(providerId: ProviderAdapter["id"], used: number): ProviderAdapter {
  return {
    id: providerId,
    defaultSourceMode: "cli",
    async isAvailable() {
      return true;
    },
    async fetch(context) {
      return {
        provider: providerId,
        status: "ok",
        source: context.sourceMode,
        updated_at: context.now().toISOString(),
        usage: {
          kind: "quota",
          used,
          limit: 100,
          percent_used: used,
        },
        reset_window: null,
        error: null,
        diagnostics: {
          attempts: [
            {
              strategy: `${providerId}.fixture`,
              available: true,
              duration_ms: 1,
              error: null,
            },
          ],
        },
      };
    },
  };
}

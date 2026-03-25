import { describe, expect, it } from "vitest";

import { snapshotEnvelopeSchema } from "shared-contract";
import { runUsageCommand } from "../src/cli.js";
import type { ProviderAdapter } from "../src/core/provider-adapter.js";
import { ProviderRegistry } from "../src/core/provider-registry.js";

describe("usage output parity", () => {
  it("renders text and JSON from the same provider status story", async () => {
    const jsonOutput = await runUsageCommand({
      provider: "codex",
      json: true,
      diagnostics: false,
    }, {
      createProviderRegistry: createTestProviderRegistry,
    });
    const payload = snapshotEnvelopeSchema.parse(JSON.parse(jsonOutput));
    const textOutput = await runUsageCommand({
      provider: "codex",
      json: false,
      diagnostics: false,
    }, {
      createProviderRegistry: createTestProviderRegistry,
    });

    expect(payload.providers).toHaveLength(1);
    expect(payload.providers[0]?.provider).toBe("codex");
    expect(payload.providers[0]?.source).toBe("cli");
    expect(payload.providers[0]?.error).toBeNull();
    expect(payload.providers[0]?.diagnostics).toBeUndefined();

    expect(textOutput).toContain("Provider: codex");
    expect(textOutput).toContain("status: ok");
    expect(textOutput).toContain("source: cli");
    expect(textOutput).toContain("updated_at:");
    expect(textOutput).not.toContain("Diagnostics:");
  });

  it("includes diagnostics only when explicitly requested", async () => {
    const jsonOutput = await runUsageCommand({
      provider: "claude",
      json: true,
      diagnostics: true,
    }, {
      createProviderRegistry: createTestProviderRegistry,
    });
    const payload = snapshotEnvelopeSchema.parse(JSON.parse(jsonOutput));
    const textOutput = await runUsageCommand({
      provider: "claude",
      json: false,
      diagnostics: true,
    }, {
      createProviderRegistry: createTestProviderRegistry,
    });

    expect(payload.providers[0]?.diagnostics?.attempts.length).toBeGreaterThan(0);
    expect(textOutput).toContain("Diagnostics:");
    expect(textOutput).toContain("available=true");
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

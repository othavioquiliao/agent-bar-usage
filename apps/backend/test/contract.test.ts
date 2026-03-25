import { describe, expect, it } from "vitest";

import { backendUsageRequestSchema, snapshotEnvelopeSchema } from "shared-contract";
import { runUsageCommand } from "../src/cli.js";

describe("backend contract", () => {
  it("emits the normalized JSON envelope", async () => {
    const output = await runUsageCommand({
      provider: ["codex"],
      json: true,
      pretty: false,
      refresh: false,
      diagnostics: true,
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

import { describe, expect, it } from "vitest";

import { snapshotEnvelopeSchema } from "shared-contract";
import { runUsageCommand } from "../src/cli.js";

describe("usage output parity", () => {
  it("renders text and JSON from the same provider status story", async () => {
    const jsonOutput = await runUsageCommand({
      provider: "codex",
      json: true,
      diagnostics: false,
    });
    const payload = snapshotEnvelopeSchema.parse(JSON.parse(jsonOutput));
    const textOutput = await runUsageCommand({
      provider: "codex",
      json: false,
      diagnostics: false,
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
    });
    const payload = snapshotEnvelopeSchema.parse(JSON.parse(jsonOutput));
    const textOutput = await runUsageCommand({
      provider: "claude",
      json: false,
      diagnostics: true,
    });

    expect(payload.providers[0]?.diagnostics?.attempts.length).toBeGreaterThan(0);
    expect(textOutput).toContain("Diagnostics:");
    expect(textOutput).toContain("available=true");
  });
});

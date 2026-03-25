import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { snapshotEnvelopeSchema } from "shared-contract";

import { requestServiceSnapshot, requestServiceStatus } from "../src/service/service-client.js";
import { createAgentBarServiceRuntime } from "../src/service/service-server.js";

describe("backend service runtime", () => {
  it("answers status and snapshot requests over the unix socket", async () => {
    const socketDir = await mkdtemp(path.join(os.tmpdir(), "agent-bar-service-"));
    const socketPath = path.join(socketDir, "service.sock");
    const runtime = createAgentBarServiceRuntime({
      socketPath,
      createSnapshot: async (options) => ({
        schema_version: "1",
        generated_at: new Date("2026-03-25T17:05:00.000Z").toISOString(),
        providers: [
          {
            provider: "codex",
            status: "ok",
            source: "cli",
            updated_at: new Date("2026-03-25T17:05:00.000Z").toISOString(),
            usage: {
              kind: "quota",
              used: 10,
              limit: 100,
              percent_used: 10,
            },
            reset_window: null,
            error: null,
            diagnostics: options.diagnostics
              ? {
                  attempts: [
                    {
                      strategy: "codex.fixture",
                      available: true,
                      duration_ms: 1,
                      error: null,
                    },
                  ],
                }
              : undefined,
          },
        ],
      }),
    });

    try {
      await runtime.start();

      const runningStatus = await requestServiceStatus(socketPath);
      expect(runningStatus).toMatchObject({
        mode: "service",
        socket_path: socketPath,
        running: true,
        last_error: null,
      });

      const snapshot = snapshotEnvelopeSchema.parse(await requestServiceSnapshot(socketPath));
      expect(snapshot.providers.length).toBeGreaterThan(0);
      expect(snapshot.providers[0]?.diagnostics?.attempts.length).toBeGreaterThan(0);

      const statusAfterSnapshot = await requestServiceStatus(socketPath);
      expect(statusAfterSnapshot.last_snapshot_at).toBe(snapshot.generated_at);
    } finally {
      await runtime.stop();
      await rm(socketDir, { recursive: true, force: true });
    }
  }, 20_000);
});

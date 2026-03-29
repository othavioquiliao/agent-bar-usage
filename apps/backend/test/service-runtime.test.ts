import { describe, expect, it } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { assertSnapshotEnvelope, type SnapshotEnvelope } from 'shared-contract';

import { requestServiceSnapshot, requestServiceStatus } from '../src/service/service-client.js';
import { createAgentBarServiceRuntime } from '../src/service/service-server.js';

describe('backend service runtime', () => {
  it('answers status and snapshot requests over the unix socket', async () => {
    const socketDir = await mkdtemp(path.join(os.tmpdir(), 'agent-bar-service-'));
    const socketPath = path.join(socketDir, 'service.sock');
    const runtime = createAgentBarServiceRuntime({
      socketPath,
      createSnapshot: async (options) => ({
        schema_version: '1',
        generated_at: new Date('2026-03-25T17:05:00.000Z').toISOString(),
        providers: [
          {
            provider: 'codex',
            status: 'ok',
            source: 'cli',
            updated_at: new Date('2026-03-25T17:05:00.000Z').toISOString(),
            usage: {
              kind: 'quota',
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
                      strategy: 'codex.fixture',
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
        mode: 'service',
        socket_path: socketPath,
        running: true,
        last_error: null,
      });

      const snapshot = assertSnapshotEnvelope(await requestServiceSnapshot(socketPath));
      expect(snapshot.providers.length).toBeGreaterThan(0);
      expect(snapshot.providers[0]?.diagnostics?.attempts.length).toBeGreaterThan(0);

      const statusAfterSnapshot = await requestServiceStatus(socketPath);
      expect(statusAfterSnapshot.last_snapshot_at).toBe(snapshot.generated_at);
    } finally {
      await runtime.stop();
      await rm(socketDir, { recursive: true, force: true });
    }
  }, 20_000);

  it('hydrates the last persisted snapshot before the first refresh completes', async () => {
    const socketDir = await mkdtemp(path.join(os.tmpdir(), 'agent-bar-service-'));
    const socketPath = path.join(socketDir, 'service.sock');
    const snapshotStatePath = path.join(socketDir, 'latest-snapshot.json');
    const persistedSnapshot = createSnapshotEnvelope('2026-03-25T17:00:00.000Z', 10);
    await writeFile(snapshotStatePath, `${JSON.stringify(persistedSnapshot, null, 2)}\n`, 'utf8');

    let resolveRefresh!: (snapshot: SnapshotEnvelope) => void;
    let intervalMs = 0;
    let scheduledRefresh: (() => void) | null = null;

    const runtime = createAgentBarServiceRuntime({
      socketPath,
      snapshotStatePath,
      refreshIntervalMs: 1234,
      scheduler: {
        setInterval(callback, ms) {
          scheduledRefresh = callback;
          intervalMs = ms;
          return 1;
        },
        clearInterval() {},
      },
      createSnapshot: () =>
        new Promise<SnapshotEnvelope>((resolve) => {
          resolveRefresh = resolve;
        }),
    });

    try {
      await runtime.start();

      expect(intervalMs).toBe(1234);
      expect(scheduledRefresh).not.toBeNull();

      const snapshot = assertSnapshotEnvelope(await requestServiceSnapshot(socketPath));
      expect(snapshot.generated_at).toBe('2026-03-25T17:00:00.000Z');
      expect(snapshot.providers[0]?.usage?.used).toBe(10);

      resolveRefresh(createSnapshotEnvelope('2026-03-25T17:05:00.000Z', 25));
      await new Promise((resolve) => setTimeout(resolve, 0));

      const status = await requestServiceStatus(socketPath);
      expect(status.last_snapshot_at).toBe('2026-03-25T17:05:00.000Z');
    } finally {
      await runtime.stop();
      await rm(socketDir, { recursive: true, force: true });
    }
  }, 20_000);
});

function createSnapshotEnvelope(generatedAt: string, used: number): SnapshotEnvelope {
  return {
    schema_version: '1',
    generated_at: generatedAt,
    providers: [
      {
        provider: 'codex',
        status: 'ok',
        source: 'cli',
        updated_at: generatedAt,
        usage: {
          kind: 'quota',
          used,
          limit: 100,
          percent_used: used,
        },
        reset_window: null,
        error: null,
        diagnostics: {
          attempts: [
            {
              strategy: 'codex.fixture',
              available: true,
              duration_ms: 1,
              error: null,
            },
          ],
        },
      },
    ],
  };
}

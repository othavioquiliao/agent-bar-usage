import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { SnapshotCache } from '../src/cache/snapshot-cache.js';

describe('file snapshot cache', () => {
  let cacheDir: string;

  afterEach(() => {
    if (cacheDir) {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  it('persists snapshots across cache instances', async () => {
    cacheDir = mkdtempSync(join(tmpdir(), 'agent-bar-cache-'));
    const snapshot = createSnapshot('2026-03-25T17:00:00.000Z');
    const first = new SnapshotCache({
      cacheDir,
      now: () => new Date('2026-03-25T17:00:00.000Z').getTime(),
    });

    await first.set('codex-quota__cli', snapshot, 30);

    const second = new SnapshotCache({
      cacheDir,
      now: () => new Date('2026-03-25T17:00:01.000Z').getTime(),
    });

    await expect(second.get('codex-quota__cli', 30)).resolves.toEqual(snapshot);
  });

  it('deduplicates concurrent fetches for the same cache key', async () => {
    cacheDir = mkdtempSync(join(tmpdir(), 'agent-bar-cache-'));
    const cache = new SnapshotCache({
      cacheDir,
      now: () => new Date('2026-03-25T17:00:00.000Z').getTime(),
    });
    let fetchCount = 0;

    const fetcher = async () => {
      fetchCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return createSnapshot('2026-03-25T17:00:00.000Z');
    };

    const [first, second] = await Promise.all([
      cache.getOrFetch('codex-quota__cli', fetcher, 30, {
        forceRefresh: true,
      }),
      cache.getOrFetch('codex-quota__cli', fetcher, 30, {
        forceRefresh: true,
      }),
    ]);

    expect(fetchCount).toBe(1);
    expect(first).toEqual(second);
  });
});

function createSnapshot(updatedAt: string) {
  return {
    provider: 'codex' as const,
    status: 'ok' as const,
    source: 'cli' as const,
    updated_at: updatedAt,
    usage: {
      kind: 'quota' as const,
      used: 10,
      limit: 100,
      percent_used: 10,
    },
    reset_window: null,
    error: null,
  };
}

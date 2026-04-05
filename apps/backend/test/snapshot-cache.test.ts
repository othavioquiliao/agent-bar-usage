import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { CACHE_SCHEMA_VERSION, SnapshotCache } from '../src/cache/snapshot-cache.js';

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

describe('snapshot cache schema versioning', () => {
  let cacheDir: string;
  const NOW = new Date('2026-03-25T17:00:00.000Z').getTime();

  afterEach(() => {
    if (cacheDir) {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  it('loads cache entry written with current CACHE_SCHEMA_VERSION', async () => {
    cacheDir = mkdtempSync(join(tmpdir(), 'agent-bar-cache-'));
    const snapshot = createSnapshot('2026-03-25T17:00:00.000Z');
    const writer = new SnapshotCache({ cacheDir, now: () => NOW });

    await writer.set('codex-quota__cli', snapshot, 60);

    // Verify the written file includes cacheSchemaVersion
    const raw = JSON.parse(readFileSync(join(cacheDir, 'codex-quota__cli.json'), 'utf8'));
    expect(raw.cacheSchemaVersion).toBe(CACHE_SCHEMA_VERSION);

    // A fresh cache instance should be able to load it
    const reader = new SnapshotCache({ cacheDir, now: () => NOW + 1000 });
    await expect(reader.get('codex-quota__cli', 60)).resolves.toEqual(snapshot);
  });

  it('returns null for cache entry with mismatched cacheSchemaVersion', async () => {
    cacheDir = mkdtempSync(join(tmpdir(), 'agent-bar-cache-'));
    const snapshot = createSnapshot('2026-03-25T17:00:00.000Z');

    // Write a cache file with a future/wrong schema version
    const entry = {
      cacheSchemaVersion: 999,
      snapshot,
      expiresAtMs: NOW + 60_000,
    };
    const filePath = join(cacheDir, 'codex-quota__cli.json');
    writeFileSync(filePath, `${JSON.stringify(entry, null, 2)}\n`);

    const cache = new SnapshotCache({ cacheDir, now: () => NOW });
    await expect(cache.get('codex-quota__cli', 60)).resolves.toBeNull();
  });

  it('returns null for cache entry with no cacheSchemaVersion (old format)', async () => {
    cacheDir = mkdtempSync(join(tmpdir(), 'agent-bar-cache-'));
    const snapshot = createSnapshot('2026-03-25T17:00:00.000Z');

    // Write an old-format cache file without cacheSchemaVersion
    const entry = {
      snapshot,
      expiresAtMs: NOW + 60_000,
    };
    const filePath = join(cacheDir, 'codex-quota__cli.json');
    writeFileSync(filePath, `${JSON.stringify(entry, null, 2)}\n`);

    const cache = new SnapshotCache({ cacheDir, now: () => NOW });
    await expect(cache.get('codex-quota__cli', 60)).resolves.toBeNull();
  });

  it('returns null for cache entry with correct version but expired TTL', async () => {
    cacheDir = mkdtempSync(join(tmpdir(), 'agent-bar-cache-'));
    const snapshot = createSnapshot('2026-03-25T17:00:00.000Z');
    const writer = new SnapshotCache({ cacheDir, now: () => NOW });

    await writer.set('codex-quota__cli', snapshot, 5);

    // Read after TTL has expired (6 seconds later)
    const reader = new SnapshotCache({ cacheDir, now: () => NOW + 6_000 });
    await expect(reader.get('codex-quota__cli', 5)).resolves.toBeNull();
  });
});

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { assertProviderSnapshot, type ProviderSnapshot, type ProviderSourceMode } from 'shared-contract';

import { atomicWriteFileSync } from '../utils/atomic-write.js';
import { type ResolveCachePathOptions, resolveSnapshotCacheDir } from './cache-path.js';

export const DEFAULT_SNAPSHOT_TTL_SECONDS = 30;

export interface SnapshotCacheEntry {
  snapshot: ProviderSnapshot;
  expiresAtMs: number;
}

export interface SnapshotCacheKeyParts {
  cacheKey: string;
  sourceMode: ProviderSourceMode;
}

export class SnapshotCache {
  readonly #entries = new Map<string, SnapshotCacheEntry>();
  readonly #inflight = new Map<string, Promise<ProviderSnapshot>>();

  constructor(
    private readonly options: {
      now?: () => number;
      defaultTtlSeconds?: number;
      cacheDir?: string;
    } & ResolveCachePathOptions = {},
  ) {}

  async get(key: string, _ttlSeconds = this.defaultTtlSeconds): Promise<ProviderSnapshot | null> {
    const memoryEntry = this.#entries.get(key);

    if (memoryEntry && memoryEntry.expiresAtMs > this.now()) {
      return memoryEntry.snapshot;
    }

    if (memoryEntry) {
      this.#entries.delete(key);
    }

    const filePath = this.filePathForKey(key);
    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const entry = JSON.parse(readFileSync(filePath, 'utf8')) as SnapshotCacheEntry;
      if (entry.expiresAtMs <= this.now()) {
        return null;
      }

      const snapshot = assertProviderSnapshot(entry.snapshot);
      this.#entries.set(key, {
        snapshot,
        expiresAtMs: entry.expiresAtMs,
      });
      return snapshot;
    } catch {
      return null;
    }
  }

  async set(key: string, snapshot: ProviderSnapshot, ttlSeconds = this.defaultTtlSeconds): Promise<ProviderSnapshot> {
    const entry = {
      snapshot,
      expiresAtMs: this.now() + ttlSeconds * 1000,
    } satisfies SnapshotCacheEntry;

    this.ensureCacheDir();
    this.#entries.set(key, entry);
    atomicWriteFileSync(this.filePathForKey(key), `${JSON.stringify(entry, null, 2)}\n`);

    return snapshot;
  }

  async getOrFetch(
    key: string,
    fetcher: () => Promise<ProviderSnapshot>,
    ttlSeconds = this.defaultTtlSeconds,
    options: {
      forceRefresh?: boolean;
    } = {},
  ): Promise<ProviderSnapshot> {
    if (!options.forceRefresh) {
      const cached = await this.get(key, ttlSeconds);
      if (cached) {
        return cached;
      }
    }

    const existingFetch = this.#inflight.get(key);
    if (existingFetch) {
      return existingFetch;
    }

    const fetchPromise = fetcher()
      .then(async (snapshot) => await this.set(key, snapshot, ttlSeconds))
      .finally(() => {
        this.#inflight.delete(key);
      });

    this.#inflight.set(key, fetchPromise);
    return fetchPromise;
  }

  clear(): void {
    this.#entries.clear();
  }

  private get defaultTtlSeconds(): number {
    return this.options.defaultTtlSeconds ?? DEFAULT_SNAPSHOT_TTL_SECONDS;
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }

  private cacheDir(): string {
    return this.options.cacheDir ?? resolveSnapshotCacheDir(this.options);
  }

  private ensureCacheDir(): void {
    mkdirSync(this.cacheDir(), { recursive: true });
  }

  private filePathForKey(key: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
      throw new Error(`Invalid cache key: ${key}`);
    }

    return path.join(this.cacheDir(), `${key}.json`);
  }
}

export function buildSnapshotCacheKey({ cacheKey, sourceMode }: SnapshotCacheKeyParts): string {
  return `${cacheKey}__${sourceMode}`;
}

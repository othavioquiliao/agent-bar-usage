import type { ProviderId, ProviderSnapshot, ProviderSourceMode } from "shared-contract";

export const DEFAULT_SNAPSHOT_TTL_SECONDS = 30;

export interface SnapshotCacheEntry {
  snapshot: ProviderSnapshot;
  expiresAtMs: number;
}

export interface SnapshotCacheKeyParts {
  providerId: ProviderId;
  sourceMode: ProviderSourceMode;
}

export class SnapshotCache {
  readonly #entries = new Map<string, SnapshotCacheEntry>();

  constructor(
    private readonly options: {
      now?: () => number;
      defaultTtlSeconds?: number;
    } = {},
  ) {}

  get(key: string, ttlSeconds = this.defaultTtlSeconds): ProviderSnapshot | null {
    const entry = this.#entries.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAtMs <= this.now()) {
      this.#entries.delete(key);
      return null;
    }

    return entry.snapshot;
  }

  set(key: string, snapshot: ProviderSnapshot, ttlSeconds = this.defaultTtlSeconds): ProviderSnapshot {
    this.#entries.set(key, {
      snapshot,
      expiresAtMs: this.now() + ttlSeconds * 1000,
    });

    return snapshot;
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
}

export function buildSnapshotCacheKey({ providerId, sourceMode }: SnapshotCacheKeyParts): string {
  return `${providerId}:${sourceMode}`;
}

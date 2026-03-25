import {
  providerSnapshotSchema,
  snapshotEnvelopeSchema,
  snapshotSchemaVersion,
  type ProviderSnapshot,
  type ProviderSourceMode,
  type SnapshotEnvelope,
} from "shared-contract";

import type { BackendRequest } from "../config/backend-request.js";
import { SnapshotCache, buildSnapshotCacheKey } from "../cache/snapshot-cache.js";
import {
  createErrorSnapshot,
  createProviderError,
  createUnavailableSnapshot,
  type ProviderAdapter,
} from "./provider-adapter.js";
import { ProviderRegistry } from "./provider-registry.js";
import { runSubprocess } from "../utils/subprocess.js";

export interface BackendCoordinatorOptions {
  registry: ProviderRegistry;
  cache?: SnapshotCache;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
}

export class BackendCoordinator {
  readonly #registry: ProviderRegistry;
  readonly #cache: SnapshotCache;
  readonly #env: NodeJS.ProcessEnv;
  readonly #now: () => Date;

  constructor(options: BackendCoordinatorOptions) {
    this.#registry = options.registry;
    this.#cache = options.cache ?? new SnapshotCache();
    this.#env = options.env ?? process.env;
    this.#now = options.now ?? (() => new Date());
  }

  async getSnapshot(request: BackendRequest): Promise<SnapshotEnvelope> {
    const adapters = this.#registry.resolve(request.providers);
    const providers = await Promise.all(adapters.map(async (adapter) => await this.#resolveSnapshot(adapter, request)));
    const generatedAt =
      providers
        .map((snapshot) => snapshot.updated_at)
        .sort()
        .at(-1) ?? this.#now().toISOString();

    return snapshotEnvelopeSchema.parse({
      schema_version: snapshotSchemaVersion,
      generated_at: generatedAt,
      providers,
    });
  }

  async #resolveSnapshot(adapter: ProviderAdapter, request: BackendRequest): Promise<ProviderSnapshot> {
    const sourceMode = this.#resolveSourceMode(adapter, request);
    const cacheKey = buildSnapshotCacheKey({
      providerId: adapter.id,
      sourceMode,
    });

    if (!request.forceRefresh) {
      const cachedSnapshot = this.#cache.get(cacheKey, request.ttlSeconds);
      if (cachedSnapshot) {
        return cachedSnapshot;
      }
    }

    const updatedAt = this.#now().toISOString();
    const context = {
      request,
      providerId: adapter.id,
      sourceMode,
      env: this.#env,
      now: this.#now,
      runSubprocess,
    };

    const isAvailable = await adapter.isAvailable(context);

    if (!isAvailable) {
      return this.#cache.set(
        cacheKey,
        createUnavailableSnapshot(
          adapter.id,
          sourceMode,
          updatedAt,
          createProviderError("provider_unavailable", `${adapter.id} is not available for ${sourceMode} mode.`),
        ),
        request.ttlSeconds,
      );
    }

    try {
      const snapshot = providerSnapshotSchema.parse({
        ...normalizeSnapshot(await adapter.fetch(context), adapter.id, sourceMode, updatedAt),
      });

      return this.#cache.set(cacheKey, snapshot, request.ttlSeconds);
    } catch (error) {
      return this.#cache.set(cacheKey, toErrorSnapshot(adapter.id, sourceMode, updatedAt, error), request.ttlSeconds);
    }
  }

  #resolveSourceMode(adapter: ProviderAdapter, request: BackendRequest): ProviderSourceMode {
    if (request.sourceMode !== "auto") {
      return request.sourceMode;
    }

    return adapter.defaultSourceMode ?? "auto";
  }
}

function normalizeSnapshot(
  snapshot: ProviderSnapshot,
  providerId: ProviderSnapshot["provider"],
  sourceMode: ProviderSourceMode,
  updatedAt: string,
): ProviderSnapshot {
  return {
    ...snapshot,
    provider: providerId,
    source: snapshot.source ?? sourceMode,
    updated_at: snapshot.updated_at ?? updatedAt,
    error: snapshot.error ?? null,
  };
}

function toErrorSnapshot(
  providerId: ProviderSnapshot["provider"],
  sourceMode: ProviderSourceMode,
  updatedAt: string,
  error: unknown,
): ProviderSnapshot {
  if (error instanceof Error) {
    return createErrorSnapshot(
      providerId,
      sourceMode,
      updatedAt,
      createProviderError("provider_fetch_failed", error.message, true),
    );
  }

  return createErrorSnapshot(
    providerId,
    sourceMode,
    updatedAt,
    createProviderError("provider_fetch_failed", "Unknown provider error.", true),
  );
}

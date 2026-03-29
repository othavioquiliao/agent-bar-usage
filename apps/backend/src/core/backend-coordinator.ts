import {
  assertProviderSnapshot,
  assertSnapshotEnvelope,
  type ProviderSnapshot,
  type ProviderSourceMode,
  type SnapshotEnvelope,
  snapshotSchemaVersion,
} from 'shared-contract';
import { buildSnapshotCacheKey, SnapshotCache } from '../cache/snapshot-cache.js';
import type { BackendRequest } from '../config/backend-request.js';
import type { BackendConfig } from '../config/config-schema.js';
import type { SecretResolver } from '../secrets/secret-store.js';
import { runSubprocess } from '../utils/subprocess.js';
import { createErrorSnapshot, createProviderError, createUnavailableSnapshot } from './provider-adapter.js';
import { ProviderContextBuilder, type ProviderExecutionContext } from './provider-context-builder.js';
import type { ProviderRegistry } from './provider-registry.js';

export interface BackendCoordinatorOptions {
  registry: ProviderRegistry;
  cache?: SnapshotCache;
  config?: BackendConfig;
  secretResolver?: SecretResolver;
  contextBuilder?: ProviderContextBuilder;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
}

export class BackendCoordinator {
  readonly #registry: ProviderRegistry;
  readonly #cache: SnapshotCache;
  readonly #contextBuilder: ProviderContextBuilder;
  readonly #env: NodeJS.ProcessEnv;
  readonly #now: () => Date;

  constructor(options: BackendCoordinatorOptions) {
    this.#registry = options.registry;
    this.#cache = options.cache ?? new SnapshotCache();
    this.#env = options.env ?? process.env;
    this.#now = options.now ?? (() => new Date());
    this.#contextBuilder =
      options.contextBuilder ??
      new ProviderContextBuilder({
        registry: this.#registry,
        config: options.config,
        secretResolver: options.secretResolver,
      });
  }

  async getSnapshot(request: BackendRequest): Promise<SnapshotEnvelope> {
    const providerContexts = await this.#contextBuilder.build(request);
    const providers = await Promise.all(
      providerContexts.map(async (providerContext) => await this.#resolveSnapshot(providerContext, request)),
    );
    const generatedAt =
      providers
        .map((snapshot) => snapshot.updated_at)
        .sort()
        .at(-1) ?? this.#now().toISOString();

    return assertSnapshotEnvelope({
      schema_version: snapshotSchemaVersion,
      generated_at: generatedAt,
      providers,
    });
  }

  async #resolveSnapshot(
    providerContext: ProviderExecutionContext,
    request: BackendRequest,
  ): Promise<ProviderSnapshot> {
    const adapter = providerContext.adapter;
    const sourceMode = providerContext.sourceMode;
    const cacheKey = buildSnapshotCacheKey({
      cacheKey: adapter.cacheKey,
      sourceMode,
    });

    if (!request.forceRefresh) {
      const cachedSnapshot = await this.#cache.get(cacheKey, request.ttlSeconds);
      if (cachedSnapshot) {
        return cachedSnapshot;
      }
    }

    return await this.#cache.getOrFetch(
      cacheKey,
      async () => {
        const updatedAt = this.#now().toISOString();

        if (providerContext.secretError) {
          return createErrorSnapshot(
            adapter.id,
            sourceMode,
            updatedAt,
            createProviderError(
              providerContext.secretError.code,
              providerContext.secretError.message,
              providerContext.secretError.retryable,
            ),
          );
        }

        const context = {
          request,
          providerId: adapter.id,
          sourceMode,
          providerConfig: providerContext.providerConfig,
          providerRuntime: providerContext.providerRuntime,
          secrets: providerContext.secrets,
          env: this.#env,
          now: this.#now,
          runSubprocess,
        };

        let isAvailable = false;
        try {
          isAvailable = await adapter.isAvailable(context);
        } catch (error) {
          return createErrorSnapshot(
            adapter.id,
            sourceMode,
            updatedAt,
            createProviderError(
              'provider_availability_failed',
              error instanceof Error ? error.message : 'Provider availability check failed.',
              true,
            ),
          );
        }

        if (!isAvailable) {
          return createUnavailableSnapshot(
            adapter.id,
            sourceMode,
            updatedAt,
            createProviderError('provider_unavailable', `${adapter.id} is not available for ${sourceMode} mode.`),
          );
        }

        try {
          return assertProviderSnapshot({
            ...normalizeSnapshot(await adapter.getQuota(context), adapter.id, sourceMode, updatedAt),
          });
        } catch (error) {
          return toErrorSnapshot(adapter.id, sourceMode, updatedAt, error);
        }
      },
      request.ttlSeconds,
      {
        forceRefresh: request.forceRefresh,
      },
    );
  }
}

function normalizeSnapshot(
  snapshot: ProviderSnapshot,
  providerId: ProviderSnapshot['provider'],
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
  providerId: ProviderSnapshot['provider'],
  sourceMode: ProviderSourceMode,
  updatedAt: string,
  error: unknown,
): ProviderSnapshot {
  if (error instanceof Error) {
    return createErrorSnapshot(
      providerId,
      sourceMode,
      updatedAt,
      createProviderError('provider_fetch_failed', error.message, true),
    );
  }

  return createErrorSnapshot(
    providerId,
    sourceMode,
    updatedAt,
    createProviderError('provider_fetch_failed', 'Unknown provider error.', true),
  );
}

import type { ProviderId, ProviderSourceMode } from "shared-contract";

import type { BackendRequest } from "../config/backend-request.js";
import type { BackendConfig, ProviderConfig } from "../config/config-schema.js";
import { createDefaultConfig } from "../config/default-config.js";
import {
  SecretReferenceError,
  toSecretReference,
  type SecretStoreId,
} from "../secrets/secret-reference.js";
import { SecretResolutionError, SecretResolver } from "../secrets/secret-store.js";
import type { ProviderAdapter, ProviderRuntimeMetadata, ResolvedProviderSecrets } from "./provider-adapter.js";
import { ProviderRegistry } from "./provider-registry.js";

export interface ProviderContextBuildOptions {
  registry: ProviderRegistry;
  config?: BackendConfig;
  secretResolver?: SecretResolver;
}

export interface ProviderExecutionContext {
  adapter: ProviderAdapter;
  sourceMode: ProviderSourceMode;
  providerConfig: ProviderConfig | null;
  providerRuntime: ProviderRuntimeMetadata;
  secrets: ResolvedProviderSecrets;
  secretError: SecretResolutionError | null;
}

export class ProviderContextBuilder {
  readonly #registry: ProviderRegistry;
  readonly #config: BackendConfig;
  readonly #secretResolver: SecretResolver;

  constructor(options: ProviderContextBuildOptions) {
    this.#registry = options.registry;
    this.#config = options.config ?? createDefaultConfig();
    this.#secretResolver = options.secretResolver ?? new SecretResolver([]);
  }

  async build(request: BackendRequest): Promise<ProviderExecutionContext[]> {
    const orderedProviders = this.#resolveProviderOrder(request);
    const contexts: ProviderExecutionContext[] = [];

    for (const provider of orderedProviders) {
      const adapter = this.#registry.getById(provider.id);

      if (!adapter) {
        if (provider.explicit) {
          throw new Error(`Unknown provider requested explicitly: ${provider.id}`);
        }
        continue;
      }

      const sourceMode = this.#resolveSourceMode(adapter.defaultSourceMode, provider.config, request);
      const secretResult = await this.#resolveProviderSecret(provider.config);

      contexts.push({
        adapter,
        sourceMode,
        providerConfig: provider.config,
        providerRuntime: {
          enabled: provider.config?.enabled ?? true,
          preferredSourceMode: provider.config?.sourceMode ?? "auto",
        },
        secrets: secretResult.secrets,
        secretError: secretResult.error,
      });
    }

    return contexts;
  }

  #resolveProviderOrder(
    request: BackendRequest,
  ): Array<{ id: ProviderId; config: ProviderConfig | null; explicit: boolean }> {
    const byId = new Map<ProviderId, ProviderConfig>();
    for (const provider of this.#config.providers) {
      byId.set(provider.id, provider);
    }

    if (request.providers && request.providers.length > 0) {
      return request.providers.map((id) => ({
        id,
        config: byId.get(id) ?? null,
        explicit: true,
      }));
    }

    return this.#config.providers
      .filter((provider) => provider.enabled)
      .map((provider) => ({
        id: provider.id,
        config: provider,
        explicit: false,
      }));
  }

  #resolveSourceMode(
    adapterDefaultSourceMode: ProviderSourceMode | undefined,
    providerConfig: ProviderConfig | null,
    request: BackendRequest,
  ): ProviderSourceMode {
    if (request.sourceMode !== "auto") {
      return request.sourceMode;
    }

    const configuredSourceMode = providerConfig?.sourceMode;
    if (configuredSourceMode && configuredSourceMode !== "auto") {
      return configuredSourceMode;
    }

    return adapterDefaultSourceMode ?? "auto";
  }

  async #resolveProviderSecret(
    providerConfig: ProviderConfig | null,
  ): Promise<{ secrets: ResolvedProviderSecrets; error: SecretResolutionError | null }> {
    if (!providerConfig?.secretRef) {
      return {
        secrets: {
          primary: null,
          store: null,
        },
        error: null,
      };
    }

    try {
      const reference = toSecretReference(providerConfig.secretRef);
      const value = await this.#secretResolver.resolve(reference);

      return {
        secrets: {
          primary: value,
          store: reference.store,
        },
        error: null,
      };
    } catch (error) {
      if (error instanceof SecretResolutionError) {
        return {
          secrets: {
            primary: null,
            store: resolveStoreHint(providerConfig.secretRef.store),
          },
          error,
        };
      }

      if (error instanceof SecretReferenceError) {
        return {
          secrets: {
            primary: null,
            store: resolveStoreHint(providerConfig.secretRef.store),
          },
          error: new SecretResolutionError(
            error.code,
            resolveStoreHint(providerConfig.secretRef.store),
            error.message,
            false,
            error,
          ),
        };
      }

      return {
        secrets: {
          primary: null,
          store: resolveStoreHint(providerConfig.secretRef.store),
        },
        error: new SecretResolutionError(
          "secret_store_failed",
          resolveStoreHint(providerConfig.secretRef.store),
          "Unexpected secret resolution failure.",
          true,
          error,
        ),
      };
    }
  }
}

function resolveStoreHint(store: "secret-tool" | "env"): SecretStoreId {
  return store === "env" ? "env" : "secret-tool";
}

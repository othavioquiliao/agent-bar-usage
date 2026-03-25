import { type ProviderId, type SnapshotEnvelope } from "shared-contract";

import { SnapshotCache } from "../cache/snapshot-cache.js";
import { normalizeBackendRequest, type BackendRequest } from "../config/backend-request.js";
import { loadBackendConfig } from "../config/config-loader.js";
import { BackendCoordinator } from "./backend-coordinator.js";
import { ProviderContextBuilder } from "./provider-context-builder.js";
import { createProviderRegistry as createDefaultProviderRegistry } from "./provider-registry-factory.js";
import { EnvSecretStore } from "../secrets/env-secret-store.js";
import { SecretToolStore } from "../secrets/secret-tool-store.js";
import { SecretResolver } from "../secrets/secret-store.js";
import { serializeSnapshotEnvelope } from "../serializers/snapshot-serializer.js";

export interface UsageCommandOptions {
  provider?: ProviderId | ProviderId[];
  json?: boolean;
  pretty?: boolean;
  refresh?: boolean;
  diagnostics?: boolean;
}

export interface UsageCommandDependencies {
  createProviderRegistry?: typeof createDefaultProviderRegistry;
}

function normalizeProviders(provider: UsageCommandOptions["provider"]): ProviderId[] | undefined {
  if (!provider) {
    return undefined;
  }

  return Array.isArray(provider) ? provider : [provider];
}

export async function createUsageSnapshot(
  options: UsageCommandOptions = {},
  dependencies: UsageCommandDependencies = {},
): Promise<SnapshotEnvelope> {
  const request: BackendRequest = normalizeBackendRequest({
    providers: normalizeProviders(options.provider),
    force_refresh: Boolean(options.refresh),
    include_diagnostics: Boolean(options.diagnostics),
  });

  const loadedConfig = await loadBackendConfig();
  const registry = dependencies.createProviderRegistry?.() ?? createDefaultProviderRegistry();
  const secretResolver = new SecretResolver([new SecretToolStore(), new EnvSecretStore()]);
  const contextBuilder = new ProviderContextBuilder({
    registry,
    config: loadedConfig.config,
    secretResolver,
  });

  const coordinator = new BackendCoordinator({
    registry,
    contextBuilder,
    cache: new SnapshotCache(),
  });

  const snapshot = await coordinator.getSnapshot(request);
  const serialized = serializeSnapshotEnvelope(snapshot, {
    includeDiagnostics: request.includeDiagnostics,
  });

  return serialized;
}

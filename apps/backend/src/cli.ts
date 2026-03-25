#!/usr/bin/env node
import { Command, InvalidArgumentError } from "commander";
import {
  providerIdSchema,
  type ProviderId,
  type ProviderSnapshot,
  type ProviderSourceMode,
} from "shared-contract";

import { SnapshotCache } from "./cache/snapshot-cache.js";
import { formatConfigCommandError, registerConfigCommand } from "./commands/config-command.js";
import { loadBackendConfig } from "./config/config-loader.js";
import { normalizeBackendRequest } from "./config/backend-request.js";
import { BackendCoordinator } from "./core/backend-coordinator.js";
import { ProviderContextBuilder } from "./core/provider-context-builder.js";
import { createProviderRegistry as createDefaultProviderRegistry } from "./core/provider-registry-factory.js";
import { formatSnapshotAsText } from "./formatters/text-formatter.js";
import { EnvSecretStore } from "./secrets/env-secret-store.js";
import { SecretToolStore } from "./secrets/secret-tool-store.js";
import { SecretResolver } from "./secrets/secret-store.js";
import { serializeSnapshotEnvelope } from "./serializers/snapshot-serializer.js";

function parseProviderId(value: string): ProviderId {
  const parsed = providerIdSchema.safeParse(value);

  if (!parsed.success) {
    throw new InvalidArgumentError(`Unsupported provider: ${value}`);
  }

  return parsed.data;
}

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

function withDiagnostics(snapshot: ProviderSnapshot): ProviderSnapshot {
  if (snapshot.diagnostics) {
    return snapshot;
  }
  return {
    ...snapshot,
    diagnostics: {
      attempts: [],
    },
  };
}

export async function runUsageCommand(
  options: UsageCommandOptions = {},
  dependencies: UsageCommandDependencies = {},
): Promise<string> {
  const request = normalizeBackendRequest({
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

  if (options.json) {
    const normalizedForOutput = request.includeDiagnostics
      ? {
          ...serialized,
          providers: serialized.providers.map((provider) => withDiagnostics(provider)),
        }
      : serialized;
    return JSON.stringify(normalizedForOutput, null, options.pretty ? 2 : 0);
  }

  return formatSnapshotAsText(serialized, {
    includeDiagnostics: request.includeDiagnostics,
  });
}

const program = new Command();

program.name("agent-bar");

program
  .command("usage")
  .description("Fetch provider usage snapshots.")
  .option("--provider <provider>", "Refresh a single provider", parseProviderId)
  .option("--json", "Emit machine-readable JSON")
  .option("--pretty", "Pretty-print JSON output")
  .option("--refresh", "Bypass the snapshot cache")
  .option("--diagnostics", "Include provider diagnostics in the output")
  .action(async (options: UsageCommandOptions) => {
    const output = await runUsageCommand(options);
    process.stdout.write(`${output}\n`);
  });

registerConfigCommand(program);

if (import.meta.url === `file://${process.argv[1]}`) {
  program.parseAsync(process.argv).catch((error: unknown) => {
    const message = formatConfigCommandError(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}

#!/usr/bin/env node
import { Command, InvalidArgumentError } from "commander";
import { providerIdSchema, type ProviderId, type ProviderSourceMode } from "shared-contract";

import { SnapshotCache } from "./cache/snapshot-cache.js";
import { normalizeBackendRequest } from "./config/backend-request.js";
import { BackendCoordinator } from "./core/backend-coordinator.js";
import type { ProviderAdapter } from "./core/provider-adapter.js";
import { ProviderRegistry } from "./core/provider-registry.js";

const defaultSourceModes: Record<ProviderId, ProviderSourceMode> = {
  copilot: "api",
  codex: "cli",
  claude: "cli",
};

function parseProviderId(value: string): ProviderId {
  const parsed = providerIdSchema.safeParse(value);

  if (!parsed.success) {
    throw new InvalidArgumentError(`Unsupported provider: ${value}`);
  }

  return parsed.data;
}

function createPlaceholderAdapter(providerId: ProviderId): ProviderAdapter {
  return {
    id: providerId,
    defaultSourceMode: defaultSourceModes[providerId],
    async isAvailable() {
      return false;
    },
    async fetch() {
      throw new Error(`${providerId} adapter is not implemented yet.`);
    },
  };
}

function createProviderRegistry(): ProviderRegistry {
  return new ProviderRegistry([
    createPlaceholderAdapter("copilot"),
    createPlaceholderAdapter("codex"),
    createPlaceholderAdapter("claude"),
  ]);
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
  .action(async (options: { provider?: ProviderId; json?: boolean; pretty?: boolean; refresh?: boolean; diagnostics?: boolean }) => {
    const request = normalizeBackendRequest({
      providers: options.provider ? [options.provider] : undefined,
      force_refresh: Boolean(options.refresh),
      include_diagnostics: Boolean(options.diagnostics),
    });
    const coordinator = new BackendCoordinator({
      registry: createProviderRegistry(),
      cache: new SnapshotCache(),
    });
    const snapshot = await coordinator.getSnapshot(request);
    const spacing = options.pretty || !options.json ? 2 : 0;

    process.stdout.write(`${JSON.stringify(snapshot, null, spacing)}\n`);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown CLI failure.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});

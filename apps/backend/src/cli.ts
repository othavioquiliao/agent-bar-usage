#!/usr/bin/env node
import { Command, InvalidArgumentError } from "commander";
import { providerIdSchema, type ProviderId } from "shared-contract";

import { formatConfigCommandError, registerConfigCommand } from "./commands/config-command.js";
import { registerDoctorCommand } from "./commands/diagnostics-command.js";
import { registerServiceCommand } from "./commands/service-command.js";
import {
  createUsageSnapshot,
  type UsageCommandDependencies,
  type UsageCommandOptions as SharedUsageCommandOptions,
} from "./core/usage-snapshot.js";
import { formatSnapshotAsText } from "./formatters/text-formatter.js";
import { snapshotEnvelopeSchema } from "shared-contract";

function parseProviderId(value: string): ProviderId {
  const parsed = providerIdSchema.safeParse(value);

  if (!parsed.success) {
    throw new InvalidArgumentError(`Unsupported provider: ${value}`);
  }

  return parsed.data;
}

export interface UsageCommandOptions extends SharedUsageCommandOptions {
  json?: boolean;
  pretty?: boolean;
}

function normalizeProviders(provider: UsageCommandOptions["provider"]): ProviderId[] | undefined {
  if (!provider) {
    return undefined;
  }
  return Array.isArray(provider) ? provider : [provider];
}

export async function runUsageCommand(
  options: UsageCommandOptions = {},
  dependencies: UsageCommandDependencies = {},
): Promise<string> {
  const snapshot = await createUsageSnapshot({
    provider: normalizeProviders(options.provider),
    refresh: Boolean(options.refresh),
    diagnostics: Boolean(options.diagnostics),
  }, dependencies);

  if (options.json) {
    return JSON.stringify(snapshotEnvelopeSchema.parse(snapshot), null, options.pretty ? 2 : 0);
  }

  return formatSnapshotAsText(snapshotEnvelopeSchema.parse(snapshot), {
    includeDiagnostics: Boolean(options.diagnostics),
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
registerDoctorCommand(program);
registerServiceCommand(program);

if (import.meta.url === `file://${process.argv[1]}`) {
  program.parseAsync(process.argv).catch((error: unknown) => {
    const message = formatConfigCommandError(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}

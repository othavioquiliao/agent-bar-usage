import type { Command } from "commander";

import { formatSnapshotAsText } from "../formatters/text-formatter.js";
import { createUsageSnapshot } from "../core/usage-snapshot.js";
import { loadBackendConfig } from "../config/config-loader.js";
import { resolveServiceSocketPath } from "../service/socket-path.js";
import {
  probeServiceStatus,
  requestServiceRefresh,
  requestServiceSnapshot,
} from "../service/service-client.js";
import { createAgentBarServiceRuntime } from "../service/service-server.js";

export interface ServiceCommandOptions {
  json?: boolean;
  pretty?: boolean;
}

function stringifySnapshot(snapshot: unknown, pretty = false): string {
  return JSON.stringify(snapshot, null, pretty ? 2 : 0);
}

async function getFallbackSnapshot(
  refresh = false,
  options: ServiceCommandOptions = {},
): Promise<string> {
  const snapshot = await createUsageSnapshot({
    refresh,
    json: true,
    diagnostics: true,
  });

  return options.json ? stringifySnapshot(snapshot, Boolean(options.pretty)) : formatSnapshotAsText(snapshot, {
    includeDiagnostics: true,
  });
}

async function executeSnapshotCommand(refresh = false, options: ServiceCommandOptions = {}): Promise<string> {
  const socketPath = resolveServiceSocketPath();
  const status = await probeServiceStatus(socketPath);

  if (!status?.running) {
    return await getFallbackSnapshot(refresh, options);
  }

  const snapshot = refresh
    ? await requestServiceRefresh(socketPath)
    : await requestServiceSnapshot(socketPath);

  return options.json ? stringifySnapshot(snapshot, Boolean(options.pretty)) : formatSnapshotAsText(snapshot, {
    includeDiagnostics: true,
  });
}

export async function runServiceSnapshotCommand(options: ServiceCommandOptions = {}): Promise<string> {
  return await executeSnapshotCommand(false, options);
}

export async function runServiceRefreshCommand(options: ServiceCommandOptions = {}): Promise<string> {
  return await executeSnapshotCommand(true, options);
}

export async function runServiceStatusCommand(options: ServiceCommandOptions = {}): Promise<string> {
  const socketPath = resolveServiceSocketPath();
  const status = (await probeServiceStatus(socketPath)) ?? {
    mode: "cli" as const,
    socket_path: socketPath,
    running: false,
    last_error: null,
  };

  if (options.json) {
    return stringifySnapshot(status, Boolean(options.pretty));
  }

  const lines = [
    "Agent Bar Service",
    `mode: ${status.mode}`,
    `socket_path: ${status.socket_path}`,
    `running: ${status.running}`,
    `last_error: ${status.last_error ?? "none"}`,
  ];

  if ("last_snapshot_at" in status && status.last_snapshot_at) {
    lines.push(`last_snapshot_at: ${status.last_snapshot_at}`);
  }

  return lines.join("\n");
}

export function registerServiceCommand(program: Command): void {
  const serviceCommand = program
    .command("service")
    .description("Run and inspect the local backend service.");

  serviceCommand
    .command("run")
    .description("Run the backend service on the local Unix socket.")
    .action(async () => {
      const runtime = createAgentBarServiceRuntime({
        env: process.env,
      });

      await runtime.start();
      process.stdout.write(`agent-bar service listening on ${runtime.socketPath}\n`);

      await new Promise<void>((resolve) => {
        const stop = async () => {
          await runtime.stop();
          resolve();
        };

        process.once("SIGTERM", stop);
        process.once("SIGINT", stop);
      });
    });

  serviceCommand
    .command("status")
    .description("Inspect backend service readiness and socket state.")
    .option("--json", "Emit machine-readable JSON")
    .option("--pretty", "Pretty-print JSON output")
    .action(async (options: ServiceCommandOptions) => {
      const output = await runServiceStatusCommand(options);
      process.stdout.write(`${output}\n`);
    });

  serviceCommand
    .command("snapshot")
    .description("Fetch a snapshot from the backend service.")
    .option("--json", "Emit machine-readable JSON")
    .option("--pretty", "Pretty-print JSON output")
    .action(async (options: ServiceCommandOptions) => {
      const output = await runServiceSnapshotCommand(options);
      process.stdout.write(`${output}\n`);
    });

  serviceCommand
    .command("refresh")
    .description("Force a fresh snapshot from the backend service.")
    .option("--json", "Emit machine-readable JSON")
    .option("--pretty", "Pretty-print JSON output")
    .action(async (options: ServiceCommandOptions) => {
      const output = await runServiceRefreshCommand(options);
      process.stdout.write(`${output}\n`);
    });
}

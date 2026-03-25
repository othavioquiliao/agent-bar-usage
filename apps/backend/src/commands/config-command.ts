import type { Command } from "commander";

import {
  ConfigLoadError,
  loadBackendConfig,
  loadSanitizedBackendConfig,
} from "../config/config-loader.js";

export interface RegisterConfigCommandOptions {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
}

interface ConfigCommandRuntimeOptions {
  path?: string;
}

export function registerConfigCommand(program: Command, options: RegisterConfigCommandOptions = {}): void {
  const configCommand = program
    .command("config")
    .description("Validate and inspect backend configuration.");

  configCommand
    .command("validate")
    .description("Validate config schema and path resolution.")
    .option("--path <path>", "Use an explicit config path")
    .action(async (runtimeOptions: ConfigCommandRuntimeOptions) => {
      const loaded = await loadBackendConfig({
        env: options.env,
        homeDir: options.homeDir,
        explicitPath: runtimeOptions.path,
      });

      const source = loaded.exists ? "file" : "defaults";
      process.stdout.write(`config: valid (${source}) ${loaded.path}\n`);
    });

  configCommand
    .command("dump")
    .description("Dump sanitized effective config as JSON.")
    .option("--path <path>", "Use an explicit config path")
    .action(async (runtimeOptions: ConfigCommandRuntimeOptions) => {
      const dumped = await loadSanitizedBackendConfig({
        env: options.env,
        homeDir: options.homeDir,
        explicitPath: runtimeOptions.path,
      });

      process.stdout.write(`${JSON.stringify(dumped, null, 2)}\n`);
    });
}

export function formatConfigCommandError(error: unknown): string {
  if (error instanceof ConfigLoadError) {
    return `${error.message} [${error.code}]`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown config command failure.";
}

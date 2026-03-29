import { ConfigLoadError, loadBackendConfig, loadSanitizedBackendConfig } from '../config/config-loader.js';

export interface RegisterConfigCommandOptions {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
}

interface ConfigCommandRuntimeOptions {
  path?: string;
}

export async function runConfigValidateCommand(
  runtimeOptions: ConfigCommandRuntimeOptions = {},
  options: RegisterConfigCommandOptions = {},
): Promise<string> {
  const loaded = await loadBackendConfig({
    env: options.env,
    homeDir: options.homeDir,
    explicitPath: runtimeOptions.path,
  });

  const source = loaded.exists ? 'file' : 'defaults';
  return `config: valid (${source}) ${loaded.path}`;
}

export async function runConfigDumpCommand(
  runtimeOptions: ConfigCommandRuntimeOptions = {},
  options: RegisterConfigCommandOptions = {},
): Promise<string> {
  const dumped = await loadSanitizedBackendConfig({
    env: options.env,
    homeDir: options.homeDir,
    explicitPath: runtimeOptions.path,
  });

  return JSON.stringify(dumped, null, 2);
}

export function formatConfigCommandError(error: unknown): string {
  if (error instanceof ConfigLoadError) {
    return `${error.message} [${error.code}]`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown config command failure.';
}

import os from "node:os";
import path from "node:path";

export const CONFIG_DIR_NAME = "agent-bar";
export const CONFIG_FILE_NAME = "config.json";

export interface ResolveConfigPathOptions {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
  explicitPath?: string;
}

export function resolveBackendConfigPath(options: ResolveConfigPathOptions = {}): string {
  if (options.explicitPath) {
    return path.resolve(options.explicitPath);
  }

  const env = options.env ?? process.env;
  const xdgConfigHome = env.XDG_CONFIG_HOME;
  const configRoot =
    xdgConfigHome && xdgConfigHome.trim().length > 0
      ? xdgConfigHome
      : path.join(options.homeDir ?? os.homedir(), ".config");

  return path.join(configRoot, CONFIG_DIR_NAME, CONFIG_FILE_NAME);
}

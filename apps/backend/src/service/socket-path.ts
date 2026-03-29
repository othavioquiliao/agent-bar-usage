import os from 'node:os';
import path from 'node:path';

export const SERVICE_SOCKET_NAME = 'service.sock';
export const SERVICE_SOCKET_DIR_NAME = 'agent-bar';

export interface ResolveServiceSocketPathOptions {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
}

export function resolveServiceSocketPath(options: ResolveServiceSocketPathOptions = {}): string {
  const env = options.env ?? process.env;
  const runtimeDir = env.XDG_RUNTIME_DIR?.trim();

  if (runtimeDir) {
    return path.join(runtimeDir, SERVICE_SOCKET_DIR_NAME, SERVICE_SOCKET_NAME);
  }

  const fallbackRoot = options.homeDir ?? os.tmpdir();
  return path.join(fallbackRoot, SERVICE_SOCKET_DIR_NAME, SERVICE_SOCKET_NAME);
}

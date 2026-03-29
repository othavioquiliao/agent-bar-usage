import os from 'node:os';
import path from 'node:path';

export const CACHE_DIR_NAME = 'agent-bar';
export const SNAPSHOT_CACHE_DIR_NAME = 'snapshots';

export interface ResolveCachePathOptions {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
  explicitCacheDir?: string;
}

export function resolveSnapshotCacheDir(options: ResolveCachePathOptions = {}): string {
  if (options.explicitCacheDir) {
    return path.resolve(options.explicitCacheDir);
  }

  const env = options.env ?? process.env;
  const cacheRoot =
    env.XDG_CACHE_HOME && env.XDG_CACHE_HOME.trim().length > 0
      ? env.XDG_CACHE_HOME
      : path.join(options.homeDir ?? os.homedir(), '.cache');

  return path.join(cacheRoot, CACHE_DIR_NAME, SNAPSHOT_CACHE_DIR_NAME);
}

export function resolveLatestSnapshotPath(options: ResolveCachePathOptions = {}): string {
  return path.join(resolveSnapshotCacheDir(options), 'latest-snapshot.json');
}

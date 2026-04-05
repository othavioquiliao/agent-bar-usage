import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { access, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';

import { assertSnapshotEnvelope, type SnapshotEnvelope } from 'shared-contract';

import { resolveLatestSnapshotPath } from '../cache/cache-path.js';
import { atomicWriteFileSync } from '../utils/atomic-write.js';
import { loadBackendConfig } from '../config/config-loader.js';
import { createUsageSnapshot, type UsageCommandOptions } from '../core/usage-snapshot.js';
import { resolveServiceSocketPath } from './socket-path.js';

export interface ServiceRequestPayload {
  type: 'status' | 'snapshot' | 'refresh';
  request?: UsageCommandOptions;
}

export interface ServiceStatusPayload {
  mode: 'service';
  socket_path: string;
  running: boolean;
  last_error: string | null;
  last_snapshot_at?: string | null;
}

export interface ServiceResponse<T = unknown> {
  ok: boolean;
  type: string;
  status?: ServiceStatusPayload;
  snapshot?: T;
  error?: {
    code?: string;
    message: string;
    details?: unknown;
  };
}

export interface ServiceServerOptions {
  env?: NodeJS.ProcessEnv;
  socketPath?: string;
  snapshotStatePath?: string;
  refreshIntervalMs?: number;
  scheduler?: {
    setInterval: (callback: () => void, intervalMs: number) => unknown;
    clearInterval: (handle: unknown) => void;
  };
  now?: () => Date;
  createSnapshot?: (options: UsageCommandOptions) => Promise<SnapshotEnvelope> | SnapshotEnvelope;
}

export interface AgentBarServiceRuntime {
  socketPath: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  status(): ServiceStatusPayload;
}

async function isSocketPresent(socketPath: string): Promise<boolean> {
  try {
    await access(socketPath);
    return true;
  } catch {
    return false;
  }
}

function toErrorResponse(type: string, error: unknown): ServiceResponse {
  return {
    ok: false,
    type,
    error: {
      message: error instanceof Error ? error.message : 'Unknown service error.',
      details: error instanceof Error ? { name: error.name } : error,
    },
  };
}

function defaultScheduler() {
  return {
    setInterval(callback: () => void, intervalMs: number) {
      return globalThis.setInterval(callback, intervalMs);
    },
    clearInterval(handle: unknown) {
      globalThis.clearInterval(handle as Timer);
    },
  };
}

function readLatestSnapshot(snapshotStatePath: string): SnapshotEnvelope | null {
  if (!existsSync(snapshotStatePath)) {
    return null;
  }

  try {
    return assertSnapshotEnvelope(JSON.parse(readFileSync(snapshotStatePath, 'utf8')));
  } catch {
    return null;
  }
}

function persistLatestSnapshot(snapshotStatePath: string, snapshot: SnapshotEnvelope): void {
  mkdirSync(path.dirname(snapshotStatePath), { recursive: true });
  atomicWriteFileSync(snapshotStatePath, `${JSON.stringify(snapshot, null, 2)}\n`);
}

export function createAgentBarServiceRuntime(options: ServiceServerOptions = {}): AgentBarServiceRuntime {
  const socketPath = options.socketPath ?? resolveServiceSocketPath({ env: options.env });
  const socketDir = path.dirname(socketPath);
  const snapshotStatePath = options.snapshotStatePath ?? resolveLatestSnapshotPath({ env: options.env });
  const scheduler = options.scheduler ?? defaultScheduler();
  let lastError: string | null = null;
  let lastSnapshotAt: string | null = null;
  let lastSnapshot: SnapshotEnvelope | null = null;
  let server: ReturnType<typeof Bun.listen> | null = null;
  let refreshHandle: unknown = null;
  let refreshInFlight: Promise<SnapshotEnvelope> | null = null;
  let refreshIntervalMs = options.refreshIntervalMs ?? 150_000;
  const now = options.now ?? (() => new Date());

  const status = (): ServiceStatusPayload => ({
    mode: 'service',
    socket_path: socketPath,
    running: server !== null,
    last_error: lastError,
    last_snapshot_at: lastSnapshotAt,
  });

  const rememberSnapshot = (snapshot: SnapshotEnvelope): SnapshotEnvelope => {
    lastSnapshot = snapshot;
    lastSnapshotAt = snapshot.generated_at;
    lastError = null;
    persistLatestSnapshot(snapshotStatePath, snapshot);
    return snapshot;
  };

  const refreshSnapshot = async (forceRefresh: boolean): Promise<SnapshotEnvelope> => {
    if (refreshInFlight) {
      return refreshInFlight;
    }

    refreshInFlight = Promise.resolve(
      (options.createSnapshot ?? createUsageSnapshot)({
        json: true,
        diagnostics: true,
        refresh: forceRefresh,
      }),
    )
      .then((snapshot) => rememberSnapshot(snapshot))
      .catch((error: unknown) => {
        lastError = error instanceof Error ? error.message : 'Unknown service error.';
        throw error;
      })
      .finally(() => {
        refreshInFlight = null;
      });

    return refreshInFlight;
  };

  const clearRefreshTimer = () => {
    if (refreshHandle !== null) {
      scheduler.clearInterval(refreshHandle);
      refreshHandle = null;
    }
  };

  const startRefreshTimer = () => {
    clearRefreshTimer();
    refreshHandle = scheduler.setInterval(() => {
      void refreshSnapshot(true).catch((err: unknown) => {
        console.error('[agent-bar] Background refresh failed:', err instanceof Error ? err.message : err);
      });
    }, refreshIntervalMs);
  };

  async function handleRequest(payload: ServiceRequestPayload): Promise<ServiceResponse> {
    try {
      switch (payload.type) {
        case 'status':
          return {
            ok: true,
            type: 'status',
            status: status(),
          };
        case 'snapshot': {
          if (lastSnapshot) {
            return { ok: true, type: 'snapshot', snapshot: lastSnapshot, status: status() };
          }
          const emptyEnvelope: SnapshotEnvelope = {
            schema_version: '1' as const,
            generated_at: now().toISOString(),
            providers: [],
          };
          return { ok: true, type: 'snapshot', snapshot: emptyEnvelope, status: status() };
        }
        case 'refresh': {
          const snapshot = await refreshSnapshot(true);
          return {
            ok: true,
            type: 'refresh',
            snapshot,
            status: status(),
          };
        }
        default:
          throw new Error(`Unsupported service request: ${(payload as { type?: string }).type ?? 'unknown'}`);
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown service error.';
      return toErrorResponse(payload.type, error);
    }
  }

  return {
    socketPath,
    async start() {
      if (server !== null) {
        return;
      }

      await mkdir(socketDir, { recursive: true });
      if (await isSocketPresent(socketPath)) {
        await unlink(socketPath).catch(() => {
          // Best-effort: stale socket may already be gone
        });
      }

      if (options.refreshIntervalMs === undefined) {
        try {
          const loadedConfig = await loadBackendConfig({ env: options.env });
          refreshIntervalMs = loadedConfig.config.defaults.ttlSeconds * 1000;
        } catch {
          refreshIntervalMs = 150_000;
        }
      }

      const persistedSnapshot = readLatestSnapshot(snapshotStatePath);
      if (persistedSnapshot) {
        lastSnapshot = persistedSnapshot;
        lastSnapshotAt = persistedSnapshot.generated_at;
        lastError = null;
      }

      server = Bun.listen<{ buffer: string }>({
        unix: socketPath,
        socket: {
          open(socket) {
            socket.data = { buffer: '' };
          },
          data(socket, data) {
            socket.data.buffer += data.toString();
            const idx = socket.data.buffer.indexOf('\n');
            if (idx === -1) return;

            const rawRequest = socket.data.buffer.slice(0, idx);
            socket.data.buffer = socket.data.buffer.slice(idx + 1);

            handleRequest(JSON.parse(rawRequest) as ServiceRequestPayload)
              .then((response) => {
                socket.write(`${JSON.stringify(response)}\n`);
                socket.end();
              })
              .catch((error) => {
                socket.write(`${JSON.stringify(toErrorResponse('unknown', error))}\n`);
                socket.end();
              });
          },
          close() {},
          error(_socket, error) {
            console.error('Socket error:', error);
          },
        },
      });

      startRefreshTimer();
      void refreshSnapshot(true).catch((err: unknown) => {
        console.error('[agent-bar] Initial refresh failed:', err instanceof Error ? err.message : err);
      });
    },
    async stop() {
      if (!server) {
        clearRefreshTimer();
        return;
      }
      server.stop();
      server = null;
      clearRefreshTimer();
    },
    status,
  };
}

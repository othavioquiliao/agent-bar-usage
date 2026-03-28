import { access, mkdir, unlink } from "node:fs/promises";
import path from "node:path";

import { type SnapshotEnvelope } from "shared-contract";

import { createUsageSnapshot, type UsageCommandOptions } from "../core/usage-snapshot.js";
import { resolveServiceSocketPath } from "./socket-path.js";

export interface ServiceRequestPayload {
  type: "status" | "snapshot" | "refresh";
  request?: UsageCommandOptions;
}

export interface ServiceStatusPayload {
  mode: "service";
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
      message: error instanceof Error ? error.message : "Unknown service error.",
      details: error instanceof Error ? { name: error.name } : error,
    },
  };
}

export function createAgentBarServiceRuntime(options: ServiceServerOptions = {}): AgentBarServiceRuntime {
  const socketPath = options.socketPath ?? resolveServiceSocketPath({ env: options.env });
  const socketDir = path.dirname(socketPath);
  let lastError: string | null = null;
  let lastSnapshotAt: string | null = null;
  let lastSnapshot: SnapshotEnvelope | null = null;
  let server: ReturnType<typeof Bun.listen> | null = null;
  const now = options.now ?? (() => new Date());

  const status = (): ServiceStatusPayload => ({
    mode: "service",
    socket_path: socketPath,
    running: server !== null,
    last_error: lastError,
    last_snapshot_at: lastSnapshotAt,
  });

  async function handleRequest(payload: ServiceRequestPayload): Promise<ServiceResponse> {
    try {
      switch (payload.type) {
        case "status":
          return {
            ok: true,
            type: "status",
            status: status(),
          };
        case "snapshot": {
          if (lastSnapshot) {
            return { ok: true, type: "snapshot", snapshot: lastSnapshot, status: status() };
          }
          const emptyEnvelope: SnapshotEnvelope = {
            schema_version: "1" as const,
            generated_at: now().toISOString(),
            providers: [],
          };
          return { ok: true, type: "snapshot", snapshot: emptyEnvelope, status: status() };
        }
        case "refresh": {
          const requestOptions = {
            ...(payload.request ?? {}),
            json: true,
            diagnostics: true,
            refresh: true,
          };
          const snapshot = await (options.createSnapshot ?? createUsageSnapshot)(requestOptions);
          lastError = null;
          lastSnapshot = snapshot;
          lastSnapshotAt = snapshot.generated_at;
          return {
            ok: true,
            type: "refresh",
            snapshot,
            status: status(),
          };
        }
        default:
          throw new Error(`Unsupported service request: ${(payload as { type?: string }).type ?? "unknown"}`);
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown service error.";
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
        await unlink(socketPath).catch(() => undefined);
      }

      server = Bun.listen<{ buffer: string }>({
        unix: socketPath,
        socket: {
          open(socket) {
            socket.data = { buffer: "" };
          },
          data(socket, data) {
            socket.data.buffer += data.toString();
            const idx = socket.data.buffer.indexOf("\n");
            if (idx === -1) return;

            const rawRequest = socket.data.buffer.slice(0, idx);
            socket.data.buffer = socket.data.buffer.slice(idx + 1);

            handleRequest(JSON.parse(rawRequest) as ServiceRequestPayload)
              .then((response) => {
                socket.write(JSON.stringify(response) + "\n");
                socket.end();
              })
              .catch((error) => {
                socket.write(JSON.stringify(toErrorResponse("unknown", error)) + "\n");
                socket.end();
              });
          },
          close() {},
          error(_socket, error) {
            console.error("Socket error:", error);
          },
        },
      });

      // Warm the cache so the first snapshot request is instant.
      Promise.resolve(
        (options.createSnapshot ?? createUsageSnapshot)({
          json: true,
          diagnostics: true,
          refresh: true,
        }),
      )
        .then((snapshot: SnapshotEnvelope) => {
          lastSnapshot = snapshot;
          lastSnapshotAt = snapshot.generated_at;
          lastError = null;
        })
        .catch((error: unknown) => {
          lastError = error instanceof Error ? error.message : "Warmup fetch failed.";
        });
    },
    async stop() {
      if (!server) {
        return;
      }
      server.stop();
      server = null;
    },
    status,
  };
}

import { access, mkdir, unlink } from "node:fs/promises";
import net from "node:net";
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
  server: net.Server;
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
  let server: net.Server | null = null;

  const status = (): ServiceStatusPayload => ({
    mode: "service",
    socket_path: socketPath,
    running: Boolean(server?.listening),
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
        case "refresh":
        case "snapshot": {
          const requestOptions = {
            ...(payload.request ?? {}),
            json: true,
            diagnostics: true,
            refresh: payload.type === "refresh" || Boolean(payload.request?.refresh),
          };
          const snapshot = await (options.createSnapshot ?? createUsageSnapshot)(requestOptions);
          lastError = null;
          lastSnapshotAt = snapshot.generated_at;
          return {
            ok: true,
            type: payload.type,
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
    get server() {
      if (!server) {
        throw new Error("Service runtime has not been started.");
      }
      return server;
    },
    async start() {
      if (server?.listening) {
        return;
      }

      await mkdir(socketDir, { recursive: true });
      if (await isSocketPresent(socketPath)) {
        await unlink(socketPath).catch(() => undefined);
      }

      server = net.createServer((socket) => {
        let buffer = "";
        let handled = false;
        socket.setEncoding("utf8");

        socket.on("data", async (chunk: string) => {
          if (handled) {
            return;
          }

          buffer += chunk;
          if (!buffer.includes("\n")) {
            return;
          }

          handled = true;
          const [rawRequest] = buffer.split("\n");
          try {
            const request = JSON.parse(rawRequest) as ServiceRequestPayload;
            const response = await handleRequest(request);
            socket.end(`${JSON.stringify(response)}\n`);
          } catch (error) {
            socket.end(`${JSON.stringify(toErrorResponse("unknown", error))}\n`);
          }
        });
      });

      await new Promise<void>((resolve, reject) => {
        server?.once("error", reject);
        server?.listen(socketPath, resolve);
      });
    },
    async stop() {
      if (!server) {
        return;
      }

      await new Promise<void>((resolve) => {
        server?.close(() => resolve());
      });
      server = null;
    },
    status,
  };
}

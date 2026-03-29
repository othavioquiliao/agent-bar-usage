import { assertSnapshotEnvelope, type SnapshotEnvelope } from 'shared-contract';

export interface ServiceStatusPayload {
  mode: 'cli' | 'service' | 'unknown';
  socket_path: string;
  running: boolean;
  last_error: string | null;
  last_snapshot_at?: string | null;
}

export interface ServiceWireRequest {
  type: 'status' | 'snapshot' | 'refresh';
  request?: Record<string, unknown>;
}

export interface ServiceWireResponse<T = unknown> {
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

export class ServiceClientError extends Error {
  constructor(
    message: string,
    readonly socketPath: string,
    readonly causeValue?: unknown,
  ) {
    super(message);
    this.name = 'ServiceClientError';
  }
}

function readSocketResponse(socketPath: string, request: ServiceWireRequest, timeoutMs = 15_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let settled = false;

    const finalize = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };

    const timer = setTimeout(() => {
      finalize(() => {
        reject(new ServiceClientError(`Timed out waiting for service response at ${socketPath}.`, socketPath));
      });
    }, timeoutMs);

    Bun.connect<void>({
      unix: socketPath,
      socket: {
        open(socket) {
          socket.write(`${JSON.stringify(request)}\n`);
        },
        data(_socket, data) {
          buffer += data.toString();
          const newlineIndex = buffer.indexOf('\n');
          if (newlineIndex === -1) return;

          const rawResponse = buffer.slice(0, newlineIndex).trim();
          finalize(() => resolve(rawResponse));
        },
        close() {
          const rawResponse = buffer.trim();
          if (!rawResponse) return;
          finalize(() => resolve(rawResponse));
        },
        error(_socket, error) {
          finalize(() => reject(new ServiceClientError(`Could not connect to ${socketPath}.`, socketPath, error)));
        },
        connectError(_socket, error) {
          finalize(() => reject(new ServiceClientError(`Could not connect to ${socketPath}.`, socketPath, error)));
        },
      },
    });
  });
}

async function sendServiceRequest<T = unknown>(
  socketPath: string,
  request: ServiceWireRequest,
  timeoutMs?: number,
): Promise<ServiceWireResponse<T>> {
  const raw = await readSocketResponse(socketPath, request, timeoutMs);

  if (!raw) {
    throw new ServiceClientError(`Empty response from service at ${socketPath}.`, socketPath);
  }

  let parsed: ServiceWireResponse<T>;
  try {
    parsed = JSON.parse(raw) as ServiceWireResponse<T>;
  } catch (cause) {
    throw new ServiceClientError(`Invalid JSON response from service at ${socketPath}.`, socketPath, cause);
  }

  if (!parsed.ok) {
    throw new ServiceClientError(parsed.error?.message ?? 'Service request failed.', socketPath, parsed.error);
  }

  return parsed;
}

export async function requestServiceStatus(socketPath: string, timeoutMs?: number): Promise<ServiceStatusPayload> {
  const response = await sendServiceRequest<ServiceStatusPayload>(socketPath, { type: 'status' }, timeoutMs);
  if (!response.status) {
    throw new ServiceClientError(`Service status response missing status payload at ${socketPath}.`, socketPath);
  }
  return response.status;
}

export async function requestServiceSnapshot(
  socketPath: string,
  request: Record<string, unknown> = {},
  timeoutMs?: number,
): Promise<SnapshotEnvelope> {
  const response = await sendServiceRequest<SnapshotEnvelope>(socketPath, { type: 'snapshot', request }, timeoutMs);
  return assertSnapshotEnvelope(response.snapshot);
}

export async function requestServiceRefresh(
  socketPath: string,
  request: Record<string, unknown> = {},
  timeoutMs?: number,
): Promise<SnapshotEnvelope> {
  const response = await sendServiceRequest<SnapshotEnvelope>(socketPath, { type: 'refresh', request }, timeoutMs);
  return assertSnapshotEnvelope(response.snapshot);
}

export async function probeServiceStatus(socketPath: string, timeoutMs?: number): Promise<ServiceStatusPayload | null> {
  try {
    return await requestServiceStatus(socketPath, timeoutMs);
  } catch {
    return null;
  }
}

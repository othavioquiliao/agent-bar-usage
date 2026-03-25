import type {
  ProviderError,
  ProviderId,
  ProviderSnapshot,
  ProviderSourceMode,
} from "shared-contract";

import type { BackendRequest } from "../config/backend-request.js";
import type { runSubprocess } from "../utils/subprocess.js";

export interface ProviderAdapterContext {
  request: BackendRequest;
  providerId: ProviderId;
  sourceMode: ProviderSourceMode;
  env: NodeJS.ProcessEnv;
  now: () => Date;
  runSubprocess: typeof runSubprocess;
}

export interface ProviderAdapter {
  id: ProviderId;
  defaultSourceMode?: ProviderSourceMode;
  isAvailable(context: ProviderAdapterContext): Promise<boolean>;
  fetch(context: ProviderAdapterContext): Promise<ProviderSnapshot>;
}

export function createProviderError(code: string, message: string, retryable = false): ProviderError {
  return {
    code,
    message,
    retryable,
  };
}

export function createUnavailableSnapshot(
  provider: ProviderId,
  source: ProviderSourceMode,
  updatedAt: string,
  error = createProviderError("provider_unavailable", `${provider} is not available on this host.`),
): ProviderSnapshot {
  return {
    provider,
    status: "unavailable",
    source,
    updated_at: updatedAt,
    usage: null,
    reset_window: null,
    error,
  };
}

export function createErrorSnapshot(
  provider: ProviderId,
  source: ProviderSourceMode,
  updatedAt: string,
  error: ProviderError,
): ProviderSnapshot {
  return {
    provider,
    status: "error",
    source,
    updated_at: updatedAt,
    usage: null,
    reset_window: null,
    error,
  };
}

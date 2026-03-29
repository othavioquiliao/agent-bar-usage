import { assertRefreshRequest, type ProviderId, type ProviderSourceMode, type RefreshRequest } from 'shared-contract';

export const DEFAULT_TTL_SECONDS = 150;

export interface BackendRequest {
  providers: ProviderId[] | null;
  sourceMode: ProviderSourceMode;
  forceRefresh: boolean;
  includeDiagnostics: boolean;
  ttlSeconds: number;
}

export function normalizeBackendRequest(input: Partial<RefreshRequest> = {}): BackendRequest {
  const parsed = assertRefreshRequest({
    ttl_seconds: DEFAULT_TTL_SECONDS,
    ...input,
  });

  return {
    providers: parsed.providers.length > 0 ? Array.from(new Set(parsed.providers)) : null,
    sourceMode: parsed.source_mode_override,
    forceRefresh: parsed.force_refresh,
    includeDiagnostics: parsed.include_diagnostics,
    ttlSeconds: parsed.ttl_seconds,
  };
}

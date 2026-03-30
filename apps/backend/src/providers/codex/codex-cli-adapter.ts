import type { ProviderSnapshot } from 'shared-contract';

import type { ProviderAdapter, ProviderAdapterContext } from '../../core/provider-adapter.js';
import { createConnectedAccount } from '../../core/provider-adapter.js';
import { createUnavailableSnapshot } from '../../core/provider-adapter.js';
import { fetchCodexUsageViaAppServer } from './codex-appserver-fetcher.js';
import { fetchCodexUsage } from './codex-cli-fetcher.js';
import { resolveCodexConnectedAccount } from './codex-credentials.js';

export function createCodexCliAdapter(): ProviderAdapter {
  return {
    id: 'codex',
    name: 'Codex',
    cacheKey: 'codex-quota',
    defaultSourceMode: 'auto',
    async isAvailable(context: ProviderAdapterContext): Promise<boolean> {
      return context.sourceMode === 'cli' || context.sourceMode === 'auto';
    },
    async getQuota(context: ProviderAdapterContext) {
      const connectedAccount = await resolveCodexConnectedAccount();

      if (context.sourceMode === 'cli') {
        return withConnectedAccount(await fetchCodexUsage(context), connectedAccount);
      }

      if (context.sourceMode !== 'auto') {
        return createUnavailableSnapshot(context.providerId, context.sourceMode, context.now().toISOString());
      }

      // In auto mode, prefer the app-server path but keep the PTY CLI path as a fallback.
      const appServerResult = await fetchCodexUsageViaAppServer({ env: context.env });
      if (!appServerResult.error) {
        return withConnectedAccount(appServerResult, connectedAccount);
      }

      return withConnectedAccount(await fetchCodexUsage(context), connectedAccount);
    },
  };
}

function withConnectedAccount(snapshot: ProviderSnapshot, connectedAccount: NonNullable<ProviderSnapshot['connected_account']>) {
  if (snapshot.error?.code === 'codex_auth_expired') {
    return {
      ...snapshot,
      connected_account: createConnectedAccount('missing'),
    };
  }

  return {
    ...snapshot,
    connected_account: connectedAccount,
  };
}

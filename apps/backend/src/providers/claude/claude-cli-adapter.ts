import type { ProviderSnapshot } from 'shared-contract';

import type { ProviderAdapter, ProviderAdapterContext } from '../../core/provider-adapter.js';
import {
  createConnectedAccount,
  createErrorSnapshot,
  createProviderError,
  createUnavailableSnapshot,
} from '../../core/provider-adapter.js';
import { fetchClaudeUsageViaApi } from './claude-api-fetcher.js';
import { readClaudeCredentials, resolveClaudeConnectedAccount } from './claude-credentials.js';

export function createClaudeCliAdapter(): ProviderAdapter {
  return {
    id: 'claude',
    name: 'Claude',
    cacheKey: 'claude-quota',
    defaultSourceMode: 'auto',
    async isAvailable(context: ProviderAdapterContext): Promise<boolean> {
      return context.sourceMode === 'cli' || context.sourceMode === 'auto' || context.sourceMode === 'api';
    },
    async getQuota(context: ProviderAdapterContext) {
      if (context.sourceMode === 'api' || context.sourceMode === 'auto') {
        const connectedAccount = await resolveClaudeConnectedAccount();
        const credentials = context.sourceMode === 'auto' ? await readClaudeCredentials() : undefined;
        const snapshot = await fetchClaudeUsageViaApi(
          context.sourceMode === 'auto'
            ? {
                credentials,
              }
            : {},
        );

        return withConnectedAccount(snapshot, connectedAccount);
      }

      if (context.sourceMode === 'cli') {
        return createErrorSnapshot(
          context.providerId,
          context.sourceMode,
          context.now().toISOString(),
          createProviderError(
            'claude_cli_removed',
            "Claude CLI interactive fetcher was removed (no longer supported in Claude v2.1+). Set sourceMode to 'auto' or 'api' in config.",
            false,
          ),
        );
      }

      return createUnavailableSnapshot(context.providerId, context.sourceMode, context.now().toISOString());
    },
  };
}

function withConnectedAccount(snapshot: ProviderSnapshot, connectedAccount: NonNullable<ProviderSnapshot['connected_account']>) {
  const errorCode = snapshot.error?.code ?? null;
  if (errorCode === 'claude_auth_expired' || errorCode === 'claude_cli_missing') {
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

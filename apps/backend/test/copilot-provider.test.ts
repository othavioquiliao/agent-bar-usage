import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeBackendRequest } from '../src/config/backend-request.js';
import type { ProviderAdapterContext } from '../src/core/provider-adapter.js';
import { createCopilotAdapter } from '../src/providers/copilot/copilot-adapter.js';

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

describe('Copilot provider', () => {
  afterEach(() => {
    fetchMock.mockReset();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('returns a provider-level error when no token is available', async () => {
    const adapter = createCopilotAdapter();
    const snapshot = await adapter.getQuota(createContext({ env: {} }));

    expect(snapshot.status).toBe('error');
    expect(snapshot.error?.code).toBe('copilot_token_missing');
    expect(snapshot.connected_account).toEqual({ status: 'missing' });
    expect(snapshot.usage).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps auth failures to a structured provider error', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 401 }));

    const adapter = createCopilotAdapter();
    const snapshot = await adapter.getQuota(
      createContext({
        env: {
          COPILOT_API_TOKEN: 'token-123',
        },
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.github.com/copilot_internal/user');
    expect(snapshot.status).toBe('error');
    expect(snapshot.error?.code).toBe('copilot_auth_failed');
    expect(snapshot.error?.retryable).toBe(false);
    expect(snapshot.connected_account).toEqual({ status: 'missing' });
  });

  it('maps usage snapshots from the GitHub Copilot API', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            login: 'octocat',
          },
          quotaSnapshots: {
            premiumInteractions: {
              percentRemaining: 25,
              resetsAt: '2026-03-25T16:00:00.000Z',
              label: 'premium interactions',
            },
            chat: {
              percentRemaining: 60,
            },
          },
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );

    const adapter = createCopilotAdapter();
    const snapshot = await adapter.getQuota(
      createContext({
        env: {
          COPILOT_API_TOKEN: 'token-123',
        },
      }),
    );

    expect(snapshot.status).toBe('ok');
    expect(snapshot.source).toBe('api');
    expect(snapshot.usage).toEqual({
      kind: 'quota',
      used: 75,
      limit: 100,
      percent_used: 75,
    });
    expect(snapshot.reset_window).toEqual({
      resets_at: '2026-03-25T16:00:00.000Z',
      label: 'premium interactions',
    });
    expect(snapshot.connected_account).toEqual({
      status: 'connected',
      label: 'octocat',
    });
    expect(snapshot.diagnostics?.attempts[0]?.strategy).toBe('copilot.api');
  });
});

function createContext(options: { env: NodeJS.ProcessEnv }): ProviderAdapterContext {
  return {
    request: normalizeBackendRequest({
      providers: ['copilot'],
    }),
    providerId: 'copilot',
    sourceMode: 'api',
    env: options.env,
    now: () => new Date('2026-03-25T15:00:00Z'),
    runSubprocess: async () => {
      throw new Error('runSubprocess should not be called in Copilot tests.');
    },
  };
}

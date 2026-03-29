import { describe, expect, it, vi } from 'vitest';

import { applyProviderSelection, runProvidersCommand } from '../src/commands/providers-command.js';
import type { BackendConfig } from '../src/config/config-schema.js';

describe('providers command', () => {
  it('reorders enabled providers first and preserves existing provider settings', () => {
    const config: BackendConfig = {
      schemaVersion: 1,
      defaults: {
        ttlSeconds: 150,
      },
      providers: [
        {
          id: 'codex',
          enabled: true,
          sourceMode: 'cli',
          secretRef: {
            store: 'env',
            env: 'CODEX_TOKEN',
          },
        },
        {
          id: 'claude',
          enabled: true,
          sourceMode: 'api',
        },
        {
          id: 'copilot',
          enabled: true,
          sourceMode: 'api',
        },
      ],
    };

    const nextConfig = applyProviderSelection(config, ['copilot', 'codex']);

    expect(nextConfig.providers.map((provider) => [provider.id, provider.enabled])).toEqual([
      ['copilot', true],
      ['codex', true],
      ['claude', false],
    ]);
    expect(nextConfig.providers[1]?.secretRef).toEqual({
      store: 'env',
      env: 'CODEX_TOKEN',
    });
    expect(nextConfig.providers[2]?.sourceMode).toBe('api');
  });

  it('loads, selects, reorders, and saves provider visibility through injected dependencies', async () => {
    const saveConfig = vi.fn(async () => ({ path: '/tmp/agent-bar.json' }));

    const output = await runProvidersCommand(
      {
        path: '/tmp/agent-bar.json',
      },
      {
        loadConfig: async () => ({
          path: '/tmp/agent-bar.json',
          exists: true,
          config: {
            schemaVersion: 1,
            defaults: {
              ttlSeconds: 150,
            },
            providers: [
              { id: 'codex', enabled: true, sourceMode: 'cli' },
              { id: 'claude', enabled: true, sourceMode: 'cli' },
              { id: 'copilot', enabled: false, sourceMode: 'api' },
            ],
          },
        }),
        saveConfig,
        selectProviders: async () => ['codex', 'copilot'],
        selectProviderOrder: async () => ['copilot', 'codex'],
      },
    );

    expect(saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        providers: [
          expect.objectContaining({ id: 'copilot', enabled: true }),
          expect.objectContaining({ id: 'codex', enabled: true }),
          expect.objectContaining({ id: 'claude', enabled: false }),
        ],
      }),
      {
        explicitPath: '/tmp/agent-bar.json',
      },
    );
    expect(output).toContain('copilot, codex');
  });
});

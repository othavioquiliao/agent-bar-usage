import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { assertSnapshotEnvelope } from 'shared-contract';
import { describe, expect, it } from 'vitest';
import { SnapshotCache } from '../src/cache/snapshot-cache.js';
import { runUsageCommand } from '../src/cli.js';
import type { ProviderAdapter } from '../src/core/provider-adapter.js';
import { ProviderRegistry } from '../src/core/provider-registry.js';

describe('usage output parity', () => {
  it('renders text and JSON from the same provider status story', async () => {
    const jsonOutput = await runUsageCommand(
      {
        provider: 'codex',
        json: true,
        refresh: true,
        diagnostics: false,
      },
      {
        cache: createTestSnapshotCache(),
        createProviderRegistry: createTestProviderRegistry,
      },
    );
    const payload = assertSnapshotEnvelope(JSON.parse(jsonOutput));
    const textOutput = await runUsageCommand(
      {
        provider: 'codex',
        json: false,
        refresh: true,
        diagnostics: false,
      },
      {
        cache: createTestSnapshotCache(),
        createProviderRegistry: createTestProviderRegistry,
      },
    );

    expect(payload.providers).toHaveLength(1);
    expect(payload.providers[0]?.provider).toBe('codex');
    expect(payload.providers[0]?.source).toBe('cli');
    expect(payload.providers[0]?.error).toBeNull();
    expect(payload.providers[0]?.diagnostics).toBeUndefined();

    expect(textOutput).toContain('Provider: codex');
    expect(textOutput).toContain('status: ok');
    expect(textOutput).toContain('source: cli');
    expect(textOutput).toContain('updated:');
    expect(textOutput).toContain('reset:');
    expect(textOutput).not.toContain(FIXTURE_UPDATED_AT);
    expect(textOutput).not.toContain(FIXTURE_RESETS_AT);
    expect(textOutput).not.toContain('Diagnostics:');
  });

  it('includes diagnostics only when explicitly requested', async () => {
    const jsonOutput = await runUsageCommand(
      {
        provider: 'claude',
        json: true,
        refresh: true,
        diagnostics: true,
      },
      {
        cache: createTestSnapshotCache(),
        createProviderRegistry: createTestProviderRegistry,
      },
    );
    const payload = assertSnapshotEnvelope(JSON.parse(jsonOutput));
    const textOutput = await runUsageCommand(
      {
        provider: 'claude',
        json: false,
        refresh: true,
        diagnostics: true,
      },
      {
        cache: createTestSnapshotCache(),
        createProviderRegistry: createTestProviderRegistry,
      },
    );

    expect(payload.providers[0]?.diagnostics?.attempts.length).toBeGreaterThan(0);
    expect(textOutput).toContain('Diagnostics:');
    expect(textOutput).toContain('available=true');
  });
});

function createTestProviderRegistry(): ProviderRegistry {
  return new ProviderRegistry([createProvider('codex', 35), createProvider('claude', 60)]);
}

function createProvider(providerId: ProviderAdapter['id'], used: number): ProviderAdapter {
  return {
    id: providerId,
    name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
    cacheKey: `${providerId}-quota`,
    defaultSourceMode: 'cli',
    async isAvailable() {
      return true;
    },
    async getQuota(context) {
      return {
        provider: providerId,
        status: 'ok',
        source: context.sourceMode,
        updated_at: FIXTURE_UPDATED_AT,
        usage: {
          kind: 'quota',
          used,
          limit: 100,
          percent_used: used,
        },
        reset_window: {
          label: `${providerId} window`,
          resets_at: FIXTURE_RESETS_AT,
        },
        error: null,
        diagnostics: {
          attempts: [
            {
              strategy: `${providerId}.fixture`,
              available: true,
              duration_ms: 1,
              error: null,
            },
          ],
        },
      };
    },
  };
}

const FIXTURE_UPDATED_AT = '2026-03-25T17:05:00.000Z';
const FIXTURE_RESETS_AT = '2026-03-26T00:00:00.000Z';

function createTestSnapshotCache(): SnapshotCache {
  return new SnapshotCache({
    cacheDir: mkdtempSync(path.join(tmpdir(), 'agent-bar-output-parity-')),
  });
}

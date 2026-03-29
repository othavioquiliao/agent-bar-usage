import type { SnapshotEnvelope } from 'shared-contract';
import { describe, expect, it } from 'vitest';

import { formatSnapshotAsTerminal } from '../src/formatters/terminal-snapshot-formatter.js';

describe('terminal snapshot formatter', () => {
  it('renders Unicode progress bars and provider accents', () => {
    const envelope = createEnvelope();

    const output = formatSnapshotAsTerminal(envelope, {
      now: new Date('2026-03-25T17:10:00.000Z'),
    });

    expect(output).toContain('Codex');
    expect(output).toContain('█');
    expect(output).toContain('░');
    expect(output).toContain('\u001B[38;2;97;175;239m');
  });

  it('renders readable cards for provider errors', () => {
    const envelope = createEnvelope();

    const output = formatSnapshotAsTerminal(
      {
        ...envelope,
        providers: [
          ...envelope.providers,
          {
            provider: 'claude',
            status: 'error',
            source: 'cli',
            updated_at: '2026-03-25T17:05:00.000Z',
            usage: null,
            reset_window: null,
            error: {
              code: 'provider_fetch_failed',
              message: 'adapter exploded',
              retryable: true,
            },
          },
        ],
      },
      {
        now: new Date('2026-03-25T17:10:00.000Z'),
      },
    );

    expect(output).toContain('Claude');
    expect(output).toContain('provider_fetch_failed: adapter exploded');
  });
});

function createEnvelope(): SnapshotEnvelope {
  return {
    schema_version: '1',
    generated_at: '2026-03-25T17:05:00.000Z',
    providers: [
      {
        provider: 'codex',
        status: 'ok',
        source: 'cli',
        updated_at: '2026-03-25T17:05:00.000Z',
        usage: {
          kind: 'quota',
          used: 35,
          limit: 100,
          percent_used: 35,
        },
        reset_window: {
          label: '5h limit',
          resets_at: '2026-03-25T20:00:00.000Z',
        },
        error: null,
      },
    ],
  };
}

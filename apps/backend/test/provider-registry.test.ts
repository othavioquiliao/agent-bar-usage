import { describe, expect, it } from 'vitest';

import { getBuiltinProviders } from '../src/providers/index.js';

describe('provider registry metadata', () => {
  it('exposes stable ids, names, and cache keys for builtin providers', () => {
    expect(
      getBuiltinProviders().map((provider) => ({
        id: provider.id,
        name: provider.name,
        cacheKey: provider.cacheKey,
      })),
    ).toEqual([
      { id: 'copilot', name: 'Copilot', cacheKey: 'copilot-quota' },
      { id: 'codex', name: 'Codex', cacheKey: 'codex-quota' },
      { id: 'claude', name: 'Claude', cacheKey: 'claude-quota' },
    ]);
  });
});

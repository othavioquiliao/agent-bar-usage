import { describe, expect, it } from 'vitest';

import { normalizeProviderId, resolvePackagedProviderIconRelativePaths } from '../utils/provider-icon-assets.js';

describe('provider icon assets', () => {
  it('normalizes provider ids before resolving icon candidates', () => {
    expect(normalizeProviderId('Claude Code')).toBe('claudecode');
  });

  it('prefers packaged copilot assets over fallback badges', () => {
    expect(resolvePackagedProviderIconRelativePaths('copilot')).toEqual(['copilot-icon.png']);
  });
});

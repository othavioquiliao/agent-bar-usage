import { describe, expect, it } from 'vitest';

import { buildProviderRowLayoutModel } from '../panel/provider-row-model.js';

describe('provider row layout model', () => {
  it('keeps the current header and adds the three requested primary lines', () => {
    const layout = buildProviderRowLayoutModel({
      providerId: 'codex',
      title: 'Codex',
      status: 'ok',
      statusText: 'Healthy',
      accountText: 'Account: jane@example.com',
      quotaText: 'Usage: 10 / 100 (10%)',
      progressPercent: 10,
      progressVisible: true,
      resetText: 'Reset: in 2 hours · Mar 25, 5:00 PM',
    });

    expect(layout).toMatchObject({
      headerText: 'Codex · Healthy',
      accountText: 'Account: jane@example.com',
      quotaLine: 'Usage: 10 / 100 (10%)',
      resetText: 'Reset: in 2 hours · Mar 25, 5:00 PM',
    });
  });

  it('shows fallback copy when account, usage, and reset are missing', () => {
    const layout = buildProviderRowLayoutModel({
      providerId: 'claude',
      title: 'Claude',
      status: 'error',
      statusText: 'Error',
      progressPercent: null,
      progressVisible: false,
    });

    expect(layout.accountText).toBe('Account: Unavailable');
    expect(layout.quotaLine).toBe('Usage: Unavailable');
    expect(layout.resetText).toBe('Reset: Unavailable');
  });

  it('shows the progress bar only when a percent is available', () => {
    const visible = buildProviderRowLayoutModel({
      providerId: 'copilot',
      title: 'Copilot',
      status: 'degraded',
      statusText: 'Degraded',
      quotaText: 'Usage: 80 / 100 (80%)',
      progressPercent: 80,
      progressVisible: true,
    });
    const hiddenWithoutPercent = buildProviderRowLayoutModel({
      providerId: 'copilot',
      title: 'Copilot',
      status: 'degraded',
      statusText: 'Degraded',
      quotaText: 'Usage: Unavailable',
      progressPercent: null,
      progressVisible: true,
    });

    expect(visible).toMatchObject({
      progressPercent: 80,
      showProgressBar: true,
      showProgressFill: true,
    });
    expect(hiddenWithoutPercent.showProgressBar).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { formatResetLabel, mapToSnapshot } from '../../../src/providers/codex/codex-appserver-fetcher.js';

const NOW = new Date('2026-03-25T12:00:00Z').getTime();

function makeRateLimits(
  overrides: {
    usedPercent?: number;
    windowDurationMins?: number;
    resetsAt?: number;
    primary?: null;
    secondary?: null;
    planType?: string | null;
  } = {},
) {
  const hasPrimary = overrides.primary !== null;
  return {
    rateLimits: {
      primary: hasPrimary
        ? {
            usedPercent: overrides.usedPercent ?? 14,
            windowDurationMins: overrides.windowDurationMins ?? 10080,
            resetsAt: overrides.resetsAt ?? Math.floor(NOW / 1000) + 86400,
          }
        : null,
      secondary: overrides.secondary ?? null,
      planType: overrides.planType ?? 'free',
    },
  };
}

describe('mapToSnapshot', () => {
  it('returns ok with usage from primary rate limit', () => {
    const result = mapToSnapshot(makeRateLimits({ usedPercent: 14 }), NOW);

    expect(result.provider).toBe('codex');
    expect(result.status).toBe('ok');
    expect(result.source).toBe('cli');
    expect(result.usage).toEqual({ kind: 'quota', used: 14, limit: 100, percent_used: 14 });
    expect(result.error).toBeNull();
  });

  it('returns degraded when usedPercent >= 90', () => {
    const result = mapToSnapshot(makeRateLimits({ usedPercent: 95 }), NOW);

    expect(result.status).toBe('degraded');
    expect(result.usage?.percent_used).toBe(95);
  });

  it('returns ok when usedPercent is below 90', () => {
    const result = mapToSnapshot(makeRateLimits({ usedPercent: 89 }), NOW);

    expect(result.status).toBe('ok');
  });

  it('returns unavailable when primary is null', () => {
    const result = mapToSnapshot(makeRateLimits({ primary: null }), NOW);

    expect(result.status).toBe('unavailable');
    expect(result.usage).toBeNull();
    expect(result.reset_window).toBeNull();
  });

  it('rounds usedPercent to integer', () => {
    const result = mapToSnapshot(makeRateLimits({ usedPercent: 45.7 }), NOW);

    expect(result.usage?.percent_used).toBe(46);
    expect(result.usage?.used).toBe(46);
  });

  it('includes reset_window with label and ISO timestamp', () => {
    const resetsAt = Math.floor(NOW / 1000) + 7200; // 2 hours from now
    const result = mapToSnapshot(makeRateLimits({ resetsAt }), NOW);

    expect(result.reset_window).not.toBeNull();
    expect(result.reset_window?.label).toBe('Resets in 2h 0m');
    expect(result.reset_window?.resets_at).toBe(new Date(resetsAt * 1000).toISOString());
  });

  it('sets reset_window to null when resetsAt is missing', () => {
    const result = mapToSnapshot(
      { rateLimits: { primary: { usedPercent: 10, windowDurationMins: 10080, resetsAt: 0 }, secondary: null } },
      NOW,
    );

    // resetsAt=0 is falsy, so reset_window should be null
    expect(result.reset_window).toBeNull();
  });

  it('handles zero usedPercent', () => {
    const result = mapToSnapshot(makeRateLimits({ usedPercent: 0 }), NOW);

    expect(result.status).toBe('ok');
    expect(result.usage?.percent_used).toBe(0);
  });

  it('handles 100 usedPercent', () => {
    const result = mapToSnapshot(makeRateLimits({ usedPercent: 100 }), NOW);

    expect(result.status).toBe('degraded');
    expect(result.usage?.percent_used).toBe(100);
  });
});

describe('formatResetLabel', () => {
  it("returns 'Resets soon' when time is in the past", () => {
    const pastUnix = Math.floor(NOW / 1000) - 100;
    expect(formatResetLabel(pastUnix, NOW)).toBe('Resets soon');
  });

  it('returns minutes format for less than 1 hour', () => {
    const resetsAt = Math.floor(NOW / 1000) + 1800; // 30 minutes
    expect(formatResetLabel(resetsAt, NOW)).toBe('Resets in 30m');
  });

  it('returns hours and minutes for less than 24 hours', () => {
    const resetsAt = Math.floor(NOW / 1000) + 5400; // 1h30m
    expect(formatResetLabel(resetsAt, NOW)).toBe('Resets in 1h 30m');
  });

  it('returns days and hours for 24+ hours', () => {
    const resetsAt = Math.floor(NOW / 1000) + 90000; // 25 hours
    expect(formatResetLabel(resetsAt, NOW)).toBe('Resets in 1d 1h');
  });

  it('returns days and hours for multiple days', () => {
    const resetsAt = Math.floor(NOW / 1000) + 259200; // 3 days (72 hours)
    expect(formatResetLabel(resetsAt, NOW)).toBe('Resets in 3d 0h');
  });
});

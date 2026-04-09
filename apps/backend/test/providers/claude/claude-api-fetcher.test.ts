import { describe, expect, it } from 'vitest';
import { fetchClaudeUsageViaApi } from '../../../src/providers/claude/claude-api-fetcher.js';

function mockFetch(status: number, body: unknown) {
  return async () => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;
}

describe('fetchClaudeUsageViaApi', () => {
  it('returns snapshot with utilization from five_hour', async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: 'sk-test', expiresAt: null },
      fetch: mockFetch(200, {
        five_hour: { utilization: 45.0, resets_at: '2026-03-26T04:00:00Z' },
        seven_day: { utilization: 29.0, resets_at: '2026-03-29T00:00:00Z' },
      }),
    });

    expect(result.provider).toBe('claude');
    expect(result.status).toBe('ok');
    expect(result.source).toBe('api');
    expect(result.usage?.percent_used).toBe(45);
    expect(result.error).toBeNull();
  });

  it('populates secondary_usage from seven_day when primary is five_hour', async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: 'sk-test', expiresAt: null },
      fetch: mockFetch(200, {
        five_hour: { utilization: 68.0, resets_at: '2026-04-09T21:00:00Z' },
        seven_day: { utilization: 64.0, resets_at: '2026-04-13T10:00:00Z' },
      }),
    });

    expect(result.usage?.percent_used).toBe(68);
    expect(result.secondary_usage?.kind).toBe('quota');
    expect(result.secondary_usage?.percent_used).toBe(64);
    expect(result.secondary_usage?.limit).toBe(100);
    expect(result.secondary_reset_window?.resets_at).toBe('2026-04-13T10:00:00Z');
    expect(result.secondary_reset_window?.label).toContain('Resets in');
  });

  it('leaves secondary_usage null when seven_day is absent', async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: 'sk-test', expiresAt: null },
      fetch: mockFetch(200, { five_hour: { utilization: 45.0, resets_at: null } }),
    });

    expect(result.usage?.percent_used).toBe(45);
    expect(result.secondary_usage ?? null).toBeNull();
    expect(result.secondary_reset_window ?? null).toBeNull();
  });

  it('returns degraded when utilization >= 90', async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: 'sk-test', expiresAt: null },
      fetch: mockFetch(200, { five_hour: { utilization: 95.0, resets_at: '2026-03-26T04:00:00Z' } }),
    });

    expect(result.status).toBe('degraded');
    expect(result.usage?.percent_used).toBe(95);
  });

  it('returns ok when utilization is below 90', async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: 'sk-test', expiresAt: null },
      fetch: mockFetch(200, { five_hour: { utilization: 89.0, resets_at: null } }),
    });

    expect(result.status).toBe('ok');
  });

  it('falls back to seven_day when five_hour.utilization is null', async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: 'sk-test', expiresAt: null },
      fetch: mockFetch(200, {
        five_hour: { utilization: null, resets_at: null },
        seven_day: { utilization: 30.0, resets_at: '2026-03-29T00:00:00Z' },
      }),
    });

    expect(result.status).toBe('ok');
    expect(result.usage?.percent_used).toBe(30);
    expect(result.error).toBeNull();
    // secondary must be null to avoid duplicating the primary when fallback itself was seven_day
    expect(result.secondary_usage ?? null).toBeNull();
  });

  it('falls back to seven_day when five_hour object is missing entirely', async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: 'sk-test', expiresAt: null },
      fetch: mockFetch(200, { seven_day: { utilization: 30.0, resets_at: '2026-03-29T00:00:00Z' } }),
    });

    expect(result.status).toBe('ok');
    expect(result.usage?.percent_used).toBe(30);
    expect(result.secondary_usage ?? null).toBeNull();
  });

  it('falls back to extra_usage when five_hour and seven_day are both null', async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: 'sk-test', expiresAt: null },
      fetch: mockFetch(200, {
        five_hour: { utilization: null, resets_at: null },
        seven_day: { utilization: null, resets_at: null },
        extra_usage: { is_enabled: true, monthly_limit: 100_000, used_credits: 47_600, utilization: 47.6 },
      }),
    });

    expect(result.status).toBe('ok');
    expect(result.usage?.percent_used).toBe(48);
    expect(result.error).toBeNull();
  });

  it('falls back to seven_day_sonnet as last resort', async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: 'sk-test', expiresAt: null },
      fetch: mockFetch(200, {
        five_hour: { utilization: null, resets_at: null },
        seven_day: { utilization: null, resets_at: null },
        extra_usage: { utilization: null },
        seven_day_sonnet: { utilization: 20.0, resets_at: '2026-04-13T13:00:00Z' },
      }),
    });

    expect(result.status).toBe('ok');
    expect(result.usage?.percent_used).toBe(20);
  });

  it('returns error claude_usage_transient when all utilization fields are null', async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: 'sk-test', expiresAt: null },
      fetch: mockFetch(200, {
        five_hour: { utilization: null, resets_at: null },
        seven_day: { utilization: null, resets_at: null },
        extra_usage: { utilization: null },
        seven_day_sonnet: { utilization: null, resets_at: null },
      }),
    });

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('claude_usage_transient');
    expect(result.error?.retryable).toBe(true);
    expect(result.error?.message).toContain('temporary');
    expect(result.usage).toBeNull();
  });

  it('returns error claude_usage_transient when response has no known fields', async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: 'sk-test', expiresAt: null },
      fetch: mockFetch(200, {}),
    });

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('claude_usage_transient');
  });

  it('returns claude_auth_expired on 401', async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: 'sk-expired', expiresAt: null },
      fetch: mockFetch(401, {}),
    });

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('claude_auth_expired');
    expect(result.error?.message).toContain('claude auth login');
    expect(result.error?.retryable).toBe(false);
  });

  it('returns claude_auth_expired on 403', async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: 'sk-expired', expiresAt: null },
      fetch: mockFetch(403, {}),
    });

    expect(result.error?.code).toBe('claude_auth_expired');
  });

  it('returns error when no credentials file', async () => {
    const result = await fetchClaudeUsageViaApi({
      credentialsPath: '/nonexistent/path.json',
    });

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('claude_cli_missing');
    expect(result.error?.retryable).toBe(false);
  });

  it('handles rate limiting (429)', async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: 'sk-test', expiresAt: null },
      fetch: mockFetch(429, {}),
    });

    expect(result.status).toBe('error');
    expect(result.error?.retryable).toBe(true);
  });

  it('handles generic HTTP errors', async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: 'sk-test', expiresAt: null },
      fetch: mockFetch(500, {}),
    });

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('claude_cli_failed');
    expect(result.error?.message).toContain('500');
    expect(result.error?.retryable).toBe(true);
  });

  it('handles network errors', async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: 'sk-test', expiresAt: null },
      fetch: async () => {
        throw new Error('Network unreachable');
      },
    });

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('claude_cli_failed');
    expect(result.error?.message).toContain('Network unreachable');
    expect(result.error?.retryable).toBe(true);
  });

  it('rounds utilization to integer', async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: 'sk-test', expiresAt: null },
      fetch: mockFetch(200, { five_hour: { utilization: 45.7, resets_at: null } }),
    });

    expect(result.usage?.percent_used).toBe(46);
    expect(result.usage?.used).toBe(46);
  });
});

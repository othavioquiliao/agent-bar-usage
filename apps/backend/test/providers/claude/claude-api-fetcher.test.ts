import { describe, it, expect } from "vitest";
import { fetchClaudeUsageViaApi } from "../../../src/providers/claude/claude-api-fetcher.js";

function mockFetch(status: number, body: unknown) {
  return async () => ({ ok: status >= 200 && status < 300, status, json: async () => body } as Response);
}

describe("fetchClaudeUsageViaApi", () => {
  it("returns snapshot with utilization from five_hour", async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: "sk-test", expiresAt: null },
      fetch: mockFetch(200, { five_hour: { utilization: 45.0, resets_at: "2026-03-26T04:00:00Z" }, seven_day: { utilization: 29.0, resets_at: "2026-03-29T00:00:00Z" } }),
    });

    expect(result.provider).toBe("claude");
    expect(result.status).toBe("ok");
    expect(result.source).toBe("api");
    expect(result.usage?.percent_used).toBe(45);
    expect(result.error).toBeNull();
  });

  it("returns degraded when utilization >= 90", async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: "sk-test", expiresAt: null },
      fetch: mockFetch(200, { five_hour: { utilization: 95.0, resets_at: "2026-03-26T04:00:00Z" } }),
    });

    expect(result.status).toBe("degraded");
    expect(result.usage?.percent_used).toBe(95);
  });

  it("returns ok when utilization is below 90", async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: "sk-test", expiresAt: null },
      fetch: mockFetch(200, { five_hour: { utilization: 89.0, resets_at: null } }),
    });

    expect(result.status).toBe("ok");
  });

  it("returns unavailable when utilization is null", async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: "sk-test", expiresAt: null },
      fetch: mockFetch(200, { five_hour: { utilization: null, resets_at: null } }),
    });

    expect(result.status).toBe("unavailable");
    expect(result.usage).toBeNull();
  });

  it("falls back to seven_day when five_hour is missing", async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: "sk-test", expiresAt: null },
      fetch: mockFetch(200, { seven_day: { utilization: 30.0, resets_at: "2026-03-29T00:00:00Z" } }),
    });

    expect(result.status).toBe("ok");
    expect(result.usage?.percent_used).toBe(30);
  });

  it("returns claude_auth_expired on 401", async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: "sk-expired", expiresAt: null },
      fetch: mockFetch(401, {}),
    });

    expect(result.status).toBe("error");
    expect(result.error?.code).toBe("claude_auth_expired");
    expect(result.error?.message).toContain("claude auth login");
    expect(result.error?.retryable).toBe(false);
  });

  it("returns claude_auth_expired on 403", async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: "sk-expired", expiresAt: null },
      fetch: mockFetch(403, {}),
    });

    expect(result.error?.code).toBe("claude_auth_expired");
  });

  it("returns error when no credentials file", async () => {
    const result = await fetchClaudeUsageViaApi({
      credentialsPath: "/nonexistent/path.json",
    });

    expect(result.status).toBe("error");
    expect(result.error?.code).toBe("claude_cli_missing");
    expect(result.error?.retryable).toBe(false);
  });

  it("handles rate limiting (429)", async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: "sk-test", expiresAt: null },
      fetch: mockFetch(429, {}),
    });

    expect(result.status).toBe("error");
    expect(result.error?.retryable).toBe(true);
  });

  it("handles generic HTTP errors", async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: "sk-test", expiresAt: null },
      fetch: mockFetch(500, {}),
    });

    expect(result.status).toBe("error");
    expect(result.error?.code).toBe("claude_cli_failed");
    expect(result.error?.message).toContain("500");
    expect(result.error?.retryable).toBe(true);
  });

  it("handles network errors", async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: "sk-test", expiresAt: null },
      fetch: async () => { throw new Error("Network unreachable"); },
    });

    expect(result.status).toBe("error");
    expect(result.error?.code).toBe("claude_cli_failed");
    expect(result.error?.message).toContain("Network unreachable");
    expect(result.error?.retryable).toBe(true);
  });

  it("rounds utilization to integer", async () => {
    const result = await fetchClaudeUsageViaApi({
      credentials: { accessToken: "sk-test", expiresAt: null },
      fetch: mockFetch(200, { five_hour: { utilization: 45.7, resets_at: null } }),
    });

    expect(result.usage?.percent_used).toBe(46);
    expect(result.usage?.used).toBe(46);
  });
});

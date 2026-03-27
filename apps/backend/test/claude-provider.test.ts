import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderAdapterContext } from "../src/core/provider-adapter.js";
import { createClaudeCliAdapter } from "../src/providers/claude/claude-cli-adapter.js";
import { normalizeBackendRequest } from "../src/config/backend-request.js";

const { readClaudeCredentialsMock, fetchClaudeUsageViaApiMock } = vi.hoisted(() => ({
  readClaudeCredentialsMock: vi.fn(),
  fetchClaudeUsageViaApiMock: vi.fn(),
}));

vi.mock("../src/providers/claude/claude-credentials.js", () => ({
  readClaudeCredentials: readClaudeCredentialsMock,
}));

vi.mock("../src/providers/claude/claude-api-fetcher.js", () => ({
  fetchClaudeUsageViaApi: fetchClaudeUsageViaApiMock,
}));

describe("Claude CLI provider", () => {
  beforeEach(() => {
    readClaudeCredentialsMock.mockReset();
    fetchClaudeUsageViaApiMock.mockReset();
    readClaudeCredentialsMock.mockResolvedValue(null);
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  it("returns credentials error when no OAuth credentials exist in auto mode", async () => {
    readClaudeCredentialsMock.mockResolvedValue(null);
    fetchClaudeUsageViaApiMock.mockResolvedValue({
      provider: "claude",
      status: "error",
      source: "api",
      updated_at: new Date().toISOString(),
      usage: null,
      reset_window: null,
      error: { code: "claude_cli_missing", message: "Claude credentials not found", retryable: false },
    });

    const adapter = createClaudeCliAdapter();
    const snapshot = await adapter.fetch(createContext({ env: {} }));

    expect(snapshot.status).toBe("error");
    expect(snapshot.error?.code).toBe("claude_cli_missing");
    expect(fetchClaudeUsageViaApiMock).toHaveBeenCalledWith({ credentials: null });
  });

  it("calls API with credentials when available in auto mode", async () => {
    const creds = { accessToken: "sk-ant-test", expiresAt: null };
    readClaudeCredentialsMock.mockResolvedValue(creds);
    fetchClaudeUsageViaApiMock.mockResolvedValue({
      provider: "claude",
      status: "ok",
      source: "api",
      updated_at: new Date().toISOString(),
      usage: { kind: "quota", used: 22, limit: 100, percent_used: 22 },
      reset_window: null,
      error: null,
    });

    const adapter = createClaudeCliAdapter();
    const snapshot = await adapter.fetch(createContext({ env: {} }));

    expect(snapshot.status).toBe("ok");
    expect(snapshot.source).toBe("api");
    expect(snapshot.usage?.percent_used).toBe(22);
    expect(fetchClaudeUsageViaApiMock).toHaveBeenCalledWith({ credentials: creds });
  });

  it("uses the API path when api mode is requested", async () => {
    fetchClaudeUsageViaApiMock.mockResolvedValue({
      provider: "claude",
      status: "ok",
      source: "api",
      updated_at: new Date().toISOString(),
      usage: { kind: "quota", used: 22, limit: 100, percent_used: 22 },
      reset_window: null,
      error: null,
    });

    const adapter = createClaudeCliAdapter();
    const snapshot = await adapter.fetch(
      createContext({
        env: {},
        sourceMode: "api",
      }),
    );

    expect(snapshot.source).toBe("api");
    expect(fetchClaudeUsageViaApiMock).toHaveBeenCalledTimes(1);
  });

  it("returns removed error when cli mode is explicitly requested", async () => {
    const adapter = createClaudeCliAdapter();
    const snapshot = await adapter.fetch(
      createContext({
        env: {},
        sourceMode: "cli",
      }),
    );

    expect(snapshot.status).toBe("error");
    expect(snapshot.error?.code).toBe("claude_cli_removed");
    expect(snapshot.error?.retryable).toBe(false);
    expect(fetchClaudeUsageViaApiMock).not.toHaveBeenCalled();
  });

  it("returns API error directly in auto mode when API fails", async () => {
    readClaudeCredentialsMock.mockResolvedValue({ accessToken: "sk-ant-test", expiresAt: null });
    fetchClaudeUsageViaApiMock.mockResolvedValue({
      provider: "claude",
      status: "error",
      source: "api",
      updated_at: new Date().toISOString(),
      usage: null,
      reset_window: null,
      error: { code: "claude_auth_expired", message: "expired", retryable: false },
    });

    const adapter = createClaudeCliAdapter();
    const snapshot = await adapter.fetch(createContext({ env: {} }));

    expect(snapshot.status).toBe("error");
    expect(snapshot.error?.code).toBe("claude_auth_expired");
    expect(fetchClaudeUsageViaApiMock).toHaveBeenCalledTimes(1);
  });

  it("returns unavailable for unsupported source modes", async () => {
    const adapter = createClaudeCliAdapter();
    const snapshot = await adapter.fetch(
      createContext({
        env: {},
        sourceMode: "web",
      }),
    );

    expect(snapshot.status).toBe("unavailable");
  });
});

function createContext(options: {
  env: NodeJS.ProcessEnv;
  sourceMode?: ProviderAdapterContext["sourceMode"];
}): ProviderAdapterContext {
  return {
    request: normalizeBackendRequest({
      providers: ["claude"],
    }),
    providerId: "claude",
    sourceMode: options.sourceMode ?? "auto",
    env: options.env,
    now: () => new Date("2026-03-25T15:00:00Z"),
    runSubprocess: async () => {
      throw new Error("runSubprocess should not be called in Claude tests.");
    },
  };
}

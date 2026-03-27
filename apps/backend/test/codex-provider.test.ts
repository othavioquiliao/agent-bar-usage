import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderAdapterContext } from "../src/core/provider-adapter.js";
import { createCodexCliAdapter } from "../src/providers/codex/codex-cli-adapter.js";
import { normalizeBackendRequest } from "../src/config/backend-request.js";

const { fetchCodexUsageViaAppServerMock } = vi.hoisted(() => ({
  fetchCodexUsageViaAppServerMock: vi.fn(),
}));

vi.mock("../src/providers/codex/codex-appserver-fetcher.js", () => ({
  fetchCodexUsageViaAppServer: fetchCodexUsageViaAppServerMock,
}));

describe("Codex CLI provider", () => {
  beforeEach(() => {
    fetchCodexUsageViaAppServerMock.mockReset();
    // Default: app-server reports CLI missing
    fetchCodexUsageViaAppServerMock.mockResolvedValue({
      provider: "codex",
      status: "error",
      source: "cli",
      updated_at: new Date().toISOString(),
      usage: null,
      reset_window: null,
      error: { code: "codex_cli_missing", message: "Codex CLI not found on PATH.", retryable: false },
    });
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  it("uses app-server in auto mode when it succeeds", async () => {
    fetchCodexUsageViaAppServerMock.mockResolvedValue({
      provider: "codex",
      status: "ok",
      source: "cli",
      updated_at: new Date().toISOString(),
      usage: { kind: "quota", used: 18, limit: 100, percent_used: 18 },
      reset_window: null,
      error: null,
    });

    const adapter = createCodexCliAdapter();
    const snapshot = await adapter.fetch(createContext({ env: {} }));

    expect(snapshot.status).toBe("ok");
    expect(snapshot.usage?.percent_used).toBe(18);
    expect(fetchCodexUsageViaAppServerMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to deprecated CLI error when app-server fails in auto mode", async () => {
    fetchCodexUsageViaAppServerMock.mockResolvedValue({
      provider: "codex",
      status: "error",
      source: "cli",
      updated_at: new Date().toISOString(),
      usage: null,
      reset_window: null,
      error: { code: "codex_cli_failed", message: "app-server failed", retryable: true },
    });

    const adapter = createCodexCliAdapter();
    const snapshot = await adapter.fetch(createContext({ env: {} }));

    expect(snapshot.status).toBe("error");
    expect(snapshot.error?.code).toBe("codex_cli_deprecated");
    expect(snapshot.error?.retryable).toBe(false);
  });

  it("returns CLI missing error from app-server when codex not installed", async () => {
    const adapter = createCodexCliAdapter();
    const snapshot = await adapter.fetch(createContext({ env: {} }));

    // App-server default mock returns codex_cli_missing error
    // Since it has an error, adapter falls back to CLI which returns deprecated
    expect(snapshot.status).toBe("error");
    expect(snapshot.error?.code).toBe("codex_cli_deprecated");
  });

  it("returns deprecated error when cli mode is explicitly requested", async () => {
    const adapter = createCodexCliAdapter();
    const snapshot = await adapter.fetch(
      createContext({
        env: {},
        sourceMode: "cli",
      }),
    );

    expect(snapshot.status).toBe("error");
    expect(snapshot.error?.code).toBe("codex_cli_deprecated");
    expect(snapshot.error?.retryable).toBe(false);
    expect(fetchCodexUsageViaAppServerMock).not.toHaveBeenCalled();
  });

  it("returns unavailable for unsupported source modes", async () => {
    const adapter = createCodexCliAdapter();
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
      providers: ["codex"],
    }),
    providerId: "codex",
    sourceMode: options.sourceMode ?? "auto",
    env: options.env,
    now: () => new Date("2026-03-25T15:00:00Z"),
    runSubprocess: async () => {
      throw new Error("runSubprocess should not be called in Codex tests.");
    },
  };
}

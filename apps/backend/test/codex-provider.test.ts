import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderAdapterContext } from "../src/core/provider-adapter.js";
import { createCodexCliAdapter } from "../src/providers/codex/codex-cli-adapter.js";
import { normalizeBackendRequest } from "../src/config/backend-request.js";

const { runInteractiveCommandMock, resolveCommandInPathMock, fetchCodexUsageViaAppServerMock } = vi.hoisted(() => ({
  runInteractiveCommandMock: vi.fn(),
  resolveCommandInPathMock: vi.fn(),
  fetchCodexUsageViaAppServerMock: vi.fn(),
}));

vi.mock("../src/providers/shared/interactive-command.js", async () => {
  const actual = await vi.importActual<typeof import("../src/providers/shared/interactive-command.js")>(
    "../src/providers/shared/interactive-command.js",
  );

  return {
    ...actual,
    runInteractiveCommand: runInteractiveCommandMock,
  };
});

vi.mock("../src/utils/subprocess.js", async () => {
  const actual = await vi.importActual<typeof import("../src/utils/subprocess.js")>(
    "../src/utils/subprocess.js",
  );

  return {
    ...actual,
    resolveCommandInPath: resolveCommandInPathMock,
  };
});

vi.mock("../src/providers/codex/codex-appserver-fetcher.js", () => ({
  fetchCodexUsageViaAppServer: fetchCodexUsageViaAppServerMock,
}));

describe("Codex CLI provider", () => {
  beforeEach(() => {
    runInteractiveCommandMock.mockReset();
    resolveCommandInPathMock.mockReset();
    fetchCodexUsageViaAppServerMock.mockReset();
    resolveCommandInPathMock.mockReturnValue(null);
    // Default: app-server reports CLI missing, so adapter falls through to PTY path
    fetchCodexUsageViaAppServerMock.mockResolvedValue({
      provider: "codex",
      status: "error",
      source: "api",
      updated_at: new Date().toISOString(),
      usage: null,
      reset_window: null,
      error: { code: "codex_cli_missing", message: "Codex CLI not found on PATH.", retryable: false },
    });
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  it("returns a provider-level error when the CLI is missing", async () => {
    resolveCommandInPathMock.mockReturnValue(null);

    const adapter = createCodexCliAdapter();
    const snapshot = await adapter.fetch(createContext({ env: {} }));

    expect(snapshot.status).toBe("error");
    expect(snapshot.error?.code).toBe("codex_cli_missing");
    expect(runInteractiveCommandMock).not.toHaveBeenCalled();
  });

  it("maps parse failures to a structured provider error", async () => {
    runInteractiveCommandMock.mockResolvedValue(createRunResult("hello world"));
    resolveCommandInPathMock.mockImplementation((command: string) =>
      command === "codex" ? "/usr/bin/codex" : null,
    );

    const adapter = createCodexCliAdapter();
    const snapshot = await adapter.fetch(
      createContext({
        env: {
          CODEX_CLI_PATH: "/usr/bin/codex",
        },
      }),
    );

    expect(snapshot.status).toBe("error");
    expect(snapshot.error?.code).toBe("codex_parse_failed");
    expect(snapshot.error?.retryable).toBe(true);
  });

  it("maps update prompts to a structured provider error", async () => {
    runInteractiveCommandMock.mockResolvedValue(
      createRunResult("Update available! Run bun install -g @openai/codex"),
    );
    resolveCommandInPathMock.mockImplementation((command: string) =>
      command === "codex" ? "/usr/bin/codex" : null,
    );

    const adapter = createCodexCliAdapter();
    const snapshot = await adapter.fetch(
      createContext({
        env: {
          CODEX_CLI_PATH: "/usr/bin/codex",
        },
      }),
    );

    expect(snapshot.status).toBe("error");
    expect(snapshot.error?.code).toBe("codex_update_required");
    expect(snapshot.error?.retryable).toBe(false);
  });

  it("maps usage output into normalized quota fields", async () => {
    runInteractiveCommandMock.mockResolvedValue(
      createRunResult(
        [
          "Credits: 42",
          "5h limit 65% (resets at 2026-03-25T16:00:00.000Z)",
          "Weekly limit 80% (resets at 2026-03-30T12:00:00.000Z)",
        ].join("\n"),
      ),
    );
    resolveCommandInPathMock.mockImplementation((command: string) =>
      command === "codex" ? "/usr/bin/codex" : null,
    );

    const adapter = createCodexCliAdapter();
    const snapshot = await adapter.fetch(
      createContext({
        env: {
          CODEX_CLI_PATH: "/usr/bin/codex",
        },
      }),
    );

    expect(snapshot.status).toBe("ok");
    expect(snapshot.source).toBe("cli");
    expect(snapshot.usage).toEqual({
      kind: "quota",
      used: 35,
      limit: 100,
      percent_used: 35,
    });
    expect(snapshot.reset_window).toEqual({
      resets_at: "2026-03-25T16:00:00.000Z",
      label: "5h limit",
    });
    expect(snapshot.diagnostics?.attempts[0]?.strategy).toBe("codex.cli");
  });

  it("maps PtyUnavailableError to a non-retryable provider error", async () => {
    const { PtyUnavailableError } = await import("../src/providers/shared/interactive-command.js");
    runInteractiveCommandMock.mockRejectedValue(new PtyUnavailableError());
    resolveCommandInPathMock.mockImplementation((command: string) =>
      command === "codex" ? "/usr/bin/codex" : null,
    );

    const adapter = createCodexCliAdapter();
    const snapshot = await adapter.fetch(
      createContext({
        env: {
          CODEX_CLI_PATH: "/usr/bin/codex",
        },
      }),
    );

    expect(snapshot.status).toBe("error");
    expect(snapshot.error?.code).toBe("codex_pty_unavailable");
    expect(snapshot.error?.retryable).toBe(false);
  });
});

function createContext(options: {
  env: NodeJS.ProcessEnv;
}): ProviderAdapterContext {
  return {
    request: normalizeBackendRequest({
      providers: ["codex"],
    }),
    providerId: "codex",
    sourceMode: "cli",
    env: options.env,
    now: () => new Date("2026-03-25T15:00:00Z"),
    runSubprocess: async () => {
      throw new Error("runSubprocess should not be called in Codex tests.");
    },
  };
}

function createRunResult(stdout: string) {
  return {
    command: "codex",
    args: [],
    exitCode: 0,
    stdout,
    stderr: "",
    durationMs: 1,
  };
}

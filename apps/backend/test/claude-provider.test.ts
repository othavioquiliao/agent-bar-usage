import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderAdapterContext } from "../src/core/provider-adapter.js";
import { createClaudeCliAdapter } from "../src/providers/claude/claude-cli-adapter.js";
import { normalizeBackendRequest } from "../src/config/backend-request.js";

const { runInteractiveCommandMock, resolveCommandInPathMock } = vi.hoisted(() => ({
  runInteractiveCommandMock: vi.fn(),
  resolveCommandInPathMock: vi.fn(),
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

describe("Claude CLI provider", () => {
  beforeEach(() => {
    runInteractiveCommandMock.mockReset();
    resolveCommandInPathMock.mockReset();
    resolveCommandInPathMock.mockReturnValue(null);
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  it("returns a provider-level error when the CLI is missing", async () => {
    resolveCommandInPathMock.mockReturnValue(null);

    const adapter = createClaudeCliAdapter();
    const snapshot = await adapter.fetch(createContext({ env: {} }));

    expect(snapshot.status).toBe("error");
    expect(snapshot.error?.code).toBe("claude_cli_missing");
    expect(runInteractiveCommandMock).not.toHaveBeenCalled();
  });

  it("maps parse failures to a structured provider error", async () => {
    runInteractiveCommandMock.mockResolvedValue(createRunResult("hello world"));

    const adapter = createClaudeCliAdapter();
    const snapshot = await adapter.fetch(
      createContext({
        env: {
          CLAUDE_CLI_PATH: "/usr/bin/claude",
        },
      }),
    );

    expect(snapshot.status).toBe("error");
    expect(snapshot.error?.code).toBe("claude_parse_failed");
    expect(snapshot.error?.retryable).toBe(true);
  });

  it("maps PtyUnavailableError to a non-retryable provider error", async () => {
    const { PtyUnavailableError } = await import("../src/providers/shared/interactive-command.js");
    runInteractiveCommandMock.mockRejectedValue(new PtyUnavailableError());
    resolveCommandInPathMock.mockImplementation((command: string) =>
      command === "claude" ? "/usr/bin/claude" : null,
    );

    const adapter = createClaudeCliAdapter();
    const snapshot = await adapter.fetch(
      createContext({
        env: {
          CLAUDE_CLI_PATH: "/usr/bin/claude",
        },
      }),
    );

    expect(snapshot.status).toBe("error");
    expect(snapshot.error?.code).toBe("claude_pty_unavailable");
    expect(snapshot.error?.retryable).toBe(false);
  });

  it("maps usage output into normalized quota fields", async () => {
    runInteractiveCommandMock.mockResolvedValue(
      createRunResult(
        [
          "Current session 40% (resets at 2026-03-25T17:00:00.000Z)",
          "Current week (all models) 60% (resets at 2026-03-30T12:00:00.000Z)",
          "Current week (Opus) 90% (resets at 2026-03-30T12:00:00.000Z)",
        ].join("\n"),
      ),
    );

    const adapter = createClaudeCliAdapter();
    const snapshot = await adapter.fetch(
      createContext({
        env: {
          CLAUDE_CLI_PATH: "/usr/bin/claude",
        },
      }),
    );

    expect(snapshot.status).toBe("ok");
    expect(snapshot.source).toBe("cli");
    expect(snapshot.usage).toEqual({
      kind: "quota",
      used: 60,
      limit: 100,
      percent_used: 60,
    });
    expect(snapshot.reset_window).toEqual({
      resets_at: "2026-03-25T17:00:00.000Z",
      label: "Current session",
    });
    expect(snapshot.diagnostics?.attempts[0]?.strategy).toBe("claude.cli");
  });
});

function createContext(options: {
  env: NodeJS.ProcessEnv;
}): ProviderAdapterContext {
  return {
    request: normalizeBackendRequest({
      providers: ["claude"],
    }),
    providerId: "claude",
    sourceMode: "cli",
    env: options.env,
    now: () => new Date("2026-03-25T15:00:00Z"),
    runSubprocess: async () => {
      throw new Error("runSubprocess should not be called in Claude tests.");
    },
  };
}

function createRunResult(stdout: string) {
  return {
    command: "script",
    args: [],
    exitCode: 0,
    stdout,
    stderr: "",
    durationMs: 1,
  };
}

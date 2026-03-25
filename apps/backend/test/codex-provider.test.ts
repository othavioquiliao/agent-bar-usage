import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderAdapterContext } from "../src/core/provider-adapter.js";
import { createCodexCliAdapter } from "../src/providers/codex/codex-cli-adapter.js";
import { normalizeBackendRequest } from "../src/config/backend-request.js";

const { resolveCommandInPathMock } = vi.hoisted(() => ({
  resolveCommandInPathMock: vi.fn(),
}));

vi.mock("../src/utils/subprocess.js", async () => {
  const actual = await vi.importActual<typeof import("../src/utils/subprocess.js")>(
    "../src/utils/subprocess.js",
  );

  return {
    ...actual,
    resolveCommandInPath: resolveCommandInPathMock,
  };
});

describe("Codex CLI provider", () => {
  beforeEach(() => {
    resolveCommandInPathMock.mockReset();
    resolveCommandInPathMock.mockReturnValue(null);
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  it("returns a provider-level error when the CLI is missing", async () => {
    resolveCommandInPathMock.mockReturnValue(null);

    const adapter = createCodexCliAdapter();
    const snapshot = await adapter.fetch(createContext({ env: {}, runSubprocess: vi.fn() }));

    expect(snapshot.status).toBe("error");
    expect(snapshot.error?.code).toBe("codex_cli_missing");
  });

  it("maps parse failures to a structured provider error", async () => {
    const runSubprocess = vi.fn().mockResolvedValue(createRunResult("hello world"));
    resolveCommandInPathMock.mockImplementation((command: string) =>
      command === "codex" ? "/usr/bin/codex" : null,
    );

    const adapter = createCodexCliAdapter();
    const snapshot = await adapter.fetch(
      createContext({
        env: {
          CODEX_CLI_PATH: "/usr/bin/codex",
        },
        runSubprocess,
      }),
    );

    expect(snapshot.status).toBe("error");
    expect(snapshot.error?.code).toBe("codex_parse_failed");
    expect(snapshot.error?.retryable).toBe(true);
  });

  it("maps update prompts to a structured provider error", async () => {
    const runSubprocess = vi.fn().mockResolvedValue(
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
        runSubprocess,
      }),
    );

    expect(snapshot.status).toBe("error");
    expect(snapshot.error?.code).toBe("codex_update_required");
    expect(snapshot.error?.retryable).toBe(false);
  });

  it("maps usage output into normalized quota fields", async () => {
    const runSubprocess = vi.fn().mockResolvedValue(
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
        runSubprocess,
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
});

function createContext(options: {
  env: NodeJS.ProcessEnv;
  runSubprocess: ProviderAdapterContext["runSubprocess"];
}): ProviderAdapterContext {
  return {
    request: normalizeBackendRequest({
      providers: ["codex"],
    }),
    providerId: "codex",
    sourceMode: "cli",
    env: options.env,
    now: () => new Date("2026-03-25T15:00:00Z"),
    runSubprocess: options.runSubprocess,
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

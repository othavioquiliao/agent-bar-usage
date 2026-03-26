import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runAuthClaudeCommand, runAuthCodexCommand } from "../../src/commands/auth-command.js";

describe("runAuthClaudeCommand", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let originalExitCode: number | undefined;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it("reports authenticated when credentials are found", async () => {
    await runAuthClaudeCommand({
      readCredentials: async () => ({ accessToken: "sk-ant-test", expiresAt: null }),
    });

    expect(stdoutSpy).toHaveBeenCalledWith(
      "Claude: authenticated (token found in ~/.claude/.credentials.json)\n",
    );
    expect(process.exitCode).toBeUndefined();
  });

  it("reports not found and sets exitCode 1 when credentials are missing", async () => {
    await runAuthClaudeCommand({
      readCredentials: async () => null,
    });

    expect(stderrSpy).toHaveBeenCalledWith(
      "Claude credentials not found.\n  -> Run: claude auth login\n",
    );
    expect(process.exitCode).toBe(1);
  });
});

describe("runAuthCodexCommand", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let originalExitCode: number | undefined;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it("reports authenticated when credentials are found", async () => {
    await runAuthCodexCommand({
      readCredentials: async () => ({ accessToken: "openai-test-key" }),
    });

    expect(stdoutSpy).toHaveBeenCalledWith(
      "Codex: authenticated (token found in ~/.codex/auth.json)\n",
    );
    expect(process.exitCode).toBeUndefined();
  });

  it("reports not found and sets exitCode 1 when credentials are missing", async () => {
    await runAuthCodexCommand({
      readCredentials: async () => null,
    });

    expect(stderrSpy).toHaveBeenCalledWith(
      "Codex credentials not found.\n  -> Run: codex auth login\n",
    );
    expect(process.exitCode).toBe(1);
  });
});

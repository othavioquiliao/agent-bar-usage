import { describe, it, expect } from "vitest";
import { readClaudeCredentials } from "../../../src/providers/claude/claude-credentials.js";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("readClaudeCredentials", () => {
  it("returns null when file does not exist", async () => {
    const result = await readClaudeCredentials("/nonexistent/path.json");
    expect(result).toBeNull();
  });

  it("reads accessToken from valid credentials file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "claude-creds-"));
    const path = join(dir, ".credentials.json");
    await writeFile(path, JSON.stringify({
      claudeAiOauth: { accessToken: "sk-ant-test-123", expiresAt: "2026-12-31T00:00:00Z" },
    }));

    const result = await readClaudeCredentials(path);
    expect(result).toEqual({ accessToken: "sk-ant-test-123", expiresAt: "2026-12-31T00:00:00Z" });

    await rm(dir, { recursive: true });
  });

  it("returns null when claudeAiOauth missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "claude-creds-"));
    const path = join(dir, ".credentials.json");
    await writeFile(path, JSON.stringify({ someOtherKey: true }));

    const result = await readClaudeCredentials(path);
    expect(result).toBeNull();

    await rm(dir, { recursive: true });
  });

  it("returns null when file contains invalid JSON", async () => {
    const dir = await mkdtemp(join(tmpdir(), "claude-creds-"));
    const path = join(dir, ".credentials.json");
    await writeFile(path, "not valid json {{{");

    const result = await readClaudeCredentials(path);
    expect(result).toBeNull();

    await rm(dir, { recursive: true });
  });

  it("returns null when accessToken is empty string", async () => {
    const dir = await mkdtemp(join(tmpdir(), "claude-creds-"));
    const path = join(dir, ".credentials.json");
    await writeFile(path, JSON.stringify({
      claudeAiOauth: { accessToken: "", expiresAt: null },
    }));

    const result = await readClaudeCredentials(path);
    expect(result).toBeNull();

    await rm(dir, { recursive: true });
  });

  it("returns null expiresAt when field is not a string", async () => {
    const dir = await mkdtemp(join(tmpdir(), "claude-creds-"));
    const path = join(dir, ".credentials.json");
    await writeFile(path, JSON.stringify({
      claudeAiOauth: { accessToken: "sk-valid-token", expiresAt: 12345 },
    }));

    const result = await readClaudeCredentials(path);
    expect(result).toEqual({ accessToken: "sk-valid-token", expiresAt: null });

    await rm(dir, { recursive: true });
  });
});

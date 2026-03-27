import { describe, it, expect } from "vitest";
import { readCodexCredentials } from "../../../src/providers/codex/codex-credentials.js";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("readCodexCredentials", () => {
  it("returns null when file does not exist", async () => {
    const result = await readCodexCredentials("/nonexistent/path.json");
    expect(result).toBeNull();
  });

  it("reads token from valid auth file (token field)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codex-creds-"));
    const path = join(dir, "auth.json");
    await writeFile(path, JSON.stringify({ token: "openai-key-123" }));

    const result = await readCodexCredentials(path);
    expect(result).toEqual({ accessToken: "openai-key-123" });

    await rm(dir, { recursive: true });
  });

  it("reads token from valid auth file (access_token field)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codex-creds-"));
    const path = join(dir, "auth.json");
    await writeFile(path, JSON.stringify({ access_token: "openai-key-456" }));

    const result = await readCodexCredentials(path);
    expect(result).toEqual({ accessToken: "openai-key-456" });

    await rm(dir, { recursive: true });
  });

  it("reads token from valid auth file (api_key field)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codex-creds-"));
    const path = join(dir, "auth.json");
    await writeFile(path, JSON.stringify({ api_key: "openai-key-789" }));

    const result = await readCodexCredentials(path);
    expect(result).toEqual({ accessToken: "openai-key-789" });

    await rm(dir, { recursive: true });
  });

  it("reads token from ChatGPT auth format (tokens.id_token)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codex-creds-"));
    const path = join(dir, "auth.json");
    await writeFile(path, JSON.stringify({
      auth_mode: "chatgpt",
      tokens: { id_token: "eyJhbGciOiJSUzI1..." },
      last_refresh: "2026-03-24T18:31:17Z",
    }));

    const result = await readCodexCredentials(path);
    expect(result).toEqual({ accessToken: "eyJhbGciOiJSUzI1..." });

    await rm(dir, { recursive: true });
  });

  it("reads OPENAI_API_KEY from auth file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codex-creds-"));
    const path = join(dir, "auth.json");
    await writeFile(path, JSON.stringify({ OPENAI_API_KEY: "sk-proj-abc123" }));

    const result = await readCodexCredentials(path);
    expect(result).toEqual({ accessToken: "sk-proj-abc123" });

    await rm(dir, { recursive: true });
  });

  it("returns null when no recognized token field exists", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codex-creds-"));
    const path = join(dir, "auth.json");
    await writeFile(path, JSON.stringify({ someOtherKey: "value" }));

    const result = await readCodexCredentials(path);
    expect(result).toBeNull();

    await rm(dir, { recursive: true });
  });

  it("returns null when file contains invalid JSON", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codex-creds-"));
    const path = join(dir, "auth.json");
    await writeFile(path, "not valid json {{{");

    const result = await readCodexCredentials(path);
    expect(result).toBeNull();

    await rm(dir, { recursive: true });
  });

  it("returns null when token is empty string", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codex-creds-"));
    const path = join(dir, "auth.json");
    await writeFile(path, JSON.stringify({ token: "" }));

    const result = await readCodexCredentials(path);
    expect(result).toBeNull();

    await rm(dir, { recursive: true });
  });
});

import { describe, expect, it } from "vitest";

import { EnvSecretStore } from "../src/secrets/env-secret-store.js";
import { SecretToolStore } from "../src/secrets/secret-tool-store.js";
import { SecretResolutionError, SecretResolver } from "../src/secrets/secret-store.js";
import { SubprocessError } from "../src/utils/subprocess.js";

describe("EnvSecretStore", () => {
  it("resolves values from injected env", async () => {
    const store = new EnvSecretStore({
      env: {
        CODEX_TOKEN: "token-123",
      },
    });

    const value = await store.resolve({
      store: "env",
      env: "CODEX_TOKEN",
    });

    expect(value).toBe("token-123");
  });

  it("returns structured missing-secret errors", async () => {
    const store = new EnvSecretStore({
      env: {},
    });

    await expect(
      store.resolve({
        store: "env",
        env: "CLAUDE_TOKEN",
      }),
    ).rejects.toMatchObject({
      code: "secret_not_found",
    } satisfies Partial<SecretResolutionError>);
  });
});

describe("SecretToolStore", () => {
  it("executes secret-tool lookup with expected arguments", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const store = new SecretToolStore({
      resolveCommandInPathFn: () => "/usr/bin/secret-tool",
      runSubprocessFn: async (command, args) => {
        calls.push({
          command,
          args,
        });

        return {
          command,
          args,
          exitCode: 0,
          stdout: "copilot-value\n",
          stderr: "",
          durationMs: 2,
        };
      },
    });

    const value = await store.resolve({
      store: "secret-tool",
      service: "agent-bar",
      account: "copilot",
    });

    expect(value).toBe("copilot-value");
    expect(calls).toEqual([
      {
        command: "/usr/bin/secret-tool",
        args: ["lookup", "service", "agent-bar", "account", "copilot"],
      },
    ]);
  });

  it("returns structured errors when secret-tool is unavailable", async () => {
    const store = new SecretToolStore({
      resolveCommandInPathFn: () => null,
    });

    await expect(
      store.resolve({
        store: "secret-tool",
        service: "agent-bar",
        account: "codex",
      }),
    ).rejects.toMatchObject({
      code: "secret_store_unavailable",
    } satisfies Partial<SecretResolutionError>);
  });

  it("maps exit code 1 to missing-secret behavior", async () => {
    const store = new SecretToolStore({
      resolveCommandInPathFn: () => "/usr/bin/secret-tool",
      runSubprocessFn: async (command, args) => {
        throw new SubprocessError("missing secret", {
          command,
          args,
          exitCode: 1,
          stdout: "",
          stderr: "No matching secret",
          durationMs: 3,
        });
      },
    });

    await expect(
      store.resolve({
        store: "secret-tool",
        service: "agent-bar",
        account: "claude",
      }),
    ).rejects.toMatchObject({
      code: "secret_not_found",
    } satisfies Partial<SecretResolutionError>);
  });
});

describe("SecretResolver", () => {
  it("selects stores explicitly and rejects unsupported stores", async () => {
    const resolver = new SecretResolver([
      new EnvSecretStore({
        env: {
          COPILOT_TOKEN: "ok",
        },
      }),
    ]);

    await expect(
      resolver.resolve({
        store: "secret-tool",
        service: "agent-bar",
        account: "copilot",
      }),
    ).rejects.toMatchObject({
      code: "secret_store_unsupported",
    } satisfies Partial<SecretResolutionError>);
  });
});

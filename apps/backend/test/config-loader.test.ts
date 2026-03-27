import { describe, expect, it } from "vitest";

import { ConfigLoadError, loadBackendConfig } from "../src/config/config-loader.js";
import { resolveBackendConfigPath } from "../src/config/config-path.js";

describe("backend config path", () => {
  it("uses XDG_CONFIG_HOME when available", () => {
    const configPath = resolveBackendConfigPath({
      env: {
        XDG_CONFIG_HOME: "/tmp/xdg-config",
      },
      homeDir: "/home/fallback",
    });

    expect(configPath).toBe("/tmp/xdg-config/agent-bar/config.json");
  });

  it("falls back to home .config when XDG_CONFIG_HOME is missing", () => {
    const configPath = resolveBackendConfigPath({
      env: {},
      homeDir: "/home/ubuntu",
    });

    expect(configPath).toBe("/home/ubuntu/.config/agent-bar/config.json");
  });
});

describe("backend config loader", () => {
  it("returns defaults when config file is missing", async () => {
    const loaded = await loadBackendConfig({
      env: {
        XDG_CONFIG_HOME: "/tmp/custom-xdg",
      },
      fileExists: async () => false,
    });

    expect(loaded.exists).toBe(false);
    expect(loaded.path).toBe("/tmp/custom-xdg/agent-bar/config.json");
    expect(loaded.config.providers).toEqual([
      {
        id: "copilot",
        enabled: true,
        sourceMode: "api",
      },
      {
        id: "codex",
        enabled: true,
        sourceMode: "auto",
      },
      {
        id: "claude",
        enabled: true,
        sourceMode: "auto",
      },
    ]);
  });

  it("accepts ordered provider config with sourceMode preferences", async () => {
    const loaded = await loadBackendConfig({
      explicitPath: "/tmp/agent-bar.config.json",
      fileExists: async () => true,
      readTextFile: async () =>
        JSON.stringify({
          providers: [
            {
              id: "claude",
              enabled: false,
              sourceMode: "oauth",
            },
            {
              id: "codex",
              enabled: true,
              sourceMode: "cli",
            },
          ],
        }),
    });

    expect(loaded.exists).toBe(true);
    expect(loaded.config.providers.map((provider) => provider.id)).toEqual(["claude", "codex"]);
    expect(loaded.config.providers[0]?.sourceMode).toBe("oauth");
    expect(loaded.config.providers[0]?.enabled).toBe(false);
  });

  it("defaults enabled to true and sourceMode to auto when omitted", async () => {
    const loaded = await loadBackendConfig({
      explicitPath: "/tmp/agent-bar.defaults.json",
      fileExists: async () => true,
      readTextFile: async () =>
        JSON.stringify({
          providers: [
            {
              id: "claude",
            },
          ],
        }),
    });

    expect(loaded.config.providers[0]?.enabled).toBe(true);
    expect(loaded.config.providers[0]?.sourceMode).toBe("auto");
  });

  it("loads config with provider enabled/source defaults from missing file", async () => {
    const loaded = await loadBackendConfig({
      env: { XDG_CONFIG_HOME: "/tmp/defaults-check" },
      fileExists: async () => false,
    });

    expect(loaded.config.providers).toHaveLength(3);

    for (const provider of loaded.config.providers) {
      expect(provider.enabled).toBe(true);
      expect(typeof provider.sourceMode).toBe("string");
      expect(["auto", "api", "cli", "oauth"].includes(provider.sourceMode)).toBe(true);
    }

    expect(loaded.config.providers.find((p) => p.id === "claude")?.enabled).toBe(true);
    expect(loaded.config.providers.find((p) => p.id === "claude")?.sourceMode).toBe("auto");
  });

  it("respects enabled: false to disable a provider", async () => {
    const loaded = await loadBackendConfig({
      explicitPath: "/tmp/agent-bar.disabled.json",
      fileExists: async () => true,
      readTextFile: async () =>
        JSON.stringify({
          providers: [
            { id: "copilot", enabled: false },
            { id: "claude", enabled: true, sourceMode: "cli" },
          ],
        }),
    });

    const copilot = loaded.config.providers.find((p) => p.id === "copilot");
    const claude = loaded.config.providers.find((p) => p.id === "claude");

    expect(copilot?.enabled).toBe(false);
    expect(claude?.enabled).toBe(true);
    expect(claude?.sourceMode).toBe("cli");
  });

  it("rejects malformed JSON files", async () => {
    await expect(
      loadBackendConfig({
        explicitPath: "/tmp/agent-bar.bad.json",
        fileExists: async () => true,
        readTextFile: async () => "{not-json",
      }),
    ).rejects.toMatchObject({
      code: "config_parse_error",
    } satisfies Partial<ConfigLoadError>);
  });

  it("rejects invalid schema values", async () => {
    await expect(
      loadBackendConfig({
        explicitPath: "/tmp/agent-bar.invalid.json",
        fileExists: async () => true,
        readTextFile: async () =>
          JSON.stringify({
            providers: [
              {
                id: "copilot",
                enabled: true,
                sourceMode: "invalid-source-mode",
              },
            ],
          }),
      }),
    ).rejects.toMatchObject({
      code: "config_validation_error",
    } satisfies Partial<ConfigLoadError>);
  });
});

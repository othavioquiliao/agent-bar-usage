import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Settings module tests — verifies normalizeSettings, loadSettings,
 * loadSettingsSync, and saveSettings with atomic writes and migration support.
 *
 * Uses bun:test because settings.ts relies on Bun.file and Bun.write APIs.
 */

let tempDir: string;

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "settings-test-"));
}

function mockPaths(dir: string) {
  return {
    cliSymlink: join(dir, ".local", "bin", "agent-bar"),
    systemdDir: join(dir, "systemd", "user"),
    serviceFile: join(dir, "systemd", "user", "agent-bar.service"),
    overrideDir: join(dir, "systemd", "user", "agent-bar.service.d"),
    envOverride: join(dir, "systemd", "user", "agent-bar.service.d", "env.conf"),
    tmpfilesDir: join(dir, "user-tmpfiles.d"),
    tmpfilesConf: join(dir, "user-tmpfiles.d", "agent-bar.conf"),
    extensionDir: join(dir, "gnome-shell", "extensions", "agent-bar-ubuntu@othavio.dev"),
    settingsDir: join(dir, "agent-bar"),
    settingsFile: join(dir, "agent-bar", "settings.json"),
    configFile: join(dir, "agent-bar", "config.json"),
    cacheDir: join(dir, "cache", "agent-bar"),
  };
}

// Mock the paths module so settings.ts uses our temp directory
mock.module("../src/lifecycle/paths.js", () => ({
  APP_NAME: "agent-bar",
  getInstallPaths: () => mockPaths(tempDir),
}));

// Import after mocking
import { normalizeSettings, loadSettings, loadSettingsSync, saveSettings } from "../src/settings/settings.js";
import { DEFAULT_SETTINGS, CURRENT_VERSION } from "../src/settings/settings-schema.js";

describe("settings", () => {
  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("normalizeSettings", () => {
    it("returns DEFAULT_SETTINGS when given undefined", () => {
      const result = normalizeSettings(undefined);
      expect(result).toEqual(DEFAULT_SETTINGS);
      expect(result.version).toBe(1);
    });

    it("fills missing fields with defaults when given partial data", () => {
      const result = normalizeSettings({ version: 1 });
      expect(result.version).toBe(CURRENT_VERSION);
    });

    it("calls migrateSettings and returns current version when version < CURRENT_VERSION", () => {
      const result = normalizeSettings({ version: 0, extraField: "x" } as any);
      expect(result.version).toBe(CURRENT_VERSION);
    });
  });

  describe("loadSettings", () => {
    it("returns defaults when file does not exist", async () => {
      const result = await loadSettings();
      expect(result).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe("saveSettings", () => {
    it("writes JSON to temp file then renames (atomic write)", async () => {
      await saveSettings(DEFAULT_SETTINGS);

      const settingsPath = join(tempDir, "agent-bar", "settings.json");
      expect(existsSync(settingsPath)).toBe(true);

      // Verify no leftover tmp file
      const tmpPath = settingsPath + ".tmp";
      expect(existsSync(tmpPath)).toBe(false);

      // Verify content is valid JSON matching the settings
      const content = JSON.parse(readFileSync(settingsPath, "utf-8"));
      expect(content.version).toBe(DEFAULT_SETTINGS.version);
    });
  });

  describe("round-trip", () => {
    it("loadSettings round-trips through saveSettings correctly", async () => {
      await saveSettings(DEFAULT_SETTINGS);
      const loaded = await loadSettings();
      expect(loaded).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe("loadSettingsSync", () => {
    it("returns defaults when file does not exist", () => {
      const result = loadSettingsSync();
      expect(result).toEqual(DEFAULT_SETTINGS);
    });
  });
});

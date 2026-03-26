import { describe, expect, it } from "vitest";

import { diagnosticsReportSchema } from "shared-contract";

import { buildDiagnosticsReport } from "../src/core/prerequisite-checks.js";
import { formatDoctorReportAsText, runDoctorCommand } from "../src/commands/diagnostics-command.js";

describe("diagnostics prerequisites", () => {
  it("reports the status of config, CLI tools, tokens, node-pty, systemd env, and the service runtime", async () => {
    const homeDir = "/home/tester";
    const configPath = "/home/tester/.config/agent-bar/config.json";
    const overridePath = "/home/tester/.config/systemd/user/agent-bar.service.d/env.conf";

    const report = diagnosticsReportSchema.parse(
      await buildDiagnosticsReport({
        homeDir,
        env: {
          HOME: homeDir,
          PATH: "/usr/bin:/bin",
          COPILOT_API_TOKEN: "token",
        },
        fileExists: async (filePath) => filePath === configPath || filePath === overridePath,
        readTextFile: async () =>
          JSON.stringify({
            schemaVersion: 1,
            defaults: {
              ttlSeconds: 30,
            },
            providers: [
              {
                id: "copilot",
                enabled: true,
                sourceMode: "api",
              },
            ],
          }),
        resolveCommandInPathFn: (command) => {
          switch (command) {
            case "secret-tool":
              return "/usr/bin/secret-tool";
            case "codex":
              return "/usr/bin/codex";
            case "claude":
              return "/usr/bin/claude";
            default:
              return null;
          }
        },
        importModuleFn: async () => ({ ok: true }),
        now: () => new Date("2026-03-25T17:00:00.000Z"),
      }),
    );

    expect(report).toMatchObject({
      runtime_mode: "cli",
      checks: [
        {
          id: "config",
          status: "ok",
        },
        {
          id: "secret-tool",
          status: "ok",
        },
        {
          id: "codex-cli",
          status: "ok",
        },
        {
          id: "claude-cli",
          status: "ok",
        },
        {
          id: "node-pty",
          status: "ok",
        },
        {
          id: "copilot-token",
          status: "ok",
        },
        {
          id: "systemd-env",
          status: "ok",
        },
        {
          id: "service-runtime",
          status: "warn",
        },
      ],
    });

    expect(report.checks[1]?.suggested_command).toBe("sudo apt install libsecret-tools");
    expect(report.checks[4]?.suggested_command).toBe("sudo apt install build-essential python3 && pnpm install");
    expect(report.checks[5]?.suggested_command).toBe("agent-bar auth copilot");
    expect(report.checks[6]?.suggested_command).toBe("pnpm install:ubuntu");
  });

  it("renders a readable doctor report with suggestions", async () => {
    const text = await runDoctorCommand(
      {
        json: false,
      },
      {
        buildReport: () => ({
          generated_at: "2026-03-25T17:00:00.000Z",
          runtime_mode: "cli",
          checks: [
            {
              id: "secret-tool",
              label: "secret-tool",
              status: "error",
              message: "secret-tool is missing from PATH.",
              suggested_command: "sudo apt install libsecret-tools",
            },
          ],
        }),
      },
    );

    expect(text).toContain("Agent Bar Diagnostics");
    expect(text).toContain("ERROR secret-tool: secret-tool is missing from PATH.");
    expect(text).toContain("Suggested command: sudo apt install libsecret-tools");
  });

  it("formats reports as plain text for shell use", () => {
    const text = formatDoctorReportAsText({
      generated_at: "2026-03-25T17:00:00.000Z",
      runtime_mode: "service",
      checks: [
        {
          id: "service-runtime",
          label: "Service runtime",
          status: "ok",
          message: "Backend service is running at /tmp/agent-bar/service.sock.",
          suggested_command: "agent-bar service status --json",
          details: {
            socket_path: "/tmp/agent-bar/service.sock",
          },
        },
      ],
    });

    expect(text).toContain("Runtime mode: service");
    expect(text).toContain("OK    Service runtime: Backend service is running at /tmp/agent-bar/service.sock.");
    expect(text).toContain("Suggested command: agent-bar service status --json");
    expect(text).toContain('"socket_path":"/tmp/agent-bar/service.sock"');
  });

  it("warns when the systemd env override is missing and node-pty is unavailable", async () => {
    const homeDir = "/home/tester";
    const configPath = "/home/tester/.config/agent-bar/config.json";

    const report = await buildDiagnosticsReport({
      homeDir,
      env: {
        HOME: homeDir,
        PATH: "/usr/bin:/bin",
      },
      fileExists: async (filePath) => filePath === configPath,
      readTextFile: async () =>
        JSON.stringify({
          schemaVersion: 1,
          defaults: {
            ttlSeconds: 30,
          },
          providers: [],
        }),
      resolveCommandInPathFn: () => null,
      importModuleFn: async () => {
        throw new Error("native addon missing");
      },
      now: () => new Date("2026-03-25T17:00:00.000Z"),
    });

    expect(report.checks.find((check) => check.id === "node-pty")).toMatchObject({
      status: "error",
      suggested_command: "sudo apt install build-essential python3 && pnpm install",
    });
    expect(report.checks.find((check) => check.id === "systemd-env")).toMatchObject({
      status: "warn",
      suggested_command: "pnpm install:ubuntu",
    });
  });
});

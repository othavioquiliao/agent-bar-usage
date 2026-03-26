import { describe, expect, it } from "vitest";

import { diagnosticsReportSchema } from "shared-contract";

import { buildDiagnosticsReport } from "../src/core/prerequisite-checks.js";
import { runDoctorCommand } from "../src/commands/diagnostics-command.js";
import { formatDoctorAsText } from "../src/formatters/doctor-text-formatter.js";

describe("diagnostics prerequisites", () => {
  it("reports the status of config, CLI tools, tokens, and the service runtime", async () => {
    const homeDir = "/home/tester";
    const configPath = "/home/tester/.config/agent-bar/config.json";

    const report = diagnosticsReportSchema.parse(
      await buildDiagnosticsReport({
        homeDir,
        env: {
          HOME: homeDir,
          PATH: "/usr/bin:/bin",
          COPILOT_TOKEN: "token",
        },
        fileExists: async (filePath) => filePath === configPath,
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
          suggested_command: "sudo apt install libsecret-tools",
        },
        {
          id: "codex-cli",
          status: "ok",
          suggested_command: "npm install -g @openai/codex",
        },
        {
          id: "claude-cli",
          status: "ok",
          suggested_command: "npm install -g @anthropic-ai/claude-code",
        },
        {
          id: "copilot-token",
          status: "ok",
          suggested_command: "agent-bar auth copilot",
        },
        {
          id: "service-runtime",
          status: "warn",
        },
        {
          id: "node-pty",
          // node-pty is compiled in this project, so it should be ok
          status: "ok",
          suggested_command: "sudo apt install build-essential python3 && pnpm install",
        },
        {
          id: "systemd-env",
          // env override file does not exist in the test environment
          status: "warn",
          suggested_command: "pnpm install:ubuntu",
        },
      ],
    });

    expect(report.checks[0]?.suggested_command).toBe("agent-bar config validate");
    expect(report.checks[5]?.suggested_command).toBe("agent-bar service status --json");
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
              suggested_command: "which secret-tool",
            },
          ],
        }),
      },
    );

    expect(text).toContain("Agent Bar Doctor");
    expect(text).toContain("[FAIL] secret-tool: secret-tool is missing from PATH.");
    expect(text).toContain("-> which secret-tool");
  });

  it("formats reports as plain text for shell use", () => {
    const text = formatDoctorAsText({
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

    expect(text).toContain("Mode: service");
    expect(text).toContain("[ok] Service runtime: Backend service is running at /tmp/agent-bar/service.sock.");
    // ok checks should not show suggested command
    expect(text).not.toContain("->");
  });
});

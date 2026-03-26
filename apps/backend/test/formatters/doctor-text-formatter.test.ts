import { describe, it, expect } from "vitest";
import { formatDoctorAsText } from "../../src/formatters/doctor-text-formatter.js";

describe("formatDoctorAsText", () => {
  it("formats ok check with [ok] prefix", () => {
    const result = formatDoctorAsText({
      generated_at: "2026-01-01T00:00:00Z",
      runtime_mode: "service",
      checks: [
        {
          id: "secret-tool",
          label: "secret-tool",
          status: "ok",
          message: "Available at /usr/bin/secret-tool",
          suggested_command: "sudo apt install libsecret-tools",
        },
      ],
    });

    expect(result).toContain("[ok]");
    expect(result).toContain("secret-tool");
    expect(result).toContain("Available at /usr/bin/secret-tool");
    expect(result).toContain("Mode: service");
    // ok checks should NOT show suggested command
    expect(result).not.toContain("->");
  });

  it("formats warn check with [!!] prefix and suggested command", () => {
    const result = formatDoctorAsText({
      generated_at: "2026-01-01T00:00:00Z",
      runtime_mode: "cli",
      checks: [
        {
          id: "copilot-token",
          label: "Copilot token",
          status: "warn",
          message: "Not configured",
          suggested_command: "agent-bar auth copilot",
        },
      ],
    });

    expect(result).toContain("[!!]");
    expect(result).toContain("Copilot token");
    expect(result).toContain("-> agent-bar auth copilot");
    expect(result).toContain("Mode: cli");
  });

  it("formats error check with [FAIL] prefix and suggested command", () => {
    const result = formatDoctorAsText({
      generated_at: "2026-01-01T00:00:00Z",
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
    });

    expect(result).toContain("[FAIL]");
    expect(result).toContain("secret-tool");
    expect(result).toContain("-> sudo apt install libsecret-tools");
  });

  it("includes header line", () => {
    const result = formatDoctorAsText({
      generated_at: "2026-01-01T00:00:00Z",
      runtime_mode: "cli",
      checks: [],
    });

    expect(result).toContain("Agent Bar Doctor");
  });

  it("formats multiple checks", () => {
    const result = formatDoctorAsText({
      generated_at: "2026-01-01T00:00:00Z",
      runtime_mode: "service",
      checks: [
        {
          id: "secret-tool",
          label: "secret-tool",
          status: "ok",
          message: "Available",
          suggested_command: "sudo apt install libsecret-tools",
        },
        {
          id: "copilot-token",
          label: "Copilot token",
          status: "warn",
          message: "Missing",
          suggested_command: "agent-bar auth copilot",
        },
        {
          id: "codex-cli",
          label: "codex CLI",
          status: "error",
          message: "Not found",
          suggested_command: "npm install -g @openai/codex",
        },
      ],
    });

    expect(result).toContain("[ok]");
    expect(result).toContain("[!!]");
    expect(result).toContain("[FAIL]");
    // Only non-ok checks show suggestions
    expect(result).toContain("-> agent-bar auth copilot");
    expect(result).toContain("-> npm install -g @openai/codex");
  });
});

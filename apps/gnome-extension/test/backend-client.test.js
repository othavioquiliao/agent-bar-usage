import { describe, expect, it, vi } from "vitest";

import { createBackendClient } from "../services/backend-client.js";
import { resolveBackendInvocation } from "../utils/backend-command.js";

describe("backend command resolution", () => {
  it("prefers agent-bar from PATH and appends force refresh when requested", () => {
    const invocation = resolveBackendInvocation(
      { forceRefresh: true },
      {
        findProgramInPath: (programName) => (programName === "agent-bar" ? "/usr/bin/agent-bar" : null),
        repoRoot: "/repo",
      },
    );

    expect(invocation).toMatchObject({
      argv: ["/usr/bin/agent-bar", "usage", "--json", "--refresh"],
      cwd: "/repo",
      mode: "installed",
    });
  });

  it("falls back to the workspace-local tsx invocation when agent-bar is unavailable", () => {
    const invocation = resolveBackendInvocation(
      {},
      {
        findProgramInPath: () => null,
        repoRoot: "/repo",
        backendPackageRoot: "/repo/apps/backend",
        nodeBinary: "node",
      },
    );

    expect(invocation).toMatchObject({
      argv: ["node", "--import", "tsx", "/repo/apps/backend/src/cli.ts", "usage", "--json"],
      cwd: "/repo/apps/backend",
      mode: "workspace-dev",
    });
  });
});

describe("backend client", () => {
  it("parses backend JSON into a snapshot envelope", async () => {
    const snapshot = {
      schema_version: "1",
      generated_at: "2026-03-25T17:00:00.000Z",
      providers: [],
    };
    const runCommand = vi.fn(async () => ({
      success: true,
      stdout: JSON.stringify(snapshot),
      stderr: "",
      exitCode: 0,
    }));
    const client = createBackendClient({
      runCommand,
      findProgramInPath: () => "/usr/bin/agent-bar",
      repoRoot: "/repo",
    });

    await expect(client.fetchUsageSnapshot()).resolves.toEqual(snapshot);
  });

  it("surfaces backend command failures with stderr context", async () => {
    const client = createBackendClient({
      runCommand: vi.fn(async () => ({
        success: false,
        stdout: "",
        stderr: "provider unavailable",
        exitCode: 1,
      })),
      findProgramInPath: () => "/usr/bin/agent-bar",
      repoRoot: "/repo",
    });

    await expect(client.fetchUsageSnapshot()).rejects.toMatchObject({
      name: "BackendClientError",
      exitCode: 1,
      stderr: "provider unavailable",
    });
  });

  it("throws when backend stdout is not valid JSON", async () => {
    const client = createBackendClient({
      runCommand: vi.fn(async () => ({
        success: true,
        stdout: "{not-json}",
        stderr: "",
        exitCode: 0,
      })),
      findProgramInPath: () => "/usr/bin/agent-bar",
      repoRoot: "/repo",
    });

    await expect(client.fetchUsageSnapshot()).rejects.toThrow("Invalid JSON from backend stdout");
  });
});


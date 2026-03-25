import { access } from "node:fs/promises";

import type { DiagnosticsCheck, DiagnosticsReport } from "shared-contract";

import { loadBackendConfig } from "../config/config-loader.js";
import { resolveBackendConfigPath } from "../config/config-path.js";
import { resolveCommandInPath } from "../utils/subprocess.js";
import { resolveServiceSocketPath } from "../service/socket-path.js";
import { probeServiceStatus } from "../service/service-client.js";

export interface PrerequisiteChecksOptions {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
  now?: () => Date;
  fileExists?: (filePath: string) => Promise<boolean>;
  readTextFile?: (filePath: string) => Promise<string>;
  resolveCommandInPathFn?: (command: string, env?: NodeJS.ProcessEnv) => string | null;
}

const checks: Array<Pick<DiagnosticsCheck, "id" | "label" | "suggested_command">> = [
  { id: "config", label: "Config", suggested_command: "agent-bar config validate" },
  { id: "secret-tool", label: "secret-tool", suggested_command: "which secret-tool" },
  { id: "codex-cli", label: "Codex CLI", suggested_command: "codex --version" },
  { id: "claude-cli", label: "Claude CLI", suggested_command: "claude --version" },
  { id: "copilot-token", label: "Copilot token", suggested_command: "agent-bar config validate" },
  { id: "service-runtime", label: "Service runtime", suggested_command: "agent-bar service status --json" },
];

function makeCheck(check: DiagnosticsCheck): DiagnosticsCheck {
  return check;
}

function okCheck(
  base: Pick<DiagnosticsCheck, "id" | "label" | "suggested_command">,
  message: string,
  details?: DiagnosticsCheck["details"],
): DiagnosticsCheck {
  return makeCheck({
    ...base,
    status: "ok",
    message,
    ...(details ? { details } : {}),
  });
}

function warnCheck(
  base: Pick<DiagnosticsCheck, "id" | "label" | "suggested_command">,
  message: string,
  details?: DiagnosticsCheck["details"],
): DiagnosticsCheck {
  return makeCheck({
    ...base,
    status: "warn",
    message,
    ...(details ? { details } : {}),
  });
}

function errorCheck(
  base: Pick<DiagnosticsCheck, "id" | "label" | "suggested_command">,
  message: string,
  details?: DiagnosticsCheck["details"],
): DiagnosticsCheck {
  return makeCheck({
    ...base,
    status: "error",
    message,
    ...(details ? { details } : {}),
  });
}

async function doesFileExist(filePath: string, fileExists?: (filePath: string) => Promise<boolean>): Promise<boolean> {
  if (fileExists) {
    return await fileExists(filePath);
  }

  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function hasConfiguredCopilotToken(config: Awaited<ReturnType<typeof loadBackendConfig>>["config"], env: NodeJS.ProcessEnv): boolean {
  const envSources = ["COPILOT_TOKEN", "GITHUB_TOKEN", "GH_TOKEN"];
  if (envSources.some((name) => Boolean(env[name]?.trim()))) {
    return true;
  }

  const copilot = config.providers.find((provider) => provider.id === "copilot");
  return Boolean(copilot?.secretRef);
}

export async function buildDiagnosticsReport(options: PrerequisiteChecksOptions = {}): Promise<DiagnosticsReport> {
  const env = options.env ?? process.env;
  const configPath = resolveBackendConfigPath({ env, homeDir: options.homeDir });
  const loadedConfig = await loadBackendConfig({
    env,
    homeDir: options.homeDir,
    fileExists: options.fileExists,
    readTextFile: options.readTextFile,
  });
  const serviceSocketPath = resolveServiceSocketPath({ env, homeDir: options.homeDir });
  const serviceStatus = await probeServiceStatus(serviceSocketPath);
  const resolveCommand = options.resolveCommandInPathFn ?? resolveCommandInPath;

  const reportChecks: DiagnosticsCheck[] = [];
  reportChecks.push(
    loadedConfig.exists
      ? okCheck(
          checks[0],
          `Config file loaded from ${configPath}.`,
          { path: configPath, exists: true },
        )
      : warnCheck(
          checks[0],
          `No config file found at ${configPath}; defaults are active.`,
          { path: configPath, exists: false },
        ),
  );

  for (const index of [1, 2, 3] as const) {
    const check = checks[index];
    const commandName = check.id === "secret-tool" ? "secret-tool" : check.id === "codex-cli" ? "codex" : "claude";
    const resolved = resolveCommand(commandName, env);
    reportChecks.push(
      resolved
        ? okCheck(check, `${check.label} is available at ${resolved}.`, { command: resolved })
        : errorCheck(check, `${check.label} is missing from PATH.`, { command: commandName }),
    );
  }

  reportChecks.push(
    hasConfiguredCopilotToken(loadedConfig.config, env)
      ? okCheck(
          checks[4],
          "Copilot token source is configured.",
          {
            env_sources: ["COPILOT_TOKEN", "GITHUB_TOKEN", "GH_TOKEN"],
          },
        )
      : warnCheck(
          checks[4],
          "Copilot token source is not configured.",
          {
            env_sources: ["COPILOT_TOKEN", "GITHUB_TOKEN", "GH_TOKEN"],
          },
        ),
  );

  reportChecks.push(
    serviceStatus?.running
      ? okCheck(
          checks[5],
          `Backend service is running at ${serviceSocketPath}.`,
          {
            socket_path: serviceSocketPath,
            last_error: serviceStatus.last_error,
          },
        )
      : warnCheck(
          checks[5],
          `Backend service is not running at ${serviceSocketPath}.`,
          {
            socket_path: serviceSocketPath,
            last_error: serviceStatus?.last_error ?? null,
          },
        ),
  );

  return {
    generated_at: (options.now ?? (() => new Date()))().toISOString(),
    runtime_mode: serviceStatus?.running ? "service" : "cli",
    checks: reportChecks,
  };
}


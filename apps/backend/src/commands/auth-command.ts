import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";

import type { Command } from "commander";

import { resolveBackendConfigPath } from "../config/config-path.js";
import { resolveCommandInPath, runSubprocess } from "../utils/subprocess.js";
import {
  pollForAccessToken,
  requestDeviceCode,
  type DeviceCodeResponse,
  type DeviceFlowResult,
} from "../auth/github-device-flow.js";
import { storeSecretViaSecretTool } from "../auth/secret-tool-writer.js";
import { ensureCopilotSecretRef } from "../auth/config-writer.js";

const DEFAULT_SECRET_SERVICE = "agent-bar";
const DEFAULT_SECRET_ACCOUNT = "copilot";
const DEFAULT_SECRET_LABEL = "Agent Bar Copilot";

export interface AuthCommandRuntimeOptions {
  clientId?: string;
  configPath?: string;
  noBrowser?: boolean;
}

export interface AuthCommandDependencies {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
  stdout?: Pick<NodeJS.WriteStream, "write">;
  requestDeviceCodeFn?: (
    clientId: string,
    scope: string,
  ) => Promise<DeviceCodeResponse>;
  pollForAccessTokenFn?: (
    clientId: string,
    deviceCode: string,
    interval: number,
    expiresIn: number,
  ) => Promise<DeviceFlowResult>;
  storeSecretFn?: (
    service: string,
    account: string,
    value: string,
    label?: string,
  ) => Promise<void>;
  ensureCopilotSecretRefFn?: (
    configPath: string,
    secretRef: {
      store: "secret-tool";
      service: string;
      account: string;
    },
  ) => Promise<void>;
  promptForEnterFn?: (message: string) => Promise<void>;
  openUrlFn?: (url: string) => Promise<boolean>;
  restartServiceFn?: () => Promise<boolean>;
}

export class CopilotAuthCommandError extends Error {
  constructor(
    readonly code: "client_id_missing",
    message: string,
  ) {
    super(message);
    this.name = "CopilotAuthCommandError";
  }
}

export async function runCopilotAuthCommand(
  options: AuthCommandRuntimeOptions = {},
  dependencies: AuthCommandDependencies = {},
): Promise<void> {
  const env = dependencies.env ?? process.env;
  const stdout = dependencies.stdout ?? process.stdout;
  const clientId = resolveClientId(options.clientId, env);
  const requestDeviceCodeFn = dependencies.requestDeviceCodeFn ?? defaultRequestDeviceCode;
  const pollForAccessTokenFn = dependencies.pollForAccessTokenFn ?? defaultPollForAccessToken;
  const storeSecretFn = dependencies.storeSecretFn ?? defaultStoreSecret;
  const ensureCopilotSecretRefFn = dependencies.ensureCopilotSecretRefFn ?? defaultEnsureCopilotSecretRef;
  const promptForEnterFn = dependencies.promptForEnterFn ?? defaultPromptForEnter;
  const openUrlFn = dependencies.openUrlFn ?? openUrlInBrowser;
  const restartServiceFn = dependencies.restartServiceFn ?? restartAgentBarService;

  stdout.write("Requesting device code from GitHub...\n\n");
  const deviceCode = await requestDeviceCodeFn(clientId, "copilot");

  stdout.write(`! Copy this code: ${deviceCode.user_code}\n`);
  stdout.write(`  Then open: ${deviceCode.verification_uri}\n`);

  if (!options.noBrowser) {
    await promptForEnterFn("  Press Enter to open your browser...");
    await openUrlFn(deviceCode.verification_uri);
    stdout.write("\n");
  } else {
    stdout.write("  Browser auto-open skipped.\n\n");
  }

  stdout.write(`  Waiting for authorization... (expires in ${formatDuration(deviceCode.expires_in)})\n`);
  const token = await pollForAccessTokenFn(
    clientId,
    deviceCode.device_code,
    deviceCode.interval,
    deviceCode.expires_in,
  );

  await storeSecretFn(
    DEFAULT_SECRET_SERVICE,
    DEFAULT_SECRET_ACCOUNT,
    token.access_token,
    DEFAULT_SECRET_LABEL,
  );

  const configPath = options.configPath ?? resolveBackendConfigPath({
    env,
    homeDir: dependencies.homeDir,
  });

  await ensureCopilotSecretRefFn(configPath, {
    store: "secret-tool",
    service: DEFAULT_SECRET_SERVICE,
    account: DEFAULT_SECRET_ACCOUNT,
  });

  const restarted = await restartServiceFn();

  stdout.write("\n");
  stdout.write("✓ Authenticated!\n");
  stdout.write(`  Token stored in GNOME Keyring (service=${DEFAULT_SECRET_SERVICE}, account=${DEFAULT_SECRET_ACCOUNT}).\n`);
  stdout.write(`  Config updated at ${configPath}.\n`);
  stdout.write(restarted ? "  Service restarted.\n" : "  Service restart skipped.\n");
  stdout.write('\n  Run "agent-bar doctor --json" to verify.\n');
}

export function registerAuthCommand(program: Command, dependencies: AuthCommandDependencies = {}): void {
  const authCommand = program
    .command("auth")
    .description("Authenticate provider credentials for the local backend.");

  authCommand
    .command("copilot")
    .description("Authenticate Copilot via GitHub Device Flow and store the token in secret-tool.")
    .option("--client-id <clientId>", "Override the GitHub OAuth client id")
    .option("--config-path <path>", "Use an explicit backend config path")
    .option("--no-browser", "Skip xdg-open and show the verification URL only")
    .action(async (options: AuthCommandRuntimeOptions) => {
      await runCopilotAuthCommand(options, dependencies);
    });
}

function resolveClientId(clientId: string | undefined, env: NodeJS.ProcessEnv): string {
  const resolved = clientId?.trim() || env.AGENT_BAR_GITHUB_CLIENT_ID?.trim();

  if (!resolved) {
    throw new CopilotAuthCommandError(
      "client_id_missing",
      "GitHub OAuth client id is required. Re-run with `agent-bar auth copilot --client-id <id>` or set `AGENT_BAR_GITHUB_CLIENT_ID`.",
    );
  }

  return resolved;
}

async function defaultRequestDeviceCode(clientId: string, scope: string): Promise<DeviceCodeResponse> {
  return await requestDeviceCode(clientId, scope);
}

async function defaultPollForAccessToken(
  clientId: string,
  deviceCode: string,
  interval: number,
  expiresIn: number,
): Promise<DeviceFlowResult> {
  return await pollForAccessToken(clientId, deviceCode, interval, expiresIn);
}

async function defaultStoreSecret(
  service: string,
  account: string,
  value: string,
  label = DEFAULT_SECRET_LABEL,
): Promise<void> {
  await storeSecretViaSecretTool(service, account, value, label);
}

async function defaultEnsureCopilotSecretRef(
  configPath: string,
  secretRef: {
    store: "secret-tool";
    service: string;
    account: string;
  },
): Promise<void> {
  await ensureCopilotSecretRef(configPath, secretRef);
}

async function defaultPromptForEnter(message: string): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return;
  }

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    await readline.question(`${message}\n`);
  } finally {
    readline.close();
  }
}

async function openUrlInBrowser(url: string): Promise<boolean> {
  const command = resolveCommandInPath("xdg-open");

  if (!command) {
    return false;
  }

  try {
    const child = spawn(command, [url], {
      detached: true,
      stdio: "ignore",
    });

    child.unref();
    return true;
  } catch {
    return false;
  }
}

async function restartAgentBarService(): Promise<boolean> {
  const command = resolveCommandInPath("systemctl");

  if (!command) {
    return false;
  }

  try {
    await runSubprocess(command, ["--user", "restart", "agent-bar.service"], {
      timeoutMs: 10_000,
    });
    return true;
  } catch {
    return false;
  }
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.ceil(totalSeconds / 60);

  if (minutes <= 1) {
    return "1 minute";
  }

  return `${minutes} minutes`;
}

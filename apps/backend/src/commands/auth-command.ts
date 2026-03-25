/**
 * `agent-bar auth copilot` — GitHub Device Flow authentication for Copilot.
 *
 * Flow:
 *  1. Request a device code from GitHub.
 *  2. Show the user code + verification URL; try xdg-open to open browser.
 *  3. Wait for Enter from the user.
 *  4. Poll GitHub for the access token.
 *  5. Store the token in GNOME Keyring via secret-tool.
 *  6. Ensure config.json has the copilot secretRef.
 *  7. Restart the agent-bar systemd service (best-effort).
 */

import { exec } from "node:child_process";
import * as readline from "node:readline";
import path from "node:path";
import os from "node:os";
import type { Command } from "commander";

import { requestDeviceCode, pollForAccessToken } from "../auth/github-device-flow.js";
import { storeSecretViaSecretTool } from "../auth/secret-tool-writer.js";
import { ensureCopilotSecretRef } from "../auth/config-writer.js";
import { runSubprocess } from "../utils/subprocess.js";

/** GitHub OAuth App client ID for Agent Bar. Override with --client-id for testing. */
const DEFAULT_CLIENT_ID = "Ov23liWCdSLUEPTXJz4c";

const COPILOT_SERVICE = "agent-bar";
const COPILOT_ACCOUNT = "copilot";
const COPILOT_LABEL = "Agent Bar Copilot";
const COPILOT_SCOPE = "copilot";

export interface AuthCommandOptions {
  clientId?: string;
}

export interface AuthCommandDependencies {
  fetchFn?: typeof fetch;
  storeSecret?: typeof storeSecretViaSecretTool;
  ensureConfigRef?: typeof ensureCopilotSecretRef;
  resolveConfigPath?: () => string;
  openBrowser?: (url: string) => void;
  waitForEnter?: () => Promise<void>;
  restartService?: () => Promise<void>;
}

export async function runAuthCopilotCommand(
  options: AuthCommandOptions = {},
  dependencies: AuthCommandDependencies = {},
): Promise<void> {
  const clientId = options.clientId ?? DEFAULT_CLIENT_ID;
  const fetchFn = dependencies.fetchFn ?? fetch;
  const store = dependencies.storeSecret ?? storeSecretViaSecretTool;
  const ensureRef = dependencies.ensureConfigRef ?? ensureCopilotSecretRef;
  const resolveConfig =
    dependencies.resolveConfigPath ??
    (() => {
      const xdgConfigHome = process.env.XDG_CONFIG_HOME;
      const configRoot =
        xdgConfigHome && xdgConfigHome.trim().length > 0
          ? xdgConfigHome
          : path.join(os.homedir(), ".config");
      return path.join(configRoot, "agent-bar", "config.json");
    });
  const openBrowser = dependencies.openBrowser ?? defaultOpenBrowser;
  const waitForEnter = dependencies.waitForEnter ?? defaultWaitForEnter;
  const restart = dependencies.restartService ?? defaultRestartService;

  process.stdout.write("\n  Requesting device code from GitHub...\n\n");

  const deviceCode = await requestDeviceCode(clientId, COPILOT_SCOPE, fetchFn);

  process.stdout.write(`! Copy this code: ${deviceCode.user_code}\n`);
  process.stdout.write(`  Then open:      ${deviceCode.verification_uri}\n`);
  process.stdout.write("  Press Enter to open your browser...\n");

  openBrowser(deviceCode.verification_uri);
  await waitForEnter();

  const expiresMinutes = Math.round(deviceCode.expires_in / 60);
  process.stdout.write(`\n  Waiting for authorization... (expires in ${expiresMinutes} minutes)\n`);

  const tokenResult = await pollForAccessToken(
    clientId,
    deviceCode.device_code,
    deviceCode.interval,
    deviceCode.expires_in,
    fetchFn,
  );

  process.stdout.write("\n  Storing token in GNOME Keyring...\n");
  await store(COPILOT_SERVICE, COPILOT_ACCOUNT, tokenResult.access_token, COPILOT_LABEL);

  process.stdout.write("  Updating config...\n");
  const configPath = resolveConfig();
  await ensureRef(configPath, {
    store: "secret-tool",
    service: COPILOT_SERVICE,
    account: COPILOT_ACCOUNT,
  });

  process.stdout.write("  Restarting agent-bar service...\n");
  await restart();

  process.stdout.write("\n\u2713 Authenticated!\n");
  process.stdout.write(
    `  Token stored in GNOME Keyring (service=${COPILOT_SERVICE}, account=${COPILOT_ACCOUNT}).\n`,
  );
  process.stdout.write(`  Config updated at ${configPath}.\n`);
  process.stdout.write("  Service restarted.\n\n");
  process.stdout.write('  Run "agent-bar doctor --json" to verify.\n\n');
}

export function registerAuthCommand(program: Command): void {
  const auth = program.command("auth").description("Authenticate with AI providers.");

  auth
    .command("copilot")
    .description("Authenticate with GitHub Copilot using Device Flow OAuth.")
    .option("--client-id <id>", "GitHub OAuth App client ID (overrides built-in default)")
    .action(async (options: AuthCommandOptions) => {
      try {
        await runAuthCopilotCommand(options);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`\nError: ${message}\n`);
        process.exitCode = 1;
      }
    });
}

function defaultOpenBrowser(url: string): void {
  exec(`xdg-open ${url}`, () => {
    // Intentionally silent — xdg-open may not be available in all environments
  });
}

async function defaultWaitForEnter(): Promise<void> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("", () => {
      rl.close();
      resolve();
    });
  });
}

async function defaultRestartService(): Promise<void> {
  try {
    await runSubprocess("systemctl", ["--user", "restart", "agent-bar.service"]);
  } catch {
    // Best-effort: service may not be installed yet
  }
}

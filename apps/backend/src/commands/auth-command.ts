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

import { exec } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import * as readline from 'node:readline';
import { ensureCopilotSecretRef } from '../auth/config-writer.js';
import { type FetchLike, pollForAccessToken, requestDeviceCode } from '../auth/github-device-flow.js';
import { storeSecretViaSecretTool } from '../auth/secret-tool-writer.js';
import { readClaudeCredentials } from '../providers/claude/claude-credentials.js';
import { readCodexCredentials } from '../providers/codex/codex-credentials.js';
import { runSubprocess } from '../utils/subprocess.js';

/** GitHub OAuth App client ID for Agent Bar. Override with --client-id for testing. */
const DEFAULT_CLIENT_ID = 'Ov23lisTTc3tiqjyvwL6';

const COPILOT_SERVICE = 'agent-bar';
const COPILOT_ACCOUNT = 'copilot';
const COPILOT_LABEL = 'Agent Bar Copilot';
const COPILOT_SCOPE = 'copilot';

export interface AuthCommandOptions {
  clientId?: string;
  token?: string;
}

export const AUTH_PROVIDER_COMMANDS = ['copilot', 'claude', 'codex'] as const;
export type AuthProviderCommand = (typeof AUTH_PROVIDER_COMMANDS)[number];

export const COPILOT_SETUP_GUIDE = `  Como configurar o Copilot manualmente:

  1. Abra https://github.com/settings/tokens?type=beta
  2. Clique "Generate new token"
  3. De um nome (ex: "agent-bar"), selecione expiration, e crie
  4. Copie o token e rode:

     agent-bar auth copilot --token ghp_SEU_TOKEN

  5. Verifique:

     agent-bar doctor

`;

export interface AuthCommandDependencies {
  fetchFn?: FetchLike;
  storeSecret?: typeof storeSecretViaSecretTool;
  ensureConfigRef?: typeof ensureCopilotSecretRef;
  resolveConfigPath?: () => string;
  openBrowser?: (url: string) => void;
  waitForEnter?: () => Promise<void>;
  restartService?: () => Promise<void>;
}

interface CopilotAuthRuntime {
  store: typeof storeSecretViaSecretTool;
  ensureRef: typeof ensureCopilotSecretRef;
  resolveConfig: () => string;
  restart: () => Promise<void>;
}

async function persistCopilotAuthentication(token: string, runtime: CopilotAuthRuntime): Promise<string> {
  process.stdout.write('\n  Storing token in GNOME Keyring...\n');
  await runtime.store(COPILOT_SERVICE, COPILOT_ACCOUNT, token, COPILOT_LABEL);

  process.stdout.write('  Updating config...\n');
  const configPath = runtime.resolveConfig();
  await runtime.ensureRef(configPath, {
    store: 'secret-tool',
    service: COPILOT_SERVICE,
    account: COPILOT_ACCOUNT,
  });

  process.stdout.write('  Restarting agent-bar service...\n');
  await runtime.restart();

  return configPath;
}

function printCopilotAuthSuccess(configPath: string): void {
  process.stdout.write('\n\u2713 Authenticated!\n');
  process.stdout.write(`  Token stored in GNOME Keyring (service=${COPILOT_SERVICE}, account=${COPILOT_ACCOUNT}).\n`);
  process.stdout.write(`  Config updated at ${configPath}.\n`);
  process.stdout.write('  Service restarted.\n\n');
  process.stdout.write('  Run "agent-bar doctor --json" to verify.\n\n');
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
        xdgConfigHome && xdgConfigHome.trim().length > 0 ? xdgConfigHome : path.join(os.homedir(), '.config');
      return path.join(configRoot, 'agent-bar', 'config.json');
    });
  const openBrowser = dependencies.openBrowser ?? defaultOpenBrowser;
  const waitForEnter = dependencies.waitForEnter ?? defaultWaitForEnter;
  const restart = dependencies.restartService ?? defaultRestartService;
  const runtime: CopilotAuthRuntime = {
    store,
    ensureRef,
    resolveConfig,
    restart,
  };

  // If --token provided, skip Device Flow entirely and store directly
  if (options.token) {
    const configPath = await persistCopilotAuthentication(options.token, runtime);
    printCopilotAuthSuccess(configPath);
    return;
  }

  process.stdout.write('\n  Requesting device code from GitHub...\n\n');

  let deviceCode: Awaited<ReturnType<typeof requestDeviceCode>>;
  try {
    deviceCode = await requestDeviceCode(clientId, COPILOT_SCOPE, fetchFn);
  } catch (deviceError: unknown) {
    const msg = deviceError instanceof Error ? deviceError.message : String(deviceError);
    process.stderr.write(`\n  Device Flow falhou: ${msg}\n\n`);
    process.stderr.write(COPILOT_SETUP_GUIDE);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`! Copy this code: ${deviceCode.user_code}\n`);
  process.stdout.write(`  Then open:      ${deviceCode.verification_uri}\n`);
  process.stdout.write('  Press Enter to open your browser...\n');

  await waitForEnter();
  openBrowser(deviceCode.verification_uri);

  const expiresMinutes = Math.round(deviceCode.expires_in / 60);
  process.stdout.write(`\n  Waiting for authorization... (expires in ${expiresMinutes} minutes)\n`);

  let tokenResult: Awaited<ReturnType<typeof pollForAccessToken>>;
  try {
    tokenResult = await pollForAccessToken(
      clientId,
      deviceCode.device_code,
      deviceCode.interval,
      deviceCode.expires_in,
      fetchFn,
    );
  } catch (pollError: unknown) {
    const msg = pollError instanceof Error ? pollError.message : String(pollError);
    process.stderr.write(`\n  Device Flow falhou: ${msg}\n\n`);
    process.stderr.write(COPILOT_SETUP_GUIDE);
    process.exitCode = 1;
    return;
  }

  const configPath = await persistCopilotAuthentication(tokenResult.access_token, runtime);
  printCopilotAuthSuccess(configPath);
}

export interface AuthClaudeCommandDependencies {
  readCredentials?: typeof readClaudeCredentials;
}

export async function runAuthClaudeCommand(dependencies: AuthClaudeCommandDependencies = {}): Promise<void> {
  const read = dependencies.readCredentials ?? readClaudeCredentials;
  const credentials = await read();

  if (!credentials) {
    process.stderr.write('Claude credentials not found.\n  -> Run: claude auth login\n');
    process.exitCode = 1;
    return;
  }

  process.stdout.write('Claude: authenticated (token found in ~/.claude/.credentials.json)\n');
}

export interface AuthCodexCommandDependencies {
  readCredentials?: typeof readCodexCredentials;
}

export async function runAuthCodexCommand(dependencies: AuthCodexCommandDependencies = {}): Promise<void> {
  const read = dependencies.readCredentials ?? readCodexCredentials;
  const credentials = await read();

  if (!credentials) {
    process.stderr.write('Codex credentials not found.\n  -> Run: codex auth login\n');
    process.exitCode = 1;
    return;
  }

  process.stdout.write('Codex: authenticated (token found in ~/.codex/auth.json)\n');
}

export async function runAuthCommand(command: AuthProviderCommand, options: AuthCommandOptions = {}): Promise<void> {
  switch (command) {
    case 'copilot':
      await runAuthCopilotCommand(options);
      return;
    case 'claude':
      await runAuthClaudeCommand();
      return;
    case 'codex':
      await runAuthCodexCommand();
      return;
  }
}

function defaultOpenBrowser(url: string): void {
  exec(`xdg-open ${url}`, () => {
    // Intentionally silent — xdg-open may not be available in all environments
  });
}

async function defaultWaitForEnter(): Promise<void> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('', () => {
      rl.close();
      resolve();
    });
  });
}

async function defaultRestartService(): Promise<void> {
  try {
    await runSubprocess('systemctl', ['--user', 'restart', 'agent-bar.service']);
  } catch {
    // Best-effort: service may not be installed yet
  }
}

import * as p from '@clack/prompts';

import { resolveCommandInPath } from '../utils/subprocess.js';
import {
  type AuthClaudeCommandDependencies,
  type AuthCodexCommandDependencies,
  runAuthClaudeCommand,
  runAuthCodexCommand,
  runAuthCopilotCommand,
} from './auth-command.js';

type LoginChoice = 'copilot' | 'claude' | 'codex' | 'back';
type CopilotLoginMode = 'device' | 'token' | 'back';

interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

interface SelectPromptOptions {
  message: string;
  options: SelectOption[];
}

interface ConfirmPromptOptions {
  message: string;
  initialValue?: boolean;
}

interface TextPromptOptions {
  message: string;
  placeholder?: string;
  validate?: (value: string) => string | undefined;
}

export interface LoginCommandDependencies {
  selectPrompt?: (options: SelectPromptOptions) => Promise<string | symbol>;
  confirmPrompt?: (options: ConfirmPromptOptions) => Promise<boolean | symbol>;
  textPrompt?: (options: TextPromptOptions) => Promise<string | symbol>;
  note?: (message: string, title?: string) => void;
  isCancel?: (value: unknown) => boolean;
  log?: {
    error: (message: string) => void;
    warn: (message: string) => void;
  };
  resolveCommandInPathFn?: typeof resolveCommandInPath;
  launchExternalCommand?: (command: string, args?: string[]) => Promise<number>;
  runAuthCopilotCommandFn?: typeof runAuthCopilotCommand;
  runAuthClaudeCommandFn?: (dependencies?: AuthClaudeCommandDependencies) => Promise<void>;
  runAuthCodexCommandFn?: (dependencies?: AuthCodexCommandDependencies) => Promise<void>;
}

function defaultSelectPrompt(options: SelectPromptOptions): Promise<string | symbol> {
  return p.select(options as never) as Promise<string | symbol>;
}

function defaultConfirmPrompt(options: ConfirmPromptOptions): Promise<boolean | symbol> {
  return p.confirm(options) as Promise<boolean | symbol>;
}

function defaultTextPrompt(options: TextPromptOptions): Promise<string | symbol> {
  return p.text(options as never) as Promise<string | symbol>;
}

async function defaultLaunchExternalCommand(command: string, args: string[] = []): Promise<number> {
  const proc = Bun.spawn([command, ...args], {
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });

  return await proc.exited;
}

async function runExternalLoginFlow(
  providerName: string,
  command: string,
  args: string[],
  installHint: string,
  verifyAuth: () => Promise<void>,
  dependencies: LoginCommandDependencies,
): Promise<void> {
  const note = dependencies.note ?? p.note;
  const confirmPrompt = dependencies.confirmPrompt ?? defaultConfirmPrompt;
  const isCancel = dependencies.isCancel ?? p.isCancel;
  const log = dependencies.log ?? p.log;
  const resolveCommand = dependencies.resolveCommandInPathFn ?? resolveCommandInPath;
  const launch = dependencies.launchExternalCommand ?? defaultLaunchExternalCommand;

  note(
    [`This will run ${command} ${args.join(' ')}`.trim(), 'Complete the provider CLI flow, then return here.'].join(
      '\n',
    ),
    `${providerName} Login`,
  );

  const proceed = await confirmPrompt({
    message: `Launch ${providerName} login now?`,
    initialValue: true,
  });

  if (isCancel(proceed) || !proceed) {
    return;
  }

  if (!resolveCommand(command)) {
    log.error(installHint);
    process.exitCode = 1;
    return;
  }

  const exitCode = await launch(command, args);
  if (exitCode !== 0) {
    log.warn(`${providerName} login exited with code ${exitCode}.`);
    process.exitCode = 1;
    return;
  }

  await verifyAuth();
}

export async function runProviderLoginMenu(dependencies: LoginCommandDependencies = {}): Promise<void> {
  const selectPrompt = dependencies.selectPrompt ?? defaultSelectPrompt;
  const textPrompt = dependencies.textPrompt ?? defaultTextPrompt;
  const note = dependencies.note ?? p.note;
  const isCancel = dependencies.isCancel ?? p.isCancel;
  const runCopilotAuth = dependencies.runAuthCopilotCommandFn ?? runAuthCopilotCommand;
  const runClaudeAuth = dependencies.runAuthClaudeCommandFn ?? runAuthClaudeCommand;
  const runCodexAuth = dependencies.runAuthCodexCommandFn ?? runAuthCodexCommand;

  const providerChoice = (await selectPrompt({
    message: 'Choose a provider login flow',
    options: [
      {
        value: 'copilot',
        label: 'Copilot',
        hint: 'device flow or paste a GitHub token',
      },
      {
        value: 'claude',
        label: 'Claude',
        hint: 'launch claude auth login',
      },
      {
        value: 'codex',
        label: 'Codex',
        hint: 'launch codex auth login',
      },
      {
        value: 'back',
        label: 'Back',
      },
    ],
  })) as LoginChoice | symbol;

  if (isCancel(providerChoice) || providerChoice === 'back') {
    return;
  }

  switch (providerChoice) {
    case 'copilot': {
      note(
        [
          'Copilot can authenticate through GitHub device flow or by storing an existing token.',
          'The device flow opens GitHub in your browser and asks you to confirm the code.',
        ].join('\n'),
        'Copilot Login',
      );

      const mode = (await selectPrompt({
        message: 'How do you want to authenticate Copilot?',
        options: [
          {
            value: 'device',
            label: 'Browser device flow',
            hint: 'request a code and open GitHub',
          },
          {
            value: 'token',
            label: 'Paste token',
            hint: 'store an existing GitHub token directly',
          },
          {
            value: 'back',
            label: 'Back',
          },
        ],
      })) as CopilotLoginMode | symbol;

      if (isCancel(mode) || mode === 'back') {
        return;
      }

      if (mode === 'token') {
        const token = await textPrompt({
          message: 'Paste the GitHub token to store',
          placeholder: 'ghp_...',
          validate: (value) => (value.trim().length === 0 ? 'Token is required.' : undefined),
        });

        if (isCancel(token) || typeof token !== 'string') {
          return;
        }

        await runCopilotAuth({ token: token.trim() });
        return;
      }

      await runCopilotAuth({});
      return;
    }
    case 'claude':
      await runExternalLoginFlow(
        'Claude',
        'claude',
        ['auth', 'login'],
        'Claude CLI is missing. Run: npm install -g @anthropic-ai/claude-code',
        async () => await runClaudeAuth(),
        dependencies,
      );
      return;
    case 'codex':
      await runExternalLoginFlow(
        'Codex',
        'codex',
        ['auth', 'login'],
        'Codex CLI is missing. Run: npm install -g @openai/codex',
        async () => await runCodexAuth(),
        dependencies,
      );
      return;
  }
}

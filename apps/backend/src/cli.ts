#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { assertProviderId, assertSnapshotEnvelope, type ProviderId } from 'shared-contract';

import {
  AUTH_PROVIDER_COMMANDS,
  type AuthCommandOptions,
  type AuthProviderCommand,
  runAuthCommand,
} from './commands/auth-command.js';
import { formatConfigCommandError, runConfigDumpCommand, runConfigValidateCommand } from './commands/config-command.js';
import { type DoctorCommandOptions, runDoctorCommand } from './commands/diagnostics-command.js';
import { LIFECYCLE_COMMANDS, type LifecycleCommand, runLifecycleCommand } from './commands/lifecycle-command.js';
import { runMenuCommand } from './commands/menu-command.js';
import { type ProvidersCommandOptions, runProvidersCommand } from './commands/providers-command.js';
import {
  runServiceRefreshCommand,
  runServiceRunCommand,
  runServiceSnapshotCommand,
  runServiceStatusCommand,
  type ServiceCommandOptions,
} from './commands/service-command.js';
import {
  createUsageSnapshot,
  type UsageCommandOptions as SharedUsageCommandOptions,
  type UsageCommandDependencies,
} from './core/usage-snapshot.js';
import { formatSnapshotAsText } from './formatters/text-formatter.js';

export interface UsageCommandOptions extends SharedUsageCommandOptions {
  json?: boolean;
  pretty?: boolean;
}

export interface CliDependencies {
  writeStdout?: (text: string) => void;
  writeStderr?: (text: string) => void;
  runUsageCommandFn?: typeof runUsageCommand;
  runAuthCommandFn?: typeof runAuthCommand;
  runDoctorCommandFn?: typeof runDoctorCommand;
  runMenuCommandFn?: typeof runMenuCommand;
  runConfigValidateCommandFn?: typeof runConfigValidateCommand;
  runConfigDumpCommandFn?: typeof runConfigDumpCommand;
  runProvidersCommandFn?: typeof runProvidersCommand;
  runServiceRunCommandFn?: typeof runServiceRunCommand;
  runServiceStatusCommandFn?: typeof runServiceStatusCommand;
  runServiceSnapshotCommandFn?: typeof runServiceSnapshotCommand;
  runServiceRefreshCommandFn?: typeof runServiceRefreshCommand;
  runLifecycleCommandFn?: typeof runLifecycleCommand;
  isInteractiveTerminalFn?: () => boolean;
}

export interface BunRuntimeBootstrapDependencies {
  bunBinary?: string;
  bunGlobal?: unknown;
  cliPath?: string;
  spawnSyncFn?: (
    command: string,
    args: string[],
    options: { env: NodeJS.ProcessEnv; stdio: 'inherit' },
  ) => { error?: NodeJS.ErrnoException; status: number | null };
  exitFn?: (code?: number) => never;
}

const HELP_WIDTH = 88;
const COMMAND_COLUMN = 36;
const DESCRIPTION_COLUMN = HELP_WIDTH - COMMAND_COLUMN - 5;
const TOP_LEVEL_COMMANDS = [
  'menu',
  'usage',
  'auth',
  'config',
  'doctor',
  'providers',
  'service',
  ...LIFECYCLE_COMMANDS,
  'help',
] as const;

function normalizeProviders(provider: UsageCommandOptions['provider']): ProviderId[] | undefined {
  if (!provider) {
    return undefined;
  }
  return Array.isArray(provider) ? provider : [provider];
}

export async function runUsageCommand(
  options: UsageCommandOptions = {},
  dependencies: UsageCommandDependencies = {},
): Promise<string> {
  const snapshot = await createUsageSnapshot(
    {
      provider: normalizeProviders(options.provider),
      refresh: Boolean(options.refresh),
      diagnostics: Boolean(options.diagnostics),
    },
    dependencies,
  );
  const parsedSnapshot = assertSnapshotEnvelope(snapshot);

  if (options.json) {
    return JSON.stringify(parsedSnapshot, null, options.pretty ? 2 : 0);
  }

  return formatSnapshotAsText(parsedSnapshot, {
    includeDiagnostics: Boolean(options.diagnostics),
  });
}

function border(left: string, fill: string, right: string): string {
  return `${left}${fill.repeat(HELP_WIDTH - 2)}${right}`;
}

function helpLine(command: string, description: string): string {
  return `│ ${command.padEnd(COMMAND_COLUMN)} ${description.padEnd(DESCRIPTION_COLUMN)} │`;
}

export function showHelp(): string {
  return [
    border('┌', '─', '┐'),
    helpLine('agent-bar', 'Ubuntu provider usage CLI'),
    helpLine('', ''),
    helpLine('Commands', ''),
    helpLine('menu', 'Open the interactive terminal menu'),
    helpLine('usage', 'Fetch provider usage snapshots'),
    helpLine('auth <provider>', `Authenticate: ${AUTH_PROVIDER_COMMANDS.join(', ')}`),
    helpLine('config <validate|dump>', 'Inspect backend configuration'),
    helpLine('doctor', 'Inspect runtime prerequisites'),
    helpLine('providers', 'Choose which providers appear in GNOME'),
    helpLine('service <run|status|snapshot|refresh>', 'Interact with the background service'),
    helpLine('setup | update | remove | uninstall', 'Lifecycle commands'),
    helpLine('help, --help, -h', 'Show this help'),
    helpLine('', ''),
    helpLine('Usage flags', ''),
    helpLine('--provider <id>', 'Filter usage to one provider'),
    helpLine('--json', 'Emit machine-readable JSON'),
    helpLine('--pretty', 'Pretty-print JSON output'),
    helpLine('--refresh', 'Bypass cached usage data'),
    helpLine('--diagnostics', 'Include provider diagnostics'),
    border('└', '─', '┘'),
  ].join('\n');
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }
  for (let col = 0; col < cols; col += 1) {
    matrix[0][col] = col;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      matrix[row][col] =
        a[row - 1] === b[col - 1]
          ? matrix[row - 1][col - 1]
          : 1 + Math.min(matrix[row - 1][col], matrix[row][col - 1], matrix[row - 1][col - 1]);
    }
  }

  return matrix[a.length][b.length];
}

export function suggestCommand(input: string): string | null {
  let bestMatch: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const command of TOP_LEVEL_COMMANDS) {
    const distance = levenshtein(input, command);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = command;
    }
  }

  return bestDistance <= 3 ? bestMatch : null;
}

function requireNextArg(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (value === undefined) {
    throw new Error(`Error: ${flag} requires a value`);
  }
  return value;
}

function parseUsageOptions(args: string[]): UsageCommandOptions {
  const options: UsageCommandOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--provider':
      case '-p':
        options.provider = assertProviderId(requireNextArg(args, index, arg));
        index += 1;
        break;
      case '--json':
        options.json = true;
        break;
      case '--pretty':
        options.pretty = true;
        break;
      case '--refresh':
      case '-r':
        options.refresh = true;
        break;
      case '--diagnostics':
      case '-d':
        options.diagnostics = true;
        break;
      case '--help':
      case '-h':
        throw new Error(showHelp());
      default:
        throw new Error(`Unknown option for usage: ${arg}`);
    }
  }

  return options;
}

function parseJsonPrettyOptions(args: string[], label: string): DoctorCommandOptions & ServiceCommandOptions {
  const options: DoctorCommandOptions & ServiceCommandOptions = {};

  for (const arg of args) {
    switch (arg) {
      case '--json':
        options.json = true;
        break;
      case '--pretty':
        options.pretty = true;
        break;
      default:
        throw new Error(`Unknown option for ${label}: ${arg}`);
    }
  }

  return options;
}

function parseConfigOptions(args: string[]): { path?: string } {
  const options: { path?: string } = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--path':
        options.path = requireNextArg(args, index, arg);
        index += 1;
        break;
      default:
        throw new Error(`Unknown option for config: ${arg}`);
    }
  }

  return options;
}

function parseProvidersOptions(args: string[]): ProvidersCommandOptions {
  const options: ProvidersCommandOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--path':
        options.path = requireNextArg(args, index, arg);
        index += 1;
        break;
      default:
        throw new Error(`Unknown option for providers: ${arg}`);
    }
  }

  return options;
}

function parseAuthCopilotOptions(args: string[]): AuthCommandOptions {
  const options: AuthCommandOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--client-id':
        options.clientId = requireNextArg(args, index, arg);
        index += 1;
        break;
      case '--token':
        options.token = requireNextArg(args, index, arg);
        index += 1;
        break;
      default:
        throw new Error(`Unknown option for auth copilot: ${arg}`);
    }
  }

  return options;
}

function rejectUnexpectedArgs(args: string[], label: string): void {
  if (args.length > 0) {
    throw new Error(`Unknown option for ${label}: ${args[0]}`);
  }
}

function isAuthProviderCommand(value: string): value is AuthProviderCommand {
  return AUTH_PROVIDER_COMMANDS.includes(value as AuthProviderCommand);
}

function isLifecycleCommand(value: string): value is LifecycleCommand {
  return LIFECYCLE_COMMANDS.includes(value as LifecycleCommand);
}

function writeLine(writer: (text: string) => void, text: string): void {
  writer(text.endsWith('\n') ? text : `${text}\n`);
}

function toExitCode(value: typeof process.exitCode): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 1;
  }
  return 0;
}

function handleCliError(
  error: unknown,
  writer: (text: string) => void,
  context: 'config' | 'general' = 'general',
): number {
  const message =
    context === 'config' ? formatConfigCommandError(error) : error instanceof Error ? error.message : String(error);

  writeLine(writer, message);
  process.exitCode = 1;
  return 1;
}

export function ensureBunRuntime(
  args: string[],
  dependencies: BunRuntimeBootstrapDependencies = {},
): void {
  if ((dependencies.bunGlobal ?? globalThis.Bun) !== undefined) {
    return;
  }

  const bunBinary = dependencies.bunBinary ?? process.env.BUN_BINARY ?? 'bun';
  const cliPath = dependencies.cliPath ?? fileURLToPath(import.meta.url);
  const spawnSyncFn = dependencies.spawnSyncFn ?? spawnSync;
  const exitFn = dependencies.exitFn ?? process.exit;

  const result = spawnSyncFn(bunBinary, [cliPath, ...args], {
    env: process.env,
    stdio: 'inherit',
  });

  const runtimeError = result.error;
  if (runtimeError) {
    const errorCode = 'code' in runtimeError ? runtimeError.code : undefined;
    if (errorCode === 'ENOENT') {
      throw new Error(`This command requires Bun, but '${bunBinary}' was not found in PATH.`);
    }
    throw new Error(`Failed to launch Bun runtime: ${runtimeError.message}`);
  }

  exitFn(result.status ?? 1);
}

export async function runCli(args: string[], dependencies: CliDependencies = {}): Promise<number> {
  const writeStdout =
    dependencies.writeStdout ??
    ((text: string) => {
      process.stdout.write(text);
    });
  const writeStderr =
    dependencies.writeStderr ??
    ((text: string) => {
      process.stderr.write(text);
    });
  const isInteractiveTerminal =
    dependencies.isInteractiveTerminalFn ?? (() => Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY));

  const command = args[0];
  if (!command) {
    if (isInteractiveTerminal()) {
      await (dependencies.runMenuCommandFn ?? runMenuCommand)();
      return toExitCode(process.exitCode);
    }

    writeLine(writeStdout, showHelp());
    return 0;
  }

  if (command === 'help' || command === '--help' || command === '-h') {
    writeLine(writeStdout, showHelp());
    return 0;
  }

  try {
    switch (command) {
      case 'menu': {
        rejectUnexpectedArgs(args.slice(1), 'menu');
        if (!isInteractiveTerminal()) {
          throw new Error('menu requires an interactive terminal');
        }

        await (dependencies.runMenuCommandFn ?? runMenuCommand)();
        return toExitCode(process.exitCode);
      }
      case 'usage': {
        const output = await (dependencies.runUsageCommandFn ?? runUsageCommand)(parseUsageOptions(args.slice(1)));
        writeLine(writeStdout, output);
        return 0;
      }
      case 'doctor': {
        const output = await (dependencies.runDoctorCommandFn ?? runDoctorCommand)(
          parseJsonPrettyOptions(args.slice(1), 'doctor'),
        );
        writeLine(writeStdout, output);
        return 0;
      }
      case 'providers': {
        const output = await (dependencies.runProvidersCommandFn ?? runProvidersCommand)(
          parseProvidersOptions(args.slice(1)),
        );
        writeLine(writeStdout, output);
        return 0;
      }
      case 'config': {
        const subcommand = args[1];
        if (!subcommand) {
          throw new Error('config requires a subcommand: validate or dump');
        }

        const configOptions = parseConfigOptions(args.slice(2));
        const output =
          subcommand === 'validate'
            ? await (dependencies.runConfigValidateCommandFn ?? runConfigValidateCommand)(configOptions)
            : subcommand === 'dump'
              ? await (dependencies.runConfigDumpCommandFn ?? runConfigDumpCommand)(configOptions)
              : (() => {
                  throw new Error(`Unknown config subcommand: ${subcommand}`);
                })();

        writeLine(writeStdout, output);
        return 0;
      }
      case 'auth': {
        const subcommand = args[1];
        if (!subcommand || !isAuthProviderCommand(subcommand)) {
          throw new Error(`auth requires one of: ${AUTH_PROVIDER_COMMANDS.join(', ')}`);
        }

        const authOptions = subcommand === 'copilot' ? parseAuthCopilotOptions(args.slice(2)) : {};
        await (dependencies.runAuthCommandFn ?? runAuthCommand)(subcommand, authOptions);
        return toExitCode(process.exitCode);
      }
      case 'service': {
        const subcommand = args[1];
        if (!subcommand) {
          throw new Error('service requires a subcommand: run, status, snapshot, or refresh');
        }

        if (subcommand === 'run') {
          await (dependencies.runServiceRunCommandFn ?? runServiceRunCommand)();
          return toExitCode(process.exitCode);
        }

        const serviceOptions = parseJsonPrettyOptions(args.slice(2), `service ${subcommand}`);
        const output =
          subcommand === 'status'
            ? await (dependencies.runServiceStatusCommandFn ?? runServiceStatusCommand)(serviceOptions)
            : subcommand === 'snapshot'
              ? await (dependencies.runServiceSnapshotCommandFn ?? runServiceSnapshotCommand)(serviceOptions)
              : subcommand === 'refresh'
                ? await (dependencies.runServiceRefreshCommandFn ?? runServiceRefreshCommand)(serviceOptions)
                : (() => {
                    throw new Error(`Unknown service subcommand: ${subcommand}`);
                  })();

        writeLine(writeStdout, output);
        return 0;
      }
      default: {
        if (isLifecycleCommand(command)) {
          await (dependencies.runLifecycleCommandFn ?? runLifecycleCommand)(command);
          return toExitCode(process.exitCode);
        }

        if (command.startsWith('-')) {
          throw new Error(`Unknown option: ${command}`);
        }

        const suggestion = suggestCommand(command);
        throw new Error(
          suggestion ? `Unknown command: ${command}. Did you mean '${suggestion}'?` : `Unknown command: ${command}`,
        );
      }
    }
  } catch (error) {
    const context = command === 'config' ? 'config' : 'general';
    return handleCliError(error, writeStderr, context);
  }
}

if (import.meta.main) {
  ensureBunRuntime(process.argv.slice(2));
  await runCli(process.argv.slice(2));
}

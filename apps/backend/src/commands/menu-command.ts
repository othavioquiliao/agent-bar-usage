import * as p from '@clack/prompts';

import { createUsageSnapshot } from '../core/usage-snapshot.js';
import { formatSnapshotAsTerminal } from '../formatters/terminal-snapshot-formatter.js';
import { runDoctorCommand } from './diagnostics-command.js';
import { runProviderLoginMenu } from './login-command.js';
import { runProvidersCommand } from './providers-command.js';

export const MENU_ACTIONS = ['list', 'providers', 'login', 'doctor'] as const;
export type MenuAction = (typeof MENU_ACTIONS)[number];

interface MenuOption {
  value: MenuAction;
  label: string;
  hint: string;
}

interface MenuPromptOptions {
  message: string;
  options: MenuOption[];
}

export interface MenuCommandDependencies {
  selectAction?: (options: MenuPromptOptions) => Promise<MenuAction | symbol>;
  isCancel?: (value: unknown) => boolean;
  intro?: (message: string) => void;
  note?: (message: string, title?: string) => void;
  outro?: (message: string) => void;
  clearScreen?: () => void;
  writeStdout?: (text: string) => void;
  showListAll?: () => Promise<string>;
  runProvidersCommandFn?: typeof runProvidersCommand;
  runProviderLoginMenuFn?: typeof runProviderLoginMenu;
  runDoctorCommandFn?: typeof runDoctorCommand;
}

function defaultSelectAction(options: MenuPromptOptions): Promise<MenuAction | symbol> {
  return p.select(options) as Promise<MenuAction | symbol>;
}

async function defaultShowListAll(): Promise<string> {
  const snapshot = await createUsageSnapshot();
  return formatSnapshotAsTerminal(snapshot);
}

function writeBlock(writer: (text: string) => void, text: string): void {
  if (text.trim().length === 0) {
    return;
  }

  writer(`\n${text}\n\n`);
}

export function buildMenuOptions(): MenuOption[] {
  return [
    {
      value: 'list',
      label: 'List All',
      hint: 'view quotas with progress bars',
    },
    {
      value: 'providers',
      label: 'Configure Providers',
      hint: 'choose which providers appear in GNOME',
    },
    {
      value: 'login',
      label: 'Provider Login',
      hint: 'launch auth flows for Claude, Codex, or Copilot',
    },
    {
      value: 'doctor',
      label: 'Doctor',
      hint: 'run prerequisite checks and suggestions',
    },
  ];
}

export async function runMenuCommand(dependencies: MenuCommandDependencies = {}): Promise<void> {
  const selectAction = dependencies.selectAction ?? defaultSelectAction;
  const isCancel = dependencies.isCancel ?? p.isCancel;
  const intro = dependencies.intro ?? p.intro;
  const note = dependencies.note ?? p.note;
  const outro = dependencies.outro ?? p.outro;
  const clearScreen = dependencies.clearScreen ?? (() => console.clear());
  const writeStdout =
    dependencies.writeStdout ??
    ((text: string) => {
      process.stdout.write(text);
    });
  const showListAll = dependencies.showListAll ?? defaultShowListAll;
  const runProviders = dependencies.runProvidersCommandFn ?? runProvidersCommand;
  const runLoginMenu = dependencies.runProviderLoginMenuFn ?? runProviderLoginMenu;
  const runDoctor = dependencies.runDoctorCommandFn ?? runDoctorCommand;

  clearScreen();
  intro('Agent Bar');
  note('Use arrow keys to move, Enter to select, and Ctrl+C to exit.', 'Controls');

  while (true) {
    const action = await selectAction({
      message: 'Choose an action',
      options: buildMenuOptions(),
    });

    if (isCancel(action)) {
      break;
    }

    switch (action) {
      case 'list':
        writeBlock(writeStdout, await showListAll());
        break;
      case 'providers':
        writeBlock(writeStdout, await runProviders());
        break;
      case 'login':
        await runLoginMenu();
        break;
      case 'doctor':
        writeBlock(writeStdout, await runDoctor());
        break;
      default:
        throw new Error(`Unknown menu action: ${String(action)}`);
    }
  }

  outro('Exited Agent Bar menu');
}

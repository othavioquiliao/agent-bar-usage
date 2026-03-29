import { runRemove } from '../lifecycle/remove.js';
import { runSetup } from '../lifecycle/setup.js';
import { runUninstall } from '../lifecycle/uninstall.js';
import { runUpdate } from '../lifecycle/update.js';

export const LIFECYCLE_COMMANDS = ['setup', 'update', 'remove', 'uninstall'] as const;
export type LifecycleCommand = (typeof LIFECYCLE_COMMANDS)[number];

export async function runLifecycleCommand(command: LifecycleCommand): Promise<void> {
  switch (command) {
    case 'setup':
      await runSetup();
      return;
    case 'update':
      await runUpdate();
      return;
    case 'remove':
      await runRemove();
      return;
    case 'uninstall':
      await runUninstall();
      return;
  }
}

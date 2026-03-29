/**
 * `agent-bar uninstall` -- Full cleanup of all installed files, secrets, and settings.
 *
 * Flow:
 *  1. Show what will be removed
 *  2. Require explicit confirmation (initialValue: false)
 *  3. Stop + disable systemd service
 *  4. Remove installed files (symlink, service, override, tmpfiles, extension)
 *  5. Optionally remove settings + cache
 *  6. Optionally clear GNOME Keyring secrets
 *  7. Report results
 *
 * `agent-bar remove` calls this with force: true, preserveSecrets: true, preserveSettings: true.
 */

import { existsSync as fsExistsSync, rmSync as fsRmSync } from 'node:fs';
import * as p from '@clack/prompts';

import { runSubprocess } from '../utils/subprocess.js';
import { APP_NAME, getInstallPaths } from './paths.js';

// MARK: - Types

export interface UninstallOptions {
  force?: boolean;
  title?: string;
  preserveSecrets?: boolean;
  preserveSettings?: boolean;
}

export interface UninstallDependencies {
  runSubprocessFn?: typeof runSubprocess;
  existsSyncFn?: typeof fsExistsSync;
  rmSyncFn?: typeof fsRmSync;
}

// MARK: - Known secrets

/**
 * GNOME Keyring secrets managed by Agent Bar.
 * CRITICAL: Always specify BOTH service AND account when calling secret-tool clear
 * to avoid accidentally deleting unrelated secrets.
 */
const KNOWN_SECRETS = [
  { service: 'agent-bar', account: 'copilot' },
  // Future providers added here
];

// MARK: - Helpers

function removePathIfExists(
  filePath: string,
  removed: string[],
  failed: string[],
  rm: typeof fsRmSync,
  exists: typeof fsExistsSync,
): void {
  if (!exists(filePath)) {
    return;
  }

  try {
    rm(filePath, { recursive: true, force: true });
    removed.push(filePath);
  } catch {
    failed.push(filePath);
  }
}

// MARK: - Uninstall flow

export async function runUninstall(options?: UninstallOptions, deps?: UninstallDependencies): Promise<void> {
  const force = options?.force ?? false;
  const title = options?.title ?? `${APP_NAME} uninstall`;
  const preserveSecrets = options?.preserveSecrets ?? false;
  const preserveSettings = options?.preserveSettings ?? false;

  const run = deps?.runSubprocessFn ?? runSubprocess;
  const existsSync = deps?.existsSyncFn ?? fsExistsSync;
  const rmSync = deps?.rmSyncFn ?? fsRmSync;

  console.clear();
  p.intro(title);

  const paths = getInstallPaths();

  // Build list of what gets removed
  const removalList: string[] = [
    paths.cliSymlink,
    paths.serviceFile,
    paths.overrideDir,
    paths.envOverride,
    paths.tmpfilesConf,
    paths.extensionDir,
  ];

  if (!preserveSettings) {
    removalList.push(paths.settingsDir);
    removalList.push(paths.cacheDir);
  }

  if (!preserveSecrets) {
    removalList.push(...KNOWN_SECRETS.map((s) => `GNOME Keyring: service=${s.service} account=${s.account}`));
  }

  p.note(removalList.join('\n'), 'What gets removed');

  // Confirmation (locked decision: initialValue: false for uninstall)
  if (!force) {
    const proceed = await p.confirm({
      message: 'Continue with uninstall?',
      initialValue: false,
    });

    if (p.isCancel(proceed) || !proceed) {
      p.outro('Uninstall cancelled');
      return;
    }
  }

  const s = p.spinner();
  const removed: string[] = [];
  const failed: string[] = [];

  // Step 1: Stop systemd service first
  s.start('Stopping systemd service...');
  try {
    await run('systemctl', ['--user', 'stop', 'agent-bar.service']);
  } catch {
    // Service may not be running
  }
  try {
    await run('systemctl', ['--user', 'disable', 'agent-bar.service']);
  } catch {
    // Service may not be enabled
  }
  s.stop('Systemd service stopped');

  // Step 2: Remove installed files
  s.start('Removing installed files...');
  removePathIfExists(paths.cliSymlink, removed, failed, rmSync, existsSync);
  removePathIfExists(paths.serviceFile, removed, failed, rmSync, existsSync);
  removePathIfExists(paths.overrideDir, removed, failed, rmSync, existsSync);
  removePathIfExists(paths.tmpfilesConf, removed, failed, rmSync, existsSync);
  removePathIfExists(paths.extensionDir, removed, failed, rmSync, existsSync);

  if (!preserveSettings) {
    removePathIfExists(paths.settingsDir, removed, failed, rmSync, existsSync);
    removePathIfExists(paths.cacheDir, removed, failed, rmSync, existsSync);
  }
  s.stop('Files cleaned up');

  // Step 3: Clear GNOME Keyring secrets (ONLY if !preserveSecrets -- LOCKED DECISION)
  if (!preserveSecrets) {
    s.start('Clearing GNOME Keyring secrets...');
    for (const secret of KNOWN_SECRETS) {
      try {
        // CRITICAL: Always specify BOTH service AND account to avoid deleting unrelated secrets
        await run('secret-tool', ['clear', 'service', secret.service, 'account', secret.account]);
      } catch {
        // Secret may not exist -- safe to ignore
      }
    }
    s.stop('Secrets cleared');
  }

  // Step 4: Report results
  if (removed.length > 0) {
    p.log.success(`Removed ${removed.length} paths`);
  }

  if (failed.length > 0) {
    p.log.warn(`Failed to remove ${failed.length} paths`);
  }

  if (preserveSecrets) {
    p.log.info('GNOME Keyring secrets preserved');
  }

  if (preserveSettings) {
    p.log.info('Settings and cache preserved');
  }

  p.outro(`${title} complete`);
}

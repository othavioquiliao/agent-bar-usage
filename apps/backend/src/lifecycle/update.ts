/**
 * `agent-bar update` -- Interactive update command.
 *
 * Flow:
 *  1. Verify git repo
 *  2. Show current branch + commit
 *  3. Check for dirty working directory (fail if uncommitted changes)
 *  4. Fetch from origin
 *  5. Show incoming commits
 *  6. Confirm + pull --ff-only
 *  7. bun install
 *  8. Restart systemd service
 *  9. Re-copy GNOME extension
 */

import { cpSync as fsCpSync, mkdirSync as fsMkdirSync } from 'node:fs';
import { join } from 'node:path';
import * as p from '@clack/prompts';

import { runSubprocess, SubprocessError } from '../utils/subprocess.js';
import { EXT_ITEMS, getInstallPaths, REPO_ROOT } from './paths.js';

// MARK: - Dependency injection

export interface UpdateDependencies {
  runSubprocessFn?: typeof runSubprocess;
  cpSyncFn?: typeof fsCpSync;
  mkdirSyncFn?: typeof fsMkdirSync;
}

// MARK: - Git helper

async function runGit(args: string[], run: typeof runSubprocess): Promise<{ ok: boolean; output: string }> {
  try {
    const result = await run('git', args, {
      cwd: REPO_ROOT,
      timeoutMs: 30_000,
    });
    return { ok: true, output: result.stdout.trim() };
  } catch (error) {
    if (error instanceof SubprocessError) {
      const stderr = error.result.stderr?.trim() ?? '';
      return { ok: false, output: stderr || error.message };
    }
    return { ok: false, output: String(error) };
  }
}

// MARK: - Update flow

export async function runUpdate(deps?: UpdateDependencies): Promise<void> {
  const run = deps?.runSubprocessFn ?? runSubprocess;
  const cpSync = deps?.cpSyncFn ?? fsCpSync;
  const mkdirSync = deps?.mkdirSyncFn ?? fsMkdirSync;

  console.clear();
  p.intro('agent-bar update');

  // Step 1: Verify git repo
  const gitCheck = await runGit(['rev-parse', '--git-dir'], run);
  if (!gitCheck.ok) {
    p.log.error('Not a git repository. Cannot update.');
    p.outro('Update failed');
    return;
  }

  // Step 2: Show current info
  const currentBranch = await runGit(['branch', '--show-current'], run);
  const currentCommit = await runGit(['rev-parse', '--short', 'HEAD'], run);
  p.log.info(`Branch: ${currentBranch.output}`);
  p.log.info(`Current: ${currentCommit.output}`);

  // Step 3: Check dirty state (LOCKED DECISION -- fail if local changes)
  const dirtyCheck = await runGit(['status', '--porcelain'], run);
  if (dirtyCheck.ok && dirtyCheck.output.length > 0) {
    p.log.error('Working directory has uncommitted changes.');
    p.log.warn('Commit or stash your changes first.');
    p.outro('Update cancelled');
    return;
  }

  // Step 4: Fetch
  const s = p.spinner();
  s.start('Fetching latest changes...');

  const fetchResult = await runGit(['fetch', 'origin'], run);
  if (!fetchResult.ok) {
    s.stop('Failed to fetch');
    p.log.error(fetchResult.output);
    p.outro('Update failed');
    return;
  }

  // Step 5: Check how far behind
  const behindResult = await runGit(['rev-list', 'HEAD..origin/master', '--count'], run);
  const behindCount = parseInt(behindResult.output, 10) || 0;

  if (behindCount === 0) {
    s.stop('Already up to date!');
    p.outro('No updates available');
    return;
  }

  s.stop(`${behindCount} update(s) available`);

  // Step 6: Show incoming commits (LOCKED DECISION)
  const logResult = await runGit(['log', '--oneline', 'HEAD..origin/master', '-15'], run);
  if (logResult.ok && logResult.output.length > 0) {
    p.note(logResult.output, 'Incoming commits');
  }

  // Step 7: Confirm
  const proceed = await p.confirm({
    message: 'Apply update?',
    initialValue: true,
  });

  if (p.isCancel(proceed) || !proceed) {
    p.outro('Update cancelled');
    return;
  }

  // Step 8: Pull (LOCKED DECISION -- ff-only)
  s.start('Pulling changes...');
  const pullResult = await runGit(['pull', '--ff-only'], run);
  if (!pullResult.ok) {
    s.stop('Pull failed');
    p.log.error(pullResult.output);
    p.log.warn('If you have local commits, try: git rebase origin/master');
    p.outro('Update failed');
    return;
  }
  s.stop('Code updated');

  // Step 9: Install dependencies
  s.start('Installing dependencies...');
  try {
    await run('bun', ['install'], {
      cwd: REPO_ROOT,
      timeoutMs: 60_000,
    });
    s.stop('Dependencies updated');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    s.stop('Dependency install failed');
    p.log.warn(`bun install failed: ${message}`);
  }

  // Step 10: Restart service
  s.start('Restarting service...');
  try {
    await run('systemctl', ['--user', 'daemon-reload']);
    await run('systemctl', ['--user', 'restart', 'agent-bar.service']);
    s.stop('Service restarted');
  } catch {
    s.stop('Service restart skipped');
    p.log.warn('systemctl commands failed -- restart the service manually if needed');
  }

  // Step 11: Re-copy GNOME extension
  s.start('Updating GNOME extension...');
  const paths = getInstallPaths();
  mkdirSync(paths.extensionDir, { recursive: true });
  for (const item of EXT_ITEMS) {
    try {
      cpSync(join(REPO_ROOT, 'apps', 'gnome-extension', item), join(paths.extensionDir, item), { recursive: true });
    } catch {
      // Skip items that don't exist in the source
    }
  }
  s.stop('GNOME extension updated');

  // Step 12: Show result
  const newCommit = await runGit(['rev-parse', '--short', 'HEAD'], run);
  p.log.success(`Updated: ${currentCommit.output} -> ${newCommit.output}`);

  p.outro('Update complete!');
}

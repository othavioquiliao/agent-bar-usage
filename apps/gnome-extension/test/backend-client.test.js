import { describe, expect, it, vi } from 'vitest';

import { createBackendClient } from '../services/backend-client.js';
import { resolveBackendInvocation, resolveRepoRoot } from '../utils/backend-command.js';

describe('resolveRepoRoot', () => {
  it('resolves repo root from a file:// URI without using URL global', () => {
    // file is at repo/apps/gnome-extension/utils/backend-command.js
    // walk up 3 dirs from the file: remove filename → utils/ → gnome-extension/ → apps/ = repo root
    const root = resolveRepoRoot('file:///home/user/projects/agent-bar/apps/gnome-extension/utils/backend-command.js');
    expect(root).toBe('/home/user/projects/agent-bar');
  });

  it('handles percent-encoded paths', () => {
    const root = resolveRepoRoot(
      'file:///home/user/my%20projects/agent-bar/apps/gnome-extension/utils/backend-command.js',
    );
    expect(root).toBe('/home/user/my projects/agent-bar');
  });
});

describe('backend command resolution', () => {
  it('prefers agent-bar from PATH and appends force refresh when requested', () => {
    const invocation = resolveBackendInvocation(
      { forceRefresh: true },
      {
        findProgramInPath: (programName) => (programName === 'agent-bar' ? '/usr/bin/agent-bar' : null),
        repoRoot: '/repo',
      },
    );

    expect(invocation).toMatchObject({
      argv: ['/usr/bin/agent-bar', 'service', 'refresh', '--json'],
      cwd: '/repo',
      mode: 'installed',
    });
  });

  it('falls back to the workspace-local tsx invocation when agent-bar is unavailable', () => {
    const invocation = resolveBackendInvocation(
      {},
      {
        findProgramInPath: () => null,
        repoRoot: '/repo',
        backendPackageRoot: '/repo/apps/backend',
        nodeBinary: 'node',
      },
    );

    expect(invocation).toMatchObject({
      argv: ['node', '--import', 'tsx', '/repo/apps/backend/src/cli.ts', 'usage', '--json', '--diagnostics'],
      cwd: '/repo/apps/backend',
      mode: 'workspace-dev',
    });
  });
});

describe('backend client', () => {
  it('parses backend JSON into a snapshot envelope', async () => {
    const snapshot = {
      schema_version: '1',
      generated_at: '2026-03-25T17:00:00.000Z',
      providers: [],
    };
    const runCommand = vi.fn(async () => ({
      success: true,
      stdout: JSON.stringify(snapshot),
      stderr: '',
      exitCode: 0,
    }));
    const client = createBackendClient({
      runCommand,
      findProgramInPath: () => '/usr/bin/agent-bar',
      repoRoot: '/repo',
    });

    await expect(client.fetchUsageSnapshot()).resolves.toEqual(snapshot);
  });

  it('surfaces backend command failures with stderr context', async () => {
    const client = createBackendClient({
      runCommand: vi.fn(async () => ({
        success: false,
        stdout: '',
        stderr: 'provider unavailable',
        exitCode: 1,
      })),
      findProgramInPath: () => '/usr/bin/agent-bar',
      repoRoot: '/repo',
    });

    await expect(client.fetchUsageSnapshot()).rejects.toMatchObject({
      name: 'BackendClientError',
      exitCode: 1,
      stderr: 'provider unavailable',
    });
  });

  it('logs structured error when subprocess fails', async () => {
    const errors = [];
    const originalError = console.error;
    console.error = (...args) => errors.push(args.join(' '));

    const client = createBackendClient({
      runCommand: vi.fn(async () => ({
        success: false,
        stdout: '',
        stderr: 'ENOENT',
        exitCode: 127,
      })),
      findProgramInPath: () => '/usr/bin/agent-bar',
      repoRoot: '/repo',
    });

    await expect(client.fetchUsageSnapshot()).rejects.toThrow();
    expect(errors.some((e) => e.includes('[agent-bar]') && e.includes('ENOENT'))).toBe(true);

    console.error = originalError;
  });

  it('logs structured error when subprocess spawn throws', async () => {
    const errors = [];
    const originalError = console.error;
    console.error = (...args) => errors.push(args.join(' '));

    const client = createBackendClient({
      runCommand: vi.fn(async () => {
        throw new Error('spawn failed: No such file or directory');
      }),
      findProgramInPath: () => '/usr/bin/agent-bar',
      repoRoot: '/repo',
    });

    await expect(client.fetchUsageSnapshot()).rejects.toThrow();
    expect(errors.some((e) => e.includes('[agent-bar]') && e.includes('spawn failed'))).toBe(true);

    console.error = originalError;
  });

  it('throws when backend stdout is not valid JSON', async () => {
    const client = createBackendClient({
      runCommand: vi.fn(async () => ({
        success: true,
        stdout: '{not-json}',
        stderr: '',
        exitCode: 0,
      })),
      findProgramInPath: () => '/usr/bin/agent-bar',
      repoRoot: '/repo',
    });

    await expect(client.fetchUsageSnapshot()).rejects.toThrow('Invalid JSON from backend stdout');
  });
});

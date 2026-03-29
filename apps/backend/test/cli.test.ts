import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runCli, showHelp, suggestCommand } from '../src/cli.js';

describe('manual CLI parser', () => {
  let originalExitCode: typeof process.exitCode;

  beforeEach(() => {
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
  });

  it('renders boxed help output', () => {
    const help = showHelp();

    expect(help).toContain('┌');
    expect(help).toContain('┘');
    expect(help).toContain('menu');
    expect(help).toContain('usage');
    expect(help).toContain('service <run|status|snapshot|refresh>');
  });

  it('suggests the closest top-level command', () => {
    expect(suggestCommand('stup')).toBe('setup');
    expect(suggestCommand('doctor')).toBe('doctor');
    expect(suggestCommand('totally-unknown')).toBeNull();
  });

  it('routes auth copilot options to the auth runner', async () => {
    const calls: Array<{ command: string; options: unknown }> = [];

    const exitCode = await runCli(['auth', 'copilot', '--token', 'ghp_test'], {
      runAuthCommandFn: async (command, options) => {
        calls.push({ command, options });
      },
    });

    expect(exitCode).toBe(0);
    expect(calls).toEqual([
      {
        command: 'copilot',
        options: {
          token: 'ghp_test',
        },
      },
    ]);
  });

  it('routes config and service subcommands with parsed flags', async () => {
    const stdout = vi.fn();
    const configCalls: unknown[] = [];
    const providersCalls: unknown[] = [];
    const serviceCalls: unknown[] = [];

    await runCli(['config', 'validate', '--path', '/tmp/agent-bar.json'], {
      writeStdout: stdout,
      runConfigValidateCommandFn: async (options) => {
        configCalls.push(options);
        return 'config: valid';
      },
    });

    await runCli(['service', 'status', '--json', '--pretty'], {
      writeStdout: stdout,
      runServiceStatusCommandFn: async (options) => {
        serviceCalls.push(options);
        return '{"ok":true}';
      },
    });

    await runCli(['providers', '--path', '/tmp/providers.json'], {
      writeStdout: stdout,
      runProvidersCommandFn: async (options) => {
        providersCalls.push(options);
        return 'providers updated';
      },
    });

    expect(configCalls).toEqual([{ path: '/tmp/agent-bar.json' }]);
    expect(providersCalls).toEqual([{ path: '/tmp/providers.json' }]);
    expect(serviceCalls).toEqual([{ json: true, pretty: true }]);
    expect(stdout).toHaveBeenCalledWith('config: valid\n');
    expect(stdout).toHaveBeenCalledWith('{"ok":true}\n');
    expect(stdout).toHaveBeenCalledWith('providers updated\n');
  });

  it('prints a typo suggestion for unknown commands', async () => {
    let stderr = '';

    const exitCode = await runCli(['stup'], {
      writeStderr: (text) => {
        stderr += text;
      },
    });

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Did you mean 'setup'?");
  });

  it('opens the interactive menu when run without args in a TTY context', async () => {
    const runMenuCommandFn = vi.fn(async () => {});

    const exitCode = await runCli([], {
      runMenuCommandFn,
      isInteractiveTerminalFn: () => true,
    });

    expect(exitCode).toBe(0);
    expect(runMenuCommandFn).toHaveBeenCalledTimes(1);
  });

  it('falls back to help output without args in a non-interactive context', async () => {
    let stdout = '';

    const exitCode = await runCli([], {
      isInteractiveTerminalFn: () => false,
      writeStdout: (text) => {
        stdout += text;
      },
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain('agent-bar');
    expect(stdout).toContain('menu');
  });
});

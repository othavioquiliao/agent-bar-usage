import { describe, expect, it, vi } from 'vitest';

import { runProviderLoginMenu } from '../src/commands/login-command.js';

describe('provider login menu', () => {
  it('routes copilot token entry to the auth command', async () => {
    const runAuthCopilotCommandFn = vi.fn(async () => {});
    const selections = ['copilot', 'token'] as const;
    let selectIndex = 0;

    await runProviderLoginMenu({
      note: () => {},
      isCancel: () => false,
      selectPrompt: async () => selections[selectIndex++] as never,
      textPrompt: async () => 'ghp_test_token_123',
      runAuthCopilotCommandFn,
    });

    expect(runAuthCopilotCommandFn).toHaveBeenCalledWith({ token: 'ghp_test_token_123' });
  });

  it('launches claude auth login and verifies credentials after success', async () => {
    const runAuthClaudeCommandFn = vi.fn(async () => {});
    const launchExternalCommand = vi.fn(async () => 0);

    await runProviderLoginMenu({
      note: () => {},
      isCancel: () => false,
      selectPrompt: async () => 'claude',
      confirmPrompt: async () => true,
      resolveCommandInPathFn: () => '/usr/bin/claude',
      launchExternalCommand,
      runAuthClaudeCommandFn,
    });

    expect(launchExternalCommand).toHaveBeenCalledWith('claude', ['auth', 'login']);
    expect(runAuthClaudeCommandFn).toHaveBeenCalledTimes(1);
  });

  it('reports a missing codex binary before attempting login', async () => {
    const error = vi.fn();
    const launchExternalCommand = vi.fn(async () => 0);

    await runProviderLoginMenu({
      note: () => {},
      isCancel: () => false,
      selectPrompt: async () => 'codex',
      confirmPrompt: async () => true,
      resolveCommandInPathFn: () => null,
      launchExternalCommand,
      log: {
        error,
        warn: () => {},
      },
    });

    expect(error).toHaveBeenCalledWith('Codex CLI is missing. Run: npm install -g @openai/codex');
    expect(launchExternalCommand).not.toHaveBeenCalled();
  });
});

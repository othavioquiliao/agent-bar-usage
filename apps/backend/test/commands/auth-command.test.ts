import { readFileSync } from 'node:fs';
import path from 'node:path';

import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COPILOT_SETUP_GUIDE,
  runAuthClaudeCommand,
  runAuthCodexCommand,
  runAuthCopilotCommand,
} from '../../src/commands/auth-command.js';

describe('defaultOpenBrowser security (SEC-01)', () => {
  it('does not use exec from node:child_process (shell injection prevention)', () => {
    const authCommandSource = readFileSync(
      path.resolve(__dirname, '../../src/commands/auth-command.ts'),
      'utf8',
    );

    // Must NOT contain exec-based shell interpolation
    expect(authCommandSource).not.toMatch(/import\s*\{[^}]*exec[^}]*\}\s*from\s*['"]node:child_process['"]/);
    expect(authCommandSource).not.toMatch(/exec\(`xdg-open/);

    // Must use Bun.spawn array form for xdg-open
    expect(authCommandSource).toMatch(/Bun\.spawn\(\['xdg-open',\s*url\]/);
  });

  it('injects openBrowser via dependency injection for testability', async () => {
    const openBrowserSpy = vi.fn();
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    vi.useFakeTimers();

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            device_code: 'dc-test',
            user_code: 'TEST-1234',
            verification_uri: 'https://github.com/login/device',
            expires_in: 900,
            interval: 1,
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'gho_test',
            token_type: 'bearer',
            scope: 'copilot',
          }),
        ),
      );

    const runPromise = runAuthCopilotCommand(
      {},
      {
        fetchFn,
        storeSecret: vi.fn().mockResolvedValue(undefined),
        ensureConfigRef: vi.fn().mockResolvedValue(undefined),
        resolveConfigPath: () => '/tmp/test.json',
        restartService: vi.fn().mockResolvedValue(undefined),
        waitForEnter: async () => undefined,
        openBrowser: openBrowserSpy,
      },
    );

    await vi.advanceTimersByTimeAsync(1_000);
    await runPromise;

    expect(openBrowserSpy).toHaveBeenCalledWith('https://github.com/login/device');

    stdoutSpy.mockRestore();
    vi.useRealTimers();
  });
});

describe('runAuthClaudeCommand', () => {
  let stdoutSpy: MockInstance;
  let stderrSpy: MockInstance;
  let originalExitCode: typeof process.exitCode;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = originalExitCode;
    vi.useRealTimers();
  });

  it('reports authenticated when credentials are found', async () => {
    await runAuthClaudeCommand({
      readCredentials: async () => ({ accessToken: 'sk-ant-test', expiresAt: null }),
    });

    expect(stdoutSpy).toHaveBeenCalledWith('Claude: authenticated (token found in ~/.claude/.credentials.json)\n');
    expect(process.exitCode).toBeUndefined();
  });

  it('reports not found and sets exitCode 1 when credentials are missing', async () => {
    await runAuthClaudeCommand({
      readCredentials: async () => null,
    });

    expect(stderrSpy).toHaveBeenCalledWith('Claude credentials not found.\n  -> Run: claude auth login\n');
    expect(process.exitCode).toBe(1);
  });
});

describe('runAuthCodexCommand', () => {
  let stdoutSpy: MockInstance;
  let stderrSpy: MockInstance;
  let originalExitCode: typeof process.exitCode;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('reports authenticated when credentials are found', async () => {
    await runAuthCodexCommand({
      readCredentials: async () => ({ accessToken: 'openai-test-key' }),
    });

    expect(stdoutSpy).toHaveBeenCalledWith('Codex: authenticated (token found in ~/.codex/auth.json)\n');
    expect(process.exitCode).toBeUndefined();
  });

  it('reports not found and sets exitCode 1 when credentials are missing', async () => {
    await runAuthCodexCommand({
      readCredentials: async () => null,
    });

    expect(stderrSpy).toHaveBeenCalledWith('Codex credentials not found.\n  -> Run: codex auth login\n');
    expect(process.exitCode).toBe(1);
  });
});

describe('runAuthCopilotCommand', () => {
  let stdoutSpy: MockInstance;
  let stderrSpy: MockInstance;
  let originalExitCode: typeof process.exitCode;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('stores token directly when --token is provided (skips Device Flow)', async () => {
    const storeSecret = vi.fn().mockResolvedValue(undefined);
    const ensureConfigRef = vi.fn().mockResolvedValue(undefined);
    const restartService = vi.fn().mockResolvedValue(undefined);

    await runAuthCopilotCommand(
      { token: 'ghp_test_token_123' },
      {
        storeSecret,
        ensureConfigRef,
        resolveConfigPath: () => '/tmp/test-config.json',
        restartService,
      },
    );

    expect(storeSecret).toHaveBeenCalledWith('agent-bar', 'copilot', 'ghp_test_token_123', 'Agent Bar Copilot');
    expect(ensureConfigRef).toHaveBeenCalledWith('/tmp/test-config.json', {
      store: 'secret-tool',
      service: 'agent-bar',
      account: 'copilot',
    });
    expect(restartService).toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });

  it('shows setup guide when Device Flow fails', async () => {
    const failingFetch = vi.fn().mockRejectedValue(new Error('HTTP 404 Not Found'));

    await runAuthCopilotCommand(
      {},
      {
        fetchFn: failingFetch as unknown as typeof fetch,
        storeSecret: vi.fn(),
        ensureConfigRef: vi.fn(),
        resolveConfigPath: () => '/tmp/test-config.json',
        restartService: vi.fn(),
      },
    );

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Device Flow falhou'));
    expect(stderrSpy).toHaveBeenCalledWith(COPILOT_SETUP_GUIDE);
    expect(process.exitCode).toBe(1);
  });

  it('shows setup guide when token polling fails after the device code step', async () => {
    vi.useFakeTimers();

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            device_code: 'device-code',
            user_code: 'AB12-CD34',
            verification_uri: 'https://github.com/login/device',
            expires_in: 900,
            interval: 1,
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'token_expired',
          }),
        ),
      );

    const runPromise = runAuthCopilotCommand(
      {},
      {
        fetchFn,
        storeSecret: vi.fn(),
        ensureConfigRef: vi.fn(),
        resolveConfigPath: () => '/tmp/test-config.json',
        restartService: vi.fn(),
        waitForEnter: async () => undefined,
        openBrowser: () => undefined,
      },
    );

    await vi.advanceTimersByTimeAsync(1_000);
    await runPromise;

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Device Flow falhou'));
    expect(stderrSpy).toHaveBeenCalledWith(COPILOT_SETUP_GUIDE);
    expect(process.exitCode).toBe(1);

    vi.useRealTimers();
  });
});

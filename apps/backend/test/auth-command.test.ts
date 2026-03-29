import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureCopilotSecretRef } from '../src/auth/config-writer.js';
import { type DeviceFlowResult, pollForAccessToken, requestDeviceCode } from '../src/auth/github-device-flow.js';
import { storeSecretViaSecretTool } from '../src/auth/secret-tool-writer.js';
import { runAuthCopilotCommand } from '../src/commands/auth-command.js';

describe('GitHub device flow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('requests a GitHub device code with form-encoded headers', async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(input).toBe('https://github.com/login/device/code');
      expect(init?.method).toBe('POST');
      expect(init?.headers).toMatchObject({
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      });
      const body = new URLSearchParams(String(init?.body));
      expect(body.get('client_id')).toBe('client-123');
      expect(body.get('scope')).toBe('copilot');

      return new Response(
        JSON.stringify({
          device_code: 'device-code',
          user_code: 'AB12-CD34',
          verification_uri: 'https://github.com/login/device',
          expires_in: 900,
          interval: 5,
        }),
      );
    });

    const response = await requestDeviceCode('client-123', 'copilot', fetchFn);

    expect(response.user_code).toBe('AB12-CD34');
    expect(response.verification_uri).toBe('https://github.com/login/device');
  });

  it('polls until GitHub returns an access token', async () => {
    vi.useFakeTimers();

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'authorization_pending',
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'token-123',
            token_type: 'bearer',
            scope: 'copilot',
          }),
        ),
      );

    const resultPromise = pollForAccessToken('client-123', 'device-code', 1, 30, fetchFn);

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    const result = await resultPromise;

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(result).toEqual<DeviceFlowResult>({
      access_token: 'token-123',
      token_type: 'bearer',
      scope: 'copilot',
    });
  });

  it('fails clearly when GitHub denies the authorization', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'access_denied',
          error_description: 'user canceled',
        }),
      ),
    );

    await expect(pollForAccessToken('client-123', 'device-code', 1, 30, fetchFn)).rejects.toThrow(
      'Authorization denied.',
    );
  });

  it('treats token_expired as an expiration alias', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'token_expired',
        }),
      ),
    );

    await expect(pollForAccessToken('client-123', 'device-code', 0, 30, fetchFn)).rejects.toThrow(
      'Device flow code expired.',
    );
  });
});

describe('ensureCopilotSecretRef', () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirectories.splice(0).map(async (directoryPath) => {
        await rm(directoryPath, {
          recursive: true,
          force: true,
        });
      }),
    );
  });

  it('creates a config file with a copilot secret-tool reference when missing', async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'agent-bar-auth-'));
    tempDirectories.push(tempDirectory);
    const configPath = path.join(tempDirectory, 'agent-bar', 'config.json');

    await ensureCopilotSecretRef(configPath, {
      store: 'secret-tool',
      service: 'agent-bar',
      account: 'copilot',
    });

    const written = JSON.parse(await readFile(configPath, 'utf8')) as {
      providers: Array<{ id: string; secretRef?: { store: string; service: string; account: string } }>;
    };
    const copilot = written.providers.find((provider) => provider.id === 'copilot');

    expect(copilot?.secretRef).toEqual({
      store: 'secret-tool',
      service: 'agent-bar',
      account: 'copilot',
    });
  });

  it('does not rewrite a config file that already has the expected Copilot secret reference', async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'agent-bar-auth-'));
    tempDirectories.push(tempDirectory);
    const configPath = path.join(tempDirectory, 'config.json');
    const contents = `${JSON.stringify(
      {
        schemaVersion: 1,
        defaults: {
          ttlSeconds: 30,
        },
        providers: [
          {
            id: 'copilot',
            enabled: true,
            sourceMode: 'api',
            secretRef: {
              store: 'secret-tool',
              service: 'agent-bar',
              account: 'copilot',
            },
          },
        ],
      },
      null,
      2,
    )}\n`;

    await writeFile(configPath, contents, 'utf8');
    await ensureCopilotSecretRef(configPath, {
      store: 'secret-tool',
      service: 'agent-bar',
      account: 'copilot',
    });

    expect(await readFile(configPath, 'utf8')).toBe(contents);
  });
});

describe('secret-tool writer', () => {
  it('pipes the token into secret-tool store', async () => {
    const calls: Array<{ command: string; args: string[]; input?: string }> = [];

    await storeSecretViaSecretTool('agent-bar', 'copilot', 'token-123', 'Agent Bar Copilot', {
      runSubprocessFn: async (command, args, options) => {
        calls.push({
          command,
          args,
          input: options?.input,
        });

        return {
          command,
          args,
          exitCode: 0,
          stdout: '',
          stderr: '',
          durationMs: 1,
        };
      },
    });

    expect(calls).toEqual([
      {
        command: 'secret-tool',
        args: ['store', '--label=Agent Bar Copilot', 'service', 'agent-bar', 'account', 'copilot'],
        input: 'token-123',
      },
    ]);
  });
});

describe('runAuthCopilotCommand', () => {
  it('stores a token directly when --token is provided', async () => {
    const storeSecretFn = vi.fn().mockResolvedValue(undefined);
    const ensureConfigRefFn = vi.fn().mockResolvedValue(undefined);
    const restartServiceFn = vi.fn().mockResolvedValue(undefined);

    await runAuthCopilotCommand(
      { token: 'ghp_test_token_123' },
      {
        storeSecret: storeSecretFn,
        ensureConfigRef: ensureConfigRefFn,
        resolveConfigPath: () => '/tmp/agent-bar/config.json',
        restartService: restartServiceFn,
      },
    );

    expect(storeSecretFn).toHaveBeenCalledWith('agent-bar', 'copilot', 'ghp_test_token_123', 'Agent Bar Copilot');
    expect(ensureConfigRefFn).toHaveBeenCalledWith('/tmp/agent-bar/config.json', {
      store: 'secret-tool',
      service: 'agent-bar',
      account: 'copilot',
    });
    expect(restartServiceFn).toHaveBeenCalled();
  });
});

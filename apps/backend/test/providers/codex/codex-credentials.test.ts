import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  readCodexCredentials,
  resolveCodexConnectedAccount,
} from '../../../src/providers/codex/codex-credentials.js';

describe('readCodexCredentials', () => {
  it('returns null when file does not exist', async () => {
    const result = await readCodexCredentials('/nonexistent/path.json');
    expect(result).toBeNull();
  });

  it('reads token from valid auth file (token field)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'codex-creds-'));
    const path = join(dir, 'auth.json');
    await writeFile(path, JSON.stringify({ token: 'openai-key-123' }));

    const result = await readCodexCredentials(path);
    expect(result).toEqual({ accessToken: 'openai-key-123' });

    await rm(dir, { recursive: true });
  });

  it('reads token from valid auth file (access_token field)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'codex-creds-'));
    const path = join(dir, 'auth.json');
    await writeFile(path, JSON.stringify({ access_token: 'openai-key-456' }));

    const result = await readCodexCredentials(path);
    expect(result).toEqual({ accessToken: 'openai-key-456' });

    await rm(dir, { recursive: true });
  });

  it('reads token from valid auth file (api_key field)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'codex-creds-'));
    const path = join(dir, 'auth.json');
    await writeFile(path, JSON.stringify({ api_key: 'openai-key-789' }));

    const result = await readCodexCredentials(path);
    expect(result).toEqual({ accessToken: 'openai-key-789' });

    await rm(dir, { recursive: true });
  });

  it('reads token from ChatGPT auth format (tokens.id_token)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'codex-creds-'));
    const path = join(dir, 'auth.json');
    const payload = Buffer.from(JSON.stringify({ email: 'jane@example.com' }))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    await writeFile(
      path,
      JSON.stringify({
        auth_mode: 'chatgpt',
        tokens: { id_token: `header.${payload}.signature` },
        last_refresh: '2026-03-24T18:31:17Z',
      }),
    );

    const result = await readCodexCredentials(path);
    expect(result).toEqual({ accessToken: `header.${payload}.signature` });

    const account = await resolveCodexConnectedAccount(path);
    expect(account).toEqual({ status: 'connected', label: 'jane@example.com' });

    await rm(dir, { recursive: true });
  });

  it('reads OPENAI_API_KEY from auth file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'codex-creds-'));
    const path = join(dir, 'auth.json');
    await writeFile(path, JSON.stringify({ OPENAI_API_KEY: 'sk-proj-abc123' }));

    const result = await readCodexCredentials(path);
    expect(result).toEqual({ accessToken: 'sk-proj-abc123' });

    await rm(dir, { recursive: true });
  });

  it('returns null when no recognized token field exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'codex-creds-'));
    const path = join(dir, 'auth.json');
    await writeFile(path, JSON.stringify({ someOtherKey: 'value' }));

    const result = await readCodexCredentials(path);
    expect(result).toBeNull();

    await rm(dir, { recursive: true });
  });

  it('returns null when file contains invalid JSON', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'codex-creds-'));
    const path = join(dir, 'auth.json');
    await writeFile(path, 'not valid json {{{');

    const result = await readCodexCredentials(path);
    expect(result).toBeNull();

    await rm(dir, { recursive: true });
  });

  it('returns null when token is empty string', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'codex-creds-'));
    const path = join(dir, 'auth.json');
    await writeFile(path, JSON.stringify({ token: '' }));

    const result = await readCodexCredentials(path);
    expect(result).toBeNull();

    await rm(dir, { recursive: true });
  });

  it('returns connected without label when only an API key is present', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'codex-creds-'));
    const path = join(dir, 'auth.json');
    await writeFile(path, JSON.stringify({ OPENAI_API_KEY: 'sk-proj-abc123' }));

    const result = await resolveCodexConnectedAccount(path);
    expect(result).toEqual({ status: 'connected' });

    await rm(dir, { recursive: true });
  });
});

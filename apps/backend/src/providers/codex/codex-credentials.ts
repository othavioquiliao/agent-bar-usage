import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface CodexCredentials {
  accessToken: string;
}

export async function readCodexCredentials(credentialsPath?: string): Promise<CodexCredentials | null> {
  const filePath = credentialsPath ?? join(homedir(), '.codex', 'auth.json');

  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;

  const record = parsed as Record<string, unknown>;

  // Codex CLI uses auth_mode "chatgpt" with tokens.id_token or tokens.access_token
  const tokens = record.tokens;
  if (tokens && typeof tokens === 'object') {
    const t = tokens as Record<string, unknown>;
    const token = t.id_token ?? t.access_token;
    if (typeof token === 'string' && token) {
      return { accessToken: token };
    }
  }

  // Fallback: direct API key fields
  const accessToken = record.OPENAI_API_KEY ?? record.token ?? record.access_token ?? record.api_key;
  if (typeof accessToken === 'string' && accessToken) {
    return { accessToken };
  }

  return null;
}

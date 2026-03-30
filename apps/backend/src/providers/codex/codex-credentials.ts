import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ConnectedAccount } from 'shared-contract';

export interface CodexCredentials {
  accessToken: string;
}

async function readCodexAuthRecord(credentialsPath?: string): Promise<Record<string, unknown> | null> {
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
  return parsed as Record<string, unknown>;
}

export async function readCodexCredentials(credentialsPath?: string): Promise<CodexCredentials | null> {
  const record = await readCodexAuthRecord(credentialsPath);
  if (!record) return null;

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

export async function resolveCodexConnectedAccount(credentialsPath?: string): Promise<ConnectedAccount> {
  const record = await readCodexAuthRecord(credentialsPath);
  if (!record) {
    return { status: 'missing' };
  }

  const tokens = record.tokens && typeof record.tokens === 'object' ? (record.tokens as Record<string, unknown>) : null;
  const idToken = typeof tokens?.id_token === 'string' && tokens.id_token ? tokens.id_token : null;
  const labelFromToken = idToken ? extractLabelFromJwt(idToken) : null;
  if (labelFromToken) {
    return { status: 'connected', label: labelFromToken };
  }

  const labelCandidates = [
    record.email,
    record.user_email,
    record.username,
    record.login,
    record.account_name,
    record.name,
  ];
  const label = labelCandidates.find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0);
  if (typeof label === 'string') {
    return { status: 'connected', label: label.trim() };
  }

  return (await readCodexCredentials(credentialsPath)) ? { status: 'connected' } : { status: 'missing' };
}

function extractLabelFromJwt(token: string): string | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as
      | Record<string, unknown>
      | null;
    if (!payload) {
      return null;
    }

    const candidates = [payload.email, payload.preferred_username, payload.name, payload.sub];
    const label = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0);
    return typeof label === 'string' ? label.trim() : null;
  } catch {
    return null;
  }
}

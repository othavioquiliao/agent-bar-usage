import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ConnectedAccount } from 'shared-contract';

export interface ClaudeCredentials {
  accessToken: string;
  expiresAt: string | null;
}

async function readClaudeOauthRecord(credentialsPath?: string): Promise<Record<string, unknown> | null> {
  const filePath = credentialsPath ?? join(homedir(), '.claude', '.credentials.json');

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

  const oauth = (parsed as Record<string, unknown>)?.claudeAiOauth;
  if (!oauth || typeof oauth !== 'object') return null;

  return oauth as Record<string, unknown>;
}

export async function readClaudeCredentials(credentialsPath?: string): Promise<ClaudeCredentials | null> {
  const record = await readClaudeOauthRecord(credentialsPath);
  if (!record) return null;
  const accessToken = record.accessToken;
  if (typeof accessToken !== 'string' || !accessToken) return null;

  return {
    accessToken,
    expiresAt: typeof record.expiresAt === 'string' ? record.expiresAt : null,
  };
}

export async function resolveClaudeConnectedAccount(credentialsPath?: string): Promise<ConnectedAccount> {
  const record = await readClaudeOauthRecord(credentialsPath);
  if (!record) {
    return { status: 'missing' };
  }

  const accessToken = record.accessToken;
  if (typeof accessToken !== 'string' || !accessToken) {
    return { status: 'missing' };
  }

  const labelCandidates = [
    record.email,
    record.userEmail,
    record.displayName,
    record.name,
    typeof record.account === 'object' && record.account !== null
      ? (record.account as Record<string, unknown>).email
      : undefined,
    typeof record.account === 'object' && record.account !== null
      ? (record.account as Record<string, unknown>).name
      : undefined,
  ];

  const label = labelCandidates.find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0);
  return typeof label === 'string' ? { status: 'connected', label: label.trim() } : { status: 'connected' };
}

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface ClaudeCredentials {
  accessToken: string;
  expiresAt: string | null;
}

export async function readClaudeCredentials(
  credentialsPath?: string,
): Promise<ClaudeCredentials | null> {
  const filePath = credentialsPath ?? join(homedir(), ".claude", ".credentials.json");

  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
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
  if (!oauth || typeof oauth !== "object") return null;

  const record = oauth as Record<string, unknown>;
  const accessToken = record.accessToken;
  if (typeof accessToken !== "string" || !accessToken) return null;

  return {
    accessToken,
    expiresAt: typeof record.expiresAt === "string" ? record.expiresAt : null,
  };
}

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface CodexCredentials {
  accessToken: string;
}

export async function readCodexCredentials(
  credentialsPath?: string,
): Promise<CodexCredentials | null> {
  const filePath = credentialsPath ?? join(homedir(), ".codex", "auth.json");

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

  if (!parsed || typeof parsed !== "object") return null;

  const record = parsed as Record<string, unknown>;
  const accessToken = record.token ?? record.access_token ?? record.api_key;
  if (typeof accessToken !== "string" || !accessToken) return null;

  return { accessToken };
}

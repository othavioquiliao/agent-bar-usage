import type { ProviderAdapterContext } from "../../core/provider-adapter.js";

export interface CopilotTokenResolution {
  token: string;
  source: "env" | "secret";
  key?: string;
}

const ENV_TOKEN_KEYS = ["COPILOT_API_TOKEN", "GITHUB_TOKEN", "GH_TOKEN", "COPILOT_TOKEN"];

export function resolveCopilotToken(context: ProviderAdapterContext): CopilotTokenResolution | null {
  const fromEnv = resolveFromEnvironment(context.env);
  if (fromEnv) {
    return fromEnv;
  }

  const secret = normalizeToken(context.secrets?.primary);
  if (secret) {
    return {
      token: secret,
      source: "secret",
    };
  }

  return null;
}

function resolveFromEnvironment(env: NodeJS.ProcessEnv): CopilotTokenResolution | null {
  for (const key of ENV_TOKEN_KEYS) {
    const token = normalizeToken(env[key]);
    if (token) {
      return {
        token,
        source: "env",
        key,
      };
    }
  }

  return null;
}

function normalizeToken(token: string | null | undefined): string | null {
  const trimmed = token?.trim();
  if (!trimmed) {
    return null;
  }

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    const unquoted = trimmed.slice(1, -1).trim();
    return unquoted.length > 0 ? unquoted : null;
  }

  return trimmed.length > 0 ? trimmed : null;
}

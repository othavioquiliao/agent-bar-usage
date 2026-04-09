/**
 * Idempotent writer for the agent-bar config.json file.
 *
 * Used by the auth command to ensure the Copilot provider has a secretRef
 * pointing at the token that was just stored in GNOME Keyring.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface SecretReference {
  store: 'secret-tool';
  service: string;
  account: string;
}

/**
 * Raw config shape we read/write. Kept intentionally loose so we do not strip
 * unrecognized fields that were put there by other tools or future schema
 * versions.
 */
interface RawConfig {
  schemaVersion?: number;
  defaults?: Record<string, unknown>;
  providers?: RawProviderEntry[];
  [key: string]: unknown;
}

interface RawProviderEntry {
  id?: string;
  secretRef?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Ensure ~/.config/agent-bar/config.json exists and the copilot provider
 * has the given secretRef. Creates the file if it does not exist.
 *
 * All four cases are handled:
 *  1. File does not exist → create default config with copilot secretRef
 *  2. File exists, no copilot entry → add copilot provider entry
 *  3. File exists, copilot entry present but no secretRef → add secretRef
 *  4. File exists, copilot entry already has correct secretRef → no-op
 */
export async function ensureCopilotSecretRef(configPath: string, secretRef: SecretReference): Promise<void> {
  let config: RawConfig;

  try {
    const text = await readFile(configPath, 'utf8');
    config = JSON.parse(text) as RawConfig;
  } catch {
    // File does not exist or is invalid JSON — start fresh.
    config = buildDefaultConfig(secretRef);
    await persistConfig(configPath, config);
    return;
  }

  const providers: RawProviderEntry[] = Array.isArray(config.providers) ? config.providers : [];
  const copilotIndex = providers.findIndex((p) => p.id === 'copilot');

  if (copilotIndex === -1) {
    // No copilot provider at all — append one.
    providers.push(buildCopilotEntry(secretRef));
    config.providers = providers;
    await persistConfig(configPath, config);
    return;
  }

  const existing = providers[copilotIndex];
  if (!existing) {
    throw new Error(`Provider at index ${copilotIndex} not found`);
  }
  const existingRef = existing.secretRef;

  if (
    existingRef &&
    existingRef.store === secretRef.store &&
    existingRef.service === secretRef.service &&
    existingRef.account === secretRef.account
  ) {
    // Already configured correctly — nothing to do.
    return;
  }

  // Add or replace the secretRef.
  providers[copilotIndex] = { ...existing, secretRef: { ...secretRef } };
  config.providers = providers;
  await persistConfig(configPath, config);
}

function buildDefaultConfig(secretRef: SecretReference): RawConfig {
  return {
    schemaVersion: 1,
    defaults: { ttlSeconds: 30 },
    providers: [
      buildCopilotEntry(secretRef),
      { id: 'codex', enabled: true, sourceMode: 'auto' },
      { id: 'claude', enabled: true, sourceMode: 'auto' },
    ],
  };
}

function buildCopilotEntry(secretRef: SecretReference): RawProviderEntry {
  return {
    id: 'copilot',
    enabled: true,
    sourceMode: 'api',
    secretRef: { ...secretRef },
  };
}

async function persistConfig(configPath: string, config: RawConfig): Promise<void> {
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

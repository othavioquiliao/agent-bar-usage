import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rename } from 'node:fs/promises';
import { APP_NAME, getInstallPaths } from '../lifecycle/paths.js';
import { CURRENT_VERSION, DEFAULT_SETTINGS, type Settings } from './settings-schema.js';

/** Migrate settings from older schema versions. Currently a noop (v1 is the first version). */
function migrateSettings(data: Record<string, unknown>, _fromVersion: number): Record<string, unknown> {
  // Future: if (fromVersion < 2) { /* v1 -> v2 migration */ }
  return data;
}

function getSettingsPaths(): { settingsDir: string; settingsFile: string } {
  const paths = getInstallPaths();
  return { settingsDir: paths.settingsDir, settingsFile: paths.settingsFile };
}

export function normalizeSettings(data: Partial<Settings> | undefined): Settings {
  if (data === undefined || data === null) {
    return { ...DEFAULT_SETTINGS };
  }

  const raw = data as Record<string, unknown>;
  if (typeof raw.version === 'number' && raw.version < CURRENT_VERSION) {
    migrateSettings(raw, raw.version);
  }

  return { ...data, version: CURRENT_VERSION };
}

export async function loadSettings(): Promise<Settings> {
  const { settingsFile } = getSettingsPaths();
  const file = Bun.file(settingsFile);

  if (!(await file.exists())) {
    return normalizeSettings(undefined);
  }

  try {
    const data = await file.json();
    const normalized = normalizeSettings(data);

    if (JSON.stringify(normalized) !== JSON.stringify(data)) {
      await saveSettings(normalized);
    }

    return normalized;
  } catch (err) {
    process.stderr.write(`[${APP_NAME}] Settings parse error (using defaults): ${err}\n`);
    return normalizeSettings(undefined);
  }
}

export function loadSettingsSync(): Settings {
  const { settingsFile } = getSettingsPaths();

  try {
    if (!existsSync(settingsFile)) {
      return normalizeSettings(undefined);
    }
    const data = JSON.parse(readFileSync(settingsFile, 'utf-8'));
    return normalizeSettings(data);
  } catch (err) {
    process.stderr.write(`[${APP_NAME}] Settings sync read error (using defaults): ${err}\n`);
    return normalizeSettings(undefined);
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const { settingsDir, settingsFile } = getSettingsPaths();
  await mkdir(settingsDir, { recursive: true });
  const tmp = `${settingsFile}.tmp`;
  await Bun.write(tmp, JSON.stringify(normalizeSettings(settings), null, 2));
  await rename(tmp, settingsFile);
}

export function getSettingsPath(): string {
  return getSettingsPaths().settingsFile;
}

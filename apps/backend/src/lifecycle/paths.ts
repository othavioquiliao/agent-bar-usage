import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_NAME = 'agent-bar';
export const GNOME_EXT_UUID = 'agent-bar-ubuntu@othavio.dev';

export const REPO_ROOT = resolve(fileURLToPath(new URL('../../../../', import.meta.url)));

/** Items to copy from apps/gnome-extension during setup. */
export const EXT_ITEMS = [
  'extension.js',
  'metadata.json',
  'panel',
  'services',
  'state',
  'utils',
  'assets',
  'stylesheet.css',
];

/** Environment variables to capture in the systemd env override. */
export const ENV_VARS_TO_CAPTURE = [
  'PATH',
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'COPILOT_TOKEN',
  'COPILOT_API_TOKEN',
  'ANTHROPIC_API_KEY',
  'DBUS_SESSION_BUS_ADDRESS',
];

export interface InstallPaths {
  cliSymlink: string;
  systemdDir: string;
  serviceFile: string;
  overrideDir: string;
  envOverride: string;
  tmpfilesDir: string;
  tmpfilesConf: string;
  extensionDir: string;
  settingsDir: string;
  settingsFile: string;
  configFile: string;
  cacheDir: string;
}

export function getInstallPaths(home?: string): InstallPaths {
  const h = home ?? homedir();

  const xdgConfig = process.env.XDG_CONFIG_HOME || join(h, '.config');
  const xdgData = process.env.XDG_DATA_HOME || join(h, '.local', 'share');
  const xdgCache = process.env.XDG_CACHE_HOME || join(h, '.cache');

  return {
    cliSymlink: join(h, '.local', 'bin', APP_NAME),
    systemdDir: join(xdgConfig, 'systemd', 'user'),
    serviceFile: join(xdgConfig, 'systemd', 'user', `${APP_NAME}.service`),
    overrideDir: join(xdgConfig, 'systemd', 'user', `${APP_NAME}.service.d`),
    envOverride: join(xdgConfig, 'systemd', 'user', `${APP_NAME}.service.d`, 'env.conf'),
    tmpfilesDir: join(xdgConfig, 'user-tmpfiles.d'),
    tmpfilesConf: join(xdgConfig, 'user-tmpfiles.d', `${APP_NAME}.conf`),
    extensionDir: join(xdgData, 'gnome-shell', 'extensions', GNOME_EXT_UUID),
    settingsDir: join(xdgConfig, APP_NAME),
    settingsFile: join(xdgConfig, APP_NAME, 'settings.json'),
    configFile: join(xdgConfig, APP_NAME, 'config.json'),
    cacheDir: join(xdgCache, APP_NAME),
  };
}

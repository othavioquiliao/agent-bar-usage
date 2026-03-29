import Gio from 'gi://Gio';
import St from 'gi://St';

import { normalizeProviderId, resolvePackagedProviderIconRelativePaths } from './provider-icon-assets.js';

function resolveAssetFile(baseFile, relativePath) {
  if (!baseFile || typeof relativePath !== 'string' || relativePath.trim().length === 0) {
    return null;
  }

  let file = baseFile;
  for (const segment of relativePath.split('/')) {
    if (!segment) {
      continue;
    }
    file = file?.get_child(segment) ?? null;
  }

  return file;
}

function resolvePackagedIconFile(extension, providerId) {
  const assetsDir = extension?.dir?.get_child('assets') ?? null;

  for (const relativePath of resolvePackagedProviderIconRelativePaths(providerId)) {
    const file = resolveAssetFile(assetsDir, relativePath);
    if (file?.query_exists(null)) {
      return file;
    }
  }

  return null;
}

function createPackagedIconActor({ extension, providerId, status, size }) {
  const file = resolvePackagedIconFile(extension, providerId);
  if (!file) {
    return createFallbackBadgeActor({ providerId, status, size });
  }

  return new St.Icon({
    gicon: new Gio.FileIcon({ file }),
    icon_size: size,
    style_class: 'agent-bar-ubuntu-provider-icon',
    accessible_name: providerId,
  });
}

function createFallbackBadgeActor({ providerId, status, size }) {
  const labelText = providerId === 'copilot' ? 'Co' : (providerId || '?').slice(0, 2).toUpperCase();
  const badge = new St.Label({
    text: labelText,
    style_class: 'agent-bar-ubuntu-provider-badge',
    accessible_name: providerId === 'copilot' ? 'Copilot' : 'Provider',
  });
  badge.set_width(size);
  badge.set_height(size);
  badge.add_style_class_name(`agent-bar-ubuntu-provider-badge--${providerId || 'default'}`);
  badge.add_style_class_name(`agent-bar-ubuntu-provider-badge--${status || 'unknown'}`);
  return badge;
}

export function createProviderIdentityActor({ extension, providerId, status, size = 16 }) {
  const normalizedProviderId = normalizeProviderId(providerId);
  const actor =
    resolvePackagedProviderIconRelativePaths(normalizedProviderId).length > 0
      ? createPackagedIconActor({
          extension,
          providerId: normalizedProviderId,
          status,
          size,
        })
      : createFallbackBadgeActor({
          providerId: normalizedProviderId === 'copilot' ? 'copilot' : normalizedProviderId,
          status,
          size,
        });

  actor.add_style_class_name(`agent-bar-ubuntu-provider-row--${normalizedProviderId || 'default'}`);
  actor.add_style_class_name(`agent-bar-ubuntu-provider-row--${status || 'unknown'}`);
  return actor;
}

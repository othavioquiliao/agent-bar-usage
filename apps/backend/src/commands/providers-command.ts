import * as p from '@clack/prompts';

import { loadBackendConfig, saveBackendConfig } from '../config/config-loader.js';
import type { BackendConfig, ProviderConfig } from '../config/config-schema.js';
import { createDefaultConfig } from '../config/default-config.js';
import { getBuiltinProviders } from '../providers/index.js';

export interface ProvidersCommandOptions {
  path?: string;
}

export interface ProvidersCommandDependencies {
  loadConfig?: typeof loadBackendConfig;
  saveConfig?: typeof saveBackendConfig;
  selectProviders?: (options: {
    providers: Array<{ id: ProviderConfig['id']; name: string }>;
    initialSelectedIds: ProviderConfig['id'][];
  }) => Promise<ProviderConfig['id'][] | symbol>;
  selectProviderOrder?: (options: {
    selectedIds: ProviderConfig['id'][];
    namesById: Record<string, string>;
  }) => Promise<ProviderConfig['id'][] | symbol>;
}

const CANCELLED = Symbol('providers-command-cancelled');

export async function runProvidersCommand(
  options: ProvidersCommandOptions = {},
  dependencies: ProvidersCommandDependencies = {},
): Promise<string> {
  const loadConfig = dependencies.loadConfig ?? loadBackendConfig;
  const saveConfig = dependencies.saveConfig ?? saveBackendConfig;
  const availableProviders = getBuiltinProviders().map((provider) => ({
    id: provider.id,
    name: provider.name,
  }));
  const namesById = Object.fromEntries(availableProviders.map((provider) => [provider.id, provider.name]));
  const loaded = await loadConfig({
    explicitPath: options.path,
  });
  const currentSelectedIds = loaded.config.providers
    .filter((provider) => provider.enabled)
    .map((provider) => provider.id);

  const selectedIds = await (dependencies.selectProviders ?? promptForProviders)({
    providers: availableProviders,
    initialSelectedIds: currentSelectedIds,
  });

  if (isCancelled(selectedIds)) {
    return 'Provider selection cancelled.';
  }

  const orderedSelectedIds =
    selectedIds.length > 1
      ? await (dependencies.selectProviderOrder ?? promptForProviderOrder)({
          selectedIds,
          namesById,
        })
      : selectedIds;

  if (isCancelled(orderedSelectedIds)) {
    return 'Provider selection cancelled.';
  }

  const nextConfig = applyProviderSelection(loaded.config, orderedSelectedIds);
  const saved = await saveConfig(nextConfig, {
    explicitPath: options.path ?? loaded.path,
  });

  return orderedSelectedIds.length > 0
    ? `Providers updated at ${saved.path}: ${orderedSelectedIds.join(', ')}`
    : `Providers updated at ${saved.path}: none enabled`;
}

export function applyProviderSelection(config: BackendConfig, enabledIds: ProviderConfig['id'][]): BackendConfig {
  const defaultsById = new Map(createDefaultConfig().providers.map((provider) => [provider.id, provider]));
  const existingById = new Map(config.providers.map((provider) => [provider.id, provider]));
  const remainingIds = getBuiltinProviders()
    .map((provider) => provider.id)
    .filter((providerId) => !enabledIds.includes(providerId));
  const orderedIds = [...enabledIds, ...remainingIds];

  return {
    ...config,
    providers: orderedIds.map((providerId) =>
      buildProviderConfig(providerId, existingById.get(providerId) ?? defaultsById.get(providerId), enabledIds),
    ),
  };
}

function buildProviderConfig(
  providerId: ProviderConfig['id'],
  baseConfig: ProviderConfig | undefined,
  enabledIds: ProviderConfig['id'][],
): ProviderConfig {
  if (!baseConfig) {
    throw new Error(`Unknown provider: ${providerId}`);
  }

  return {
    ...baseConfig,
    enabled: enabledIds.includes(providerId),
  };
}

async function promptForProviders(options: {
  providers: Array<{ id: ProviderConfig['id']; name: string }>;
  initialSelectedIds: ProviderConfig['id'][];
}): Promise<ProviderConfig['id'][] | symbol> {
  const result = await p.multiselect({
    message: 'Select providers to show in the GNOME topbar',
    options: options.providers.map((provider) => ({
      value: provider.id,
      label: provider.name,
    })),
    initialValues: options.initialSelectedIds,
    required: false,
  });

  if (p.isCancel(result)) {
    return CANCELLED;
  }

  return result as ProviderConfig['id'][];
}

async function promptForProviderOrder(options: {
  selectedIds: ProviderConfig['id'][];
  namesById: Record<string, string>;
}): Promise<ProviderConfig['id'][] | symbol> {
  let remaining = [...options.selectedIds];
  const ordered: ProviderConfig['id'][] = [];

  while (remaining.length > 1) {
    const result = await p.select({
      message: `Choose the next provider (${ordered.length + 1}/${options.selectedIds.length})`,
      options: remaining.map((providerId) => ({
        value: providerId,
        label: options.namesById[providerId] ?? providerId,
      })),
      initialValue: remaining[0],
    });

    if (p.isCancel(result)) {
      return CANCELLED;
    }

    const pickedProvider = result as ProviderConfig['id'];
    ordered.push(pickedProvider);
    remaining = remaining.filter((providerId) => providerId !== pickedProvider);
  }

  return [...ordered, ...remaining];
}

function isCancelled(value: ProviderConfig['id'][] | symbol): value is symbol {
  return value === CANCELLED;
}

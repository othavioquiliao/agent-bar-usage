const PACKAGED_PROVIDER_ICON_RELATIVE_PATHS = {
  claude: ['claude-code-icon.png'],
  claudecode: ['claude-code-icon.png'],
  codex: ['codex-icon.png'],
  copilot: ['copilot-icon.png'],
};

export function normalizeProviderId(providerId) {
  return String(providerId ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function resolvePackagedProviderIconRelativePaths(providerId) {
  const normalizedProviderId = normalizeProviderId(providerId);
  return [...(PACKAGED_PROVIDER_ICON_RELATIVE_PATHS[normalizedProviderId] ?? [])];
}

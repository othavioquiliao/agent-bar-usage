const PACKAGED_PROVIDER_ICON_RELATIVE_PATHS = {
  claude: ['providers/claude.svg', 'claude-code-icon.png'],
  claudecode: ['providers/claude.svg', 'claude-code-icon.png'],
  codex: ['providers/codex.svg', 'codex-icon.png'],
  copilot: ['providers/copilot.svg', 'copilot-icon.png'],
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

export function buildProviderRowLayoutModel(viewModel = {}) {
  const quotaLine =
    typeof viewModel.quotaText === 'string' && viewModel.quotaText.trim()
      ? viewModel.quotaText.trim()
      : typeof viewModel.usageText === 'string' && viewModel.usageText.trim()
        ? viewModel.usageText.trim()
        : 'Usage: Unavailable';
  const accountText =
    typeof viewModel.accountText === 'string' && viewModel.accountText.trim()
      ? viewModel.accountText.trim()
      : 'Account: Unavailable';
  const resetText =
    typeof viewModel.resetText === 'string' && viewModel.resetText.trim() ? viewModel.resetText.trim() : 'Reset: Unavailable';
  const progressPercent = Number.isFinite(viewModel.progressPercent)
    ? Math.max(0, Math.min(100, Math.round(viewModel.progressPercent)))
    : null;
  const showProgressBar = Boolean(viewModel.progressVisible && progressPercent !== null);
  const providerKey = String(viewModel.iconKey ?? viewModel.providerId ?? '')
    .trim()
    .toLowerCase();
  const accentClass = providerKey
    ? `agent-bar-ubuntu-progress-fill--${providerKey}`
    : `agent-bar-ubuntu-progress-fill--${String(viewModel.status ?? 'unknown')
        .trim()
        .toLowerCase()}`;

  const secondaryQuotaLine =
    typeof viewModel.secondaryUsageText === 'string' && viewModel.secondaryUsageText.trim()
      ? viewModel.secondaryUsageText.trim()
      : null;
  const secondaryResetText =
    typeof viewModel.secondaryResetText === 'string' && viewModel.secondaryResetText.trim()
      ? viewModel.secondaryResetText.trim()
      : null;
  const secondaryProgressPercent = Number.isFinite(viewModel.secondaryProgressPercent)
    ? Math.max(0, Math.min(100, Math.round(viewModel.secondaryProgressPercent)))
    : null;
  const showSecondaryProgressBar = Boolean(viewModel.secondaryProgressVisible && secondaryProgressPercent !== null);
  const hasSecondary = Boolean(viewModel.hasSecondaryUsage && secondaryQuotaLine);

  return {
    providerId: viewModel.providerId ?? 'provider',
    title: viewModel.title ?? 'Provider',
    status: viewModel.status ?? 'unknown',
    statusText: viewModel.statusText ?? 'Unknown',
    headerText: `${viewModel.title ?? 'Provider'} · ${viewModel.statusText ?? 'Unknown'}`,
    accountText,
    quotaLine,
    resetText,
    progressPercent,
    showProgressBar,
    showProgressFill: showProgressBar && progressPercent > 0,
    accentClass,
    hasSecondary,
    secondaryQuotaLine,
    secondaryResetText,
    secondaryProgressPercent,
    showSecondaryProgressBar,
    showSecondaryProgressFill: showSecondaryProgressBar && secondaryProgressPercent > 0,
  };
}

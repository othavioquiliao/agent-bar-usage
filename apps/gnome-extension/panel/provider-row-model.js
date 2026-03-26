function chooseSecondaryText(viewModel = {}) {
  const candidates = [
    viewModel.resetText,
    viewModel.issueSummaryText,
    viewModel.secondaryText,
    viewModel.metadataText,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }

    const trimmed = candidate.trim();
    if (!trimmed) {
      continue;
    }

    if (/^Suggested command:/i.test(trimmed)) {
      continue;
    }

    if (/^(Source:|Updated\b)/i.test(trimmed)) {
      continue;
    }

    return trimmed;
  }

  return null;
}

export function buildProviderRowLayoutModel(viewModel = {}) {
  const quotaLine = typeof viewModel.quotaText === "string" && viewModel.quotaText.trim()
    ? viewModel.quotaText.trim()
    : typeof viewModel.usageText === "string" && viewModel.usageText.trim()
      ? viewModel.usageText.trim()
      : null;
  const progressPercent = Number.isFinite(viewModel.progressPercent)
    ? Math.max(0, Math.min(100, Math.round(viewModel.progressPercent)))
    : null;
  const showProgressBar = Boolean(viewModel.progressVisible && quotaLine && progressPercent !== null);
  const providerKey = String(viewModel.iconKey ?? viewModel.providerId ?? "").trim().toLowerCase();
  const accentClass = providerKey
    ? `agent-bar-ubuntu-progress-fill--${providerKey}`
    : `agent-bar-ubuntu-progress-fill--${String(viewModel.status ?? "unknown").trim().toLowerCase()}`;

  return {
    providerId: viewModel.providerId ?? "provider",
    title: viewModel.title ?? "Provider",
    status: viewModel.status ?? "unknown",
    statusText: viewModel.statusText ?? "Unknown",
    statusIconName: viewModel.statusIconName ?? "dialog-information-symbolic",
    iconKey: providerKey || null,
    quotaLine,
    progressPercent,
    showProgressBar,
    showProgressFill: showProgressBar && progressPercent > 0,
    secondaryText: chooseSecondaryText(viewModel),
    accentClass,
  };
}

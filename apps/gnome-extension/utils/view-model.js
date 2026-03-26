import { formatLastUpdatedText, formatTimestampLabel } from "./time.js";

const PROVIDER_ACCENT_COLORS = {
  claude: "#d19a66",
  codex: "#98c379",
  copilot: "#61afef",
};

function formatProviderTitle(providerId) {
  if (!providerId) {
    return "Provider";
  }

  return providerId.charAt(0).toUpperCase() + providerId.slice(1);
}

function formatStatusText(status) {
  switch (status) {
    case "ok":
      return "Healthy";
    case "degraded":
      return "Issue";
    case "error":
      return "Error";
    case "unavailable":
      return "Unavailable";
    default:
      return "Unknown";
  }
}

function formatUsageText(usage) {
  if (!usage || usage.kind !== "quota") {
    return null;
  }

  const used = usage.used ?? "?";
  const limit = usage.limit ?? "?";
  const percent = clampPercent(usage.percent_used);
  const percentText = percent === null ? "" : ` (${percent}%)`;

  return `${used} / ${limit}${percentText}`;
}

function formatResetWindowText(resetWindow) {
  if (!resetWindow) {
    return null;
  }

  return `Reset ${resetWindow.label}`;
}

function formatStatusIconName(status) {
  switch (status) {
    case "ok":
      return "emblem-ok-symbolic";
    case "degraded":
    case "unavailable":
      return "dialog-warning-symbolic";
    case "error":
      return "dialog-error-symbolic";
    default:
      return "dialog-information-symbolic";
  }
}

function clampPercent(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatIssueSummary(providerSnapshot) {
  const error = providerSnapshot?.error ?? null;
  const attempts = providerSnapshot?.diagnostics?.attempts ?? [];
  const status = providerSnapshot?.status ?? "unknown";
  const message = error?.message ?? "";

  if (error?.code === "secret_store_unavailable" || /secret-tool/i.test(message)) {
    return "Missing secret-tool";
  }

  if (error?.code === "secret_not_found") {
    return "Missing credential";
  }

  if (
    error?.code === "auth_required"
    || error?.code === "unauthorized"
    || error?.code === "forbidden"
    || /auth/i.test(message)
    || /\b401\b|\b403\b/i.test(message)
  ) {
    return "Auth needed";
  }

  if (status === "unavailable") {
    return "Unavailable";
  }

  if (status === "degraded") {
    return "Needs attention";
  }

  if (status === "error") {
    return "Error";
  }

  if (attempts.length > 0) {
    return "Needs attention";
  }

  return null;
}

function formatSuggestedCommand(providerSnapshot) {
  if (!providerSnapshot) {
    return null;
  }

  if (providerSnapshot.error || (providerSnapshot.diagnostics?.attempts?.length ?? 0) > 0) {
    return "Suggested command: agent-bar doctor --json";
  }

  return null;
}

export function buildProviderRowViewModel(providerSnapshot, { now = new Date() } = {}) {
  const providerId = providerSnapshot?.provider ?? "provider";
  const title = formatProviderTitle(providerId);
  const status = providerSnapshot?.status ?? "unknown";
  const statusText = formatStatusText(status);
  const iconKey = providerId;
  const statusIconName = formatStatusIconName(status);
  const accentColor = PROVIDER_ACCENT_COLORS[providerId] ?? null;
  const quotaText = formatUsageText(providerSnapshot?.usage ?? null);
  const progressPercent = clampPercent(providerSnapshot?.usage?.percent_used ?? null);
  const progressVisible = progressPercent !== null;
  const resetText = formatResetWindowText(providerSnapshot?.reset_window ?? null);
  const issueSummaryText = formatIssueSummary(providerSnapshot);
  const secondaryText = resetText ?? issueSummaryText;
  const updatedAtText = providerSnapshot?.updated_at
    ? formatTimestampLabel(providerSnapshot.updated_at, { prefix: "Updated", now })
    : "Updated time unavailable";
  const errorText = providerSnapshot?.error?.message ?? null;
  const detailsSourceText = providerSnapshot?.source ? `Source: ${providerSnapshot.source}` : null;
  const detailsSuggestedCommandText = formatSuggestedCommand(providerSnapshot);

  return {
    providerId,
    title,
    status,
    statusText,
    statusIconName,
    iconKey,
    accentColor,
    quotaText,
    progressPercent,
    progressVisible,
    secondaryText,
    detailsSuggestedCommandText,
    detailsSourceText,
    issueSummaryText,
    resetText,
    updatedAtText,
    errorText,
    usageText: quotaText,
    sourceText: detailsSourceText,
    diagnosticsSummaryText: issueSummaryText,
    suggestedCommandText: detailsSuggestedCommandText,
    hasError: Boolean(issueSummaryText || errorText || status === "error"),
    hasUsage: progressVisible,
    isUnavailable: status === "unavailable",
  };
}

export function buildSnapshotViewModel(state = {}, { now = new Date() } = {}) {
  const snapshotEnvelope = state.snapshotEnvelope ?? null;
  const providerSnapshots = Array.isArray(snapshotEnvelope?.providers) ? snapshotEnvelope.providers : [];
  const providerRows = providerSnapshots.map((providerSnapshot) =>
    buildProviderRowViewModel(providerSnapshot, { now }),
  );
  const providerCount = providerRows.length;
  const healthyCount = providerRows.filter((row) => row.status === "ok").length;
  const issueCount = providerRows.filter((row) => row.status !== "ok").length;
  const errorCount = providerRows.filter((row) => row.status === "error").length;
  const unavailableCount = providerRows.filter((row) => row.status === "unavailable").length;
  const hasProviders = providerCount > 0;
  const diagnosticsSummaryText = state.lastError
    ? `Backend error: ${state.lastError}`
    : issueCount > 0
      ? `${issueCount} issue${issueCount === 1 ? "" : "s"}`
      : hasProviders
        ? `${healthyCount}/${providerCount} ok`
        : null;
  const suggestedCommandText = state.lastError || issueCount > 0
    ? "Suggested command: agent-bar doctor --json"
    : null;
  const summaryTitle = state.isLoading
    ? "Refreshing"
    : state.lastError
      ? "Service"
      : issueCount > 0
        ? `${issueCount} issue${issueCount === 1 ? "" : "s"}`
        : hasProviders
          ? `${healthyCount}/${providerCount} ok`
          : "No provider data yet";
  const summaryBody = state.lastError
    ? `Backend error: ${state.lastError}`
    : hasProviders
      ? issueCount > 0
        ? `${issueCount} issue${issueCount === 1 ? "" : "s"}`
        : `${healthyCount}/${providerCount} ok`
      : state.isLoading
        ? "Waiting for refreshed data"
        : "Enable providers to see usage";
  const lastUpdatedText = state.lastUpdatedText
    ?? (snapshotEnvelope?.generated_at ? formatLastUpdatedText(snapshotEnvelope.generated_at, now) : null);

  return {
    providerRows,
    providerCount,
    healthyCount,
    issueCount,
    errorCount,
    unavailableCount,
    hasProviders,
    summaryTitle,
    summaryBody,
    diagnosticsSummaryText,
    suggestedCommandText,
    lastUpdatedText,
    lastErrorText: state.lastError ?? null,
    emptyStateText: hasProviders ? null : "No provider data yet",
  };
}

export function buildIndicatorSummaryViewModel(state = {}, { now = new Date() } = {}) {
  const snapshot = buildSnapshotViewModel(state, { now });
  let iconName = "dialog-information-symbolic";
  let labelText = "No data";

  if (state.isLoading) {
    iconName = "view-refresh-symbolic";
    labelText = "Refreshing";
  } else if (state.lastError) {
    iconName = "dialog-error-symbolic";
    labelText = "Service";
  } else if (snapshot.issueCount > 0) {
    iconName = "dialog-warning-symbolic";
    labelText = `${snapshot.issueCount} issue${snapshot.issueCount === 1 ? "" : "s"}`;
  } else if (snapshot.hasProviders) {
    iconName = "emblem-ok-symbolic";
    labelText = `${snapshot.healthyCount}/${snapshot.providerCount} ok`;
  }

  return {
    iconName,
    labelText,
    statusText: snapshot.lastUpdatedText ?? snapshot.summaryBody,
    providerCount: snapshot.providerCount,
    healthyCount: snapshot.healthyCount,
    issueCount: snapshot.issueCount,
    errorCount: snapshot.errorCount,
    hasProviders: snapshot.hasProviders,
    lastUpdatedText: snapshot.lastUpdatedText,
  };
}

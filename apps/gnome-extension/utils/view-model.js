import { formatLastUpdatedText, formatTimestampLabel } from "./time.js";

export const INDICATOR_PROVIDER_ORDER = ["codex", "claude", "copilot"];

const INDICATOR_PROVIDER_META = {
  codex: {
    title: "Codex",
  },
  claude: {
    title: "Claude",
  },
  copilot: {
    title: "Copilot",
  },
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
      return "Degraded";
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
    return "Usage unavailable";
  }

  const used = usage.used ?? "?";
  const limit = usage.limit ?? "?";
  const percent = usage.percent_used ?? null;
  const percentText = percent === null ? "" : ` (${percent}%)`;

  return `Usage: ${used} / ${limit}${percentText}`;
}

function formatUsagePercentText(usage) {
  if (!usage || usage.kind !== "quota") {
    return "--%";
  }

  const percent = usage.percent_used;
  if (typeof percent !== "number" || !Number.isFinite(percent)) {
    return "--%";
  }

  return `${Math.round(percent)}%`;
}

function formatResetWindowText(resetWindow) {
  if (!resetWindow) {
    return null;
  }

  return `Reset: ${resetWindow.label}`;
}

function formatDiagnosticsSummary(providerSnapshot) {
  const error = providerSnapshot?.error ?? null;
  const attempts = providerSnapshot?.diagnostics?.attempts ?? [];

  if (error?.code === "secret_store_unavailable" || /secret-tool/i.test(error?.message ?? "")) {
    return "Missing prerequisite: secret-tool";
  }

  if (error?.code === "secret_not_found") {
    return "Missing prerequisite: stored credential";
  }

  if (error?.message) {
    return `Diagnostics: ${error.message}`;
  }

  if (attempts.length > 0) {
    return `Diagnostics: ${attempts.length} attempt${attempts.length === 1 ? "" : "s"}`;
  }

  return null;
}

const ERROR_CODE_COMMANDS = {
  copilot_token_missing: "agent-bar auth copilot",
  claude_auth_expired: "claude auth login",
  claude_cli_missing: "npm i -g @anthropic-ai/claude-code",
  claude_cli_failed: "agent-bar doctor",
  codex_cli_missing: "npm i -g @openai/codex",
  codex_cli_failed: "agent-bar doctor",
  codex_pty_unavailable: "sudo apt install build-essential python3 && pnpm install",
  secret_store_unavailable: "sudo apt install libsecret-tools",
};

function formatSuggestedCommand(providerSnapshot) {
  if (!providerSnapshot) {
    return null;
  }

  const code = providerSnapshot.error?.code;
  if (code && ERROR_CODE_COMMANDS[code]) {
    return `Run: ${ERROR_CODE_COMMANDS[code]}`;
  }

  if (providerSnapshot.error || (providerSnapshot.diagnostics?.attempts?.length ?? 0) > 0) {
    return "Run: agent-bar doctor";
  }

  return null;
}

export function buildProviderRowViewModel(providerSnapshot, { now = new Date() } = {}) {
  const providerId = providerSnapshot?.provider ?? "provider";
  const title = formatProviderTitle(providerId);
  const status = providerSnapshot?.status ?? "unknown";
  const statusText = formatStatusText(status);
  const usageText = formatUsageText(providerSnapshot?.usage ?? null);
  const usagePercentText = formatUsagePercentText(providerSnapshot?.usage ?? null);
  const resetText = formatResetWindowText(providerSnapshot?.reset_window ?? null);
  const updatedAtText = providerSnapshot?.updated_at
    ? formatTimestampLabel(providerSnapshot.updated_at, { prefix: "Updated", now })
    : "Updated time unavailable";
  const errorText = providerSnapshot?.error?.message ?? null;
  const sourceText = providerSnapshot?.source ? `Source: ${providerSnapshot.source}` : null;
  const diagnosticsSummaryText = formatDiagnosticsSummary(providerSnapshot);
  const suggestedCommandText = formatSuggestedCommand(providerSnapshot);

  return {
    providerId,
    title,
    status,
    statusText,
    usageText,
    usagePercentText,
    resetText,
    updatedAtText,
    errorText,
    sourceText,
    diagnosticsSummaryText,
    suggestedCommandText,
    hasError: Boolean(errorText),
    hasUsage: Boolean(providerSnapshot?.usage),
    isUnavailable: status === "unavailable",
  };
}

function buildIndicatorProviderViewModel(providerId, providerSnapshot, state, { now = new Date() } = {}) {
  const meta = INDICATOR_PROVIDER_META[providerId] ?? {
    title: formatProviderTitle(providerId),
  };
  const usagePercentText = formatUsagePercentText(providerSnapshot?.usage ?? null);
  const status = providerSnapshot?.status
    ?? (state.lastError ? "error" : state.isLoading ? "loading" : "idle");
  const statusText = providerSnapshot?.status
    ? formatStatusText(providerSnapshot.status)
    : state.lastError
      ? "Backend error"
      : state.isLoading
        ? "Refreshing"
        : "Waiting for data";
  const updatedAtText = providerSnapshot?.updated_at
    ? formatTimestampLabel(providerSnapshot.updated_at, { prefix: "Updated", now })
    : null;

  return {
    providerId,
    title: meta.title,
    usagePercentText,
    status,
    statusText,
    updatedAtText,
    isMissingUsage: usagePercentText === "--%",
    isLoading: state.isLoading,
    isStale: Boolean(state.lastError),
  };
}

export function buildSnapshotViewModel(state = {}, { now = new Date() } = {}) {
  const snapshotEnvelope = state.snapshotEnvelope ?? null;
  const providerSnapshots = Array.isArray(snapshotEnvelope?.providers) ? snapshotEnvelope.providers : [];
  const providerRows = providerSnapshots.map((providerSnapshot) =>
    buildProviderRowViewModel(providerSnapshot, { now }),
  );
  const providerCount = providerRows.length;
  const errorCount = providerRows.filter((row) => row.hasError || row.status === "error").length;
  const unavailableCount = providerRows.filter((row) => row.status === "unavailable").length;
  const hasProviders = providerCount > 0;
  const diagnosticsSummaryText = state.lastError
    ? `Backend error: ${state.lastError}`
    : errorCount > 0
      ? `${errorCount} provider${errorCount === 1 ? "" : "s"} reported an error`
      : unavailableCount > 0
        ? `${unavailableCount} provider${unavailableCount === 1 ? "" : "s"} unavailable`
        : null;
  const suggestedCommandText = state.lastError || errorCount > 0 || unavailableCount > 0
    ? "Suggested command: agent-bar doctor --json"
    : null;
  const summaryTitle = state.isLoading
    ? "Refreshing provider snapshots"
    : hasProviders
      ? `${providerCount} provider${providerCount === 1 ? "" : "s"} loaded`
      : "No provider data yet";
  const summaryBody = state.lastError
    ? `Backend error: ${state.lastError}`
    : hasProviders
      ? errorCount > 0
        ? `${errorCount} provider${errorCount === 1 ? "" : "s"} reported an error`
        : "All providers reporting normally"
      : state.isLoading
        ? "Waiting for refreshed data"
        : "Enable providers to see usage";
  const lastUpdatedText = state.lastUpdatedText
    ?? (snapshotEnvelope?.generated_at ? formatLastUpdatedText(snapshotEnvelope.generated_at, now) : null);

  return {
    providerRows,
    providerCount,
    errorCount,
    unavailableCount,
    hasProviders,
    summaryTitle,
    summaryBody,
    diagnosticsSummaryText,
    suggestedCommandText,
    lastUpdatedText,
    lastErrorText: state.lastError ?? null,
    emptyStateText: hasProviders ? null : "No provider snapshots yet",
  };
}

export function buildIndicatorSummaryViewModel(state = {}, { now = new Date() } = {}) {
  const snapshot = buildSnapshotViewModel(state, { now });
  const providerSnapshots = Array.isArray(state.snapshotEnvelope?.providers) ? state.snapshotEnvelope.providers : [];
  const providerSnapshotsById = new Map(providerSnapshots.map((providerSnapshot) => [providerSnapshot.provider, providerSnapshot]));
  const providerItems = INDICATOR_PROVIDER_ORDER.map((providerId) =>
    buildIndicatorProviderViewModel(providerId, providerSnapshotsById.get(providerId) ?? null, state, { now }),
  );
  let panelStatus = "idle";

  if (state.lastError) {
    panelStatus = "error";
  } else if (state.isLoading) {
    panelStatus = "loading";
  } else if (snapshot.errorCount > 0) {
    panelStatus = "warning";
  } else if (snapshot.hasProviders) {
    panelStatus = "ready";
  }

  return {
    providerItems,
    panelStatus,
    statusText: snapshot.lastUpdatedText ?? snapshot.summaryBody,
    providerCount: snapshot.providerCount,
    errorCount: snapshot.errorCount,
    hasProviders: snapshot.hasProviders,
    lastUpdatedText: snapshot.lastUpdatedText,
    hasGlobalError: Boolean(state.lastError),
    isLoading: Boolean(state.isLoading),
  };
}

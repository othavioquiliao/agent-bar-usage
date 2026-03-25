import type { ProviderSnapshot, SnapshotEnvelope } from "shared-contract";

export interface TextFormatterOptions {
  includeDiagnostics?: boolean;
}

function formatUsage(snapshot: ProviderSnapshot): string | null {
  if (!snapshot.usage) {
    return null;
  }

  const used = snapshot.usage.used ?? "?";
  const limit = snapshot.usage.limit ?? "?";
  const percent = snapshot.usage.percent_used ?? "?";
  return `${used}/${limit} (${percent}%)`;
}

function formatProvider(snapshot: ProviderSnapshot, includeDiagnostics: boolean): string {
  const lines: string[] = [];
  lines.push(`Provider: ${snapshot.provider}`);
  lines.push(`status: ${snapshot.status}`);
  lines.push(`source: ${snapshot.source}`);
  lines.push(`updated_at: ${snapshot.updated_at}`);

  const usage = formatUsage(snapshot);
  if (usage) {
    lines.push(`usage: ${usage}`);
  }

  if (snapshot.reset_window) {
    lines.push(`reset: ${snapshot.reset_window.label} at ${snapshot.reset_window.resets_at}`);
  }

  if (snapshot.error) {
    lines.push(`error: ${snapshot.error.code} - ${snapshot.error.message}`);
  }

  if (includeDiagnostics && snapshot.diagnostics) {
    lines.push("Diagnostics:");
    for (const attempt of snapshot.diagnostics.attempts) {
      const errorText = attempt.error ? ` error=${attempt.error.code}` : "";
      const duration = attempt.duration_ms === undefined ? "" : ` duration_ms=${attempt.duration_ms}`;
      lines.push(`- ${attempt.strategy} available=${attempt.available}${duration}${errorText}`);
    }
  }

  return lines.join("\n");
}

export function formatSnapshotAsText(
  envelope: SnapshotEnvelope,
  options: TextFormatterOptions = {},
): string {
  const includeDiagnostics = options.includeDiagnostics ?? false;
  const sections = envelope.providers.map((provider) => formatProvider(provider, includeDiagnostics));
  return sections.join("\n\n");
}

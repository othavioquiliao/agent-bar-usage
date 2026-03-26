import type { DiagnosticsReport } from "shared-contract";

function statusPrefix(status: string): string {
  switch (status) {
    case "ok":
      return "[ok]";
    case "warn":
      return "[!!]";
    default:
      return "[FAIL]";
  }
}

export function formatDoctorAsText(report: DiagnosticsReport): string {
  const lines: string[] = ["Agent Bar Doctor", ""];

  for (const check of report.checks) {
    lines.push(`  ${statusPrefix(check.status)} ${check.label}: ${check.message}`);
    if (check.status !== "ok" && check.suggested_command) {
      lines.push(`       -> ${check.suggested_command}`);
    }
  }

  lines.push("");
  lines.push(`Mode: ${report.runtime_mode}`);
  return lines.join("\n");
}

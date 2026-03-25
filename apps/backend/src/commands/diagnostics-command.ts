import type { Command } from "commander";
import {
  diagnosticsReportSchema,
  type DiagnosticsCheck,
  type DiagnosticsCheckId,
  type DiagnosticsReport,
} from "shared-contract";

export interface DoctorCommandOptions {
  json?: boolean;
  pretty?: boolean;
}

export interface DoctorCommandDependencies {
  buildReport?: () => Promise<DiagnosticsReport> | DiagnosticsReport;
  now?: () => Date;
}

const defaultChecks: Array<Pick<DiagnosticsCheck, "id" | "label" | "suggested_command">> = [
  {
    id: "config",
    label: "Config",
    suggested_command: "agent-bar config validate",
  },
  {
    id: "secret-tool",
    label: "secret-tool",
    suggested_command: "which secret-tool",
  },
  {
    id: "codex-cli",
    label: "Codex CLI",
    suggested_command: "codex --version",
  },
  {
    id: "claude-cli",
    label: "Claude CLI",
    suggested_command: "claude --version",
  },
  {
    id: "copilot-token",
    label: "Copilot token",
    suggested_command: "agent-bar config validate",
  },
  {
    id: "service-runtime",
    label: "Service runtime",
    suggested_command: "agent-bar service status --json",
  },
];

function defaultMessageForCheck(checkId: DiagnosticsCheckId): string {
  switch (checkId) {
    case "config":
      return "Configuration diagnostics are available through the backend doctor command.";
    case "secret-tool":
      return "Secret store availability will be inspected by the backend diagnostics helpers.";
    case "codex-cli":
      return "Codex CLI availability will be inspected by the backend diagnostics helpers.";
    case "claude-cli":
      return "Claude CLI availability will be inspected by the backend diagnostics helpers.";
    case "copilot-token":
      return "Copilot token sources will be inspected by the backend diagnostics helpers.";
    case "service-runtime":
      return "Runtime mode will be reported by backend diagnostics helpers.";
    default:
      return "Diagnostics check is defined but not yet inspected.";
  }
}

function createDefaultDoctorReport(now: Date): DiagnosticsReport {
  return {
    generated_at: now.toISOString(),
    runtime_mode: "cli",
    checks: defaultChecks.map((check) => ({
      ...check,
      status: "warn",
      message: defaultMessageForCheck(check.id),
    })),
  };
}

function formatDoctorRow(check: DiagnosticsCheck): string {
  const status = check.status.toUpperCase().padEnd(5, " ");
  return `${status} ${check.label}: ${check.message}\n  Suggested command: ${check.suggested_command}`;
}

export function formatDoctorReportAsText(report: DiagnosticsReport): string {
  const lines = [
    "Agent Bar Diagnostics",
    `Generated: ${report.generated_at}`,
    `Runtime mode: ${report.runtime_mode}`,
    "",
  ];

  for (const check of report.checks) {
    lines.push(formatDoctorRow(check));
    if (check.details && Object.keys(check.details).length > 0) {
      lines.push(`  Details: ${JSON.stringify(check.details)}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export async function runDoctorCommand(
  options: DoctorCommandOptions = {},
  dependencies: DoctorCommandDependencies = {},
): Promise<string> {
  const now = dependencies.now?.() ?? new Date();
  const report = diagnosticsReportSchema.parse(
    await (dependencies.buildReport?.() ?? createDefaultDoctorReport(now)),
  );

  if (options.json) {
    return JSON.stringify(report, null, options.pretty ? 2 : 0);
  }

  return formatDoctorReportAsText(report);
}

export function registerDoctorCommand(program: Command, dependencies: DoctorCommandDependencies = {}): void {
  program
    .command("doctor")
    .description("Inspect backend prerequisites and runtime diagnostics.")
    .option("--json", "Emit machine-readable JSON")
    .option("--pretty", "Pretty-print JSON output")
    .action(async (options: DoctorCommandOptions) => {
      const output = await runDoctorCommand(options, dependencies);
      process.stdout.write(`${output}\n`);
    });
}

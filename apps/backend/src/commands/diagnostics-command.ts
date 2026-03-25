import type { Command } from "commander";
import {
  diagnosticsReportSchema,
  type DiagnosticsCheck,
  type DiagnosticsReport,
} from "shared-contract";

import { buildDiagnosticsReport } from "../core/prerequisite-checks.js";

export interface DoctorCommandOptions {
  json?: boolean;
  pretty?: boolean;
}

export interface DoctorCommandDependencies {
  buildReport?: () => Promise<DiagnosticsReport> | DiagnosticsReport;
  now?: () => Date;
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
  const report = diagnosticsReportSchema.parse(
    await (dependencies.buildReport?.() ?? buildDiagnosticsReport()),
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

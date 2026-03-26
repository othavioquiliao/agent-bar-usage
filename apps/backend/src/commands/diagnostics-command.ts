import type { Command } from "commander";
import {
  diagnosticsReportSchema,
  type DiagnosticsReport,
} from "shared-contract";

import { buildDiagnosticsReport } from "../core/prerequisite-checks.js";
import { formatDoctorAsText } from "../formatters/doctor-text-formatter.js";

export interface DoctorCommandOptions {
  json?: boolean;
  pretty?: boolean;
}

export interface DoctorCommandDependencies {
  buildReport?: () => Promise<DiagnosticsReport> | DiagnosticsReport;
  now?: () => Date;
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

  return formatDoctorAsText(report);
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

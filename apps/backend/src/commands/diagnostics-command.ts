import { assertDiagnosticsReport, type DiagnosticsReport } from 'shared-contract';

import { buildDiagnosticsReport } from '../core/prerequisite-checks.js';
import { formatDoctorAsText } from '../formatters/doctor-text-formatter.js';
import { presentDoctorReport } from '../formatters/doctor-tui-presenter.js';

export interface DoctorCommandOptions {
  json?: boolean;
  pretty?: boolean;
}

export interface DoctorCommandDependencies {
  buildReport?: () => Promise<DiagnosticsReport> | DiagnosticsReport;
  now?: () => Date;
  isInteractiveTerminalFn?: () => boolean;
  presentDoctorReportFn?: typeof presentDoctorReport;
}

export async function runDoctorCommand(
  options: DoctorCommandOptions = {},
  dependencies: DoctorCommandDependencies = {},
): Promise<string> {
  const report = assertDiagnosticsReport(await (dependencies.buildReport?.() ?? buildDiagnosticsReport()));

  if (options.json) {
    return JSON.stringify(report, null, options.pretty ? 2 : 0);
  }

  const isInteractiveTerminal =
    dependencies.isInteractiveTerminalFn ?? (() => Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY));
  if (isInteractiveTerminal()) {
    await (dependencies.presentDoctorReportFn ?? presentDoctorReport)(report);
    return '';
  }

  return formatDoctorAsText(report);
}

import * as p from '@clack/prompts';
import type { DiagnosticsCheck, DiagnosticsReport } from 'shared-contract';

export interface DoctorTuiPresenterDependencies {
  intro?: (message: string) => void;
  note?: (message: string, title?: string) => void;
  outro?: (message: string) => void;
  spinnerFactory?: () => {
    start: (message: string) => void;
    stop: (message: string) => void;
  };
  log?: {
    success: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
}

function formatCheckMessage(check: DiagnosticsCheck): string {
  return `${check.label}: ${check.message}`;
}

export async function presentDoctorReport(
  report: DiagnosticsReport,
  dependencies: DoctorTuiPresenterDependencies = {},
): Promise<void> {
  const intro = dependencies.intro ?? p.intro;
  const note = dependencies.note ?? p.note;
  const outro = dependencies.outro ?? p.outro;
  const spinnerFactory = dependencies.spinnerFactory ?? (() => p.spinner());
  const log = dependencies.log ?? p.log;
  const nextSteps = report.checks
    .filter((check) => check.status !== 'ok' && check.suggested_command)
    .map((check) => `- ${check.label}: ${check.suggested_command}`);

  intro('Agent Bar Doctor');

  for (const check of report.checks) {
    const spinner = spinnerFactory();
    spinner.start(`Checking ${check.label}...`);
    spinner.stop(check.label);

    switch (check.status) {
      case 'ok':
        log.success(formatCheckMessage(check));
        break;
      case 'warn':
        log.warn(formatCheckMessage(check));
        break;
      default:
        log.error(formatCheckMessage(check));
        break;
    }
  }

  if (nextSteps.length > 0) {
    note(nextSteps.join('\n'), 'Suggested Fixes');
  } else {
    note('All prerequisite checks passed.', 'Suggested Fixes');
  }

  outro(`Mode: ${report.runtime_mode}`);
}

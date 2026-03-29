import type { DiagnosticsReport } from 'shared-contract';
import { describe, expect, it, vi } from 'vitest';

import { runDoctorCommand } from '../src/commands/diagnostics-command.js';
import { presentDoctorReport } from '../src/formatters/doctor-tui-presenter.js';

describe('doctor command', () => {
  it('uses the interactive presenter in TTY mode', async () => {
    const report = createReport();
    const presentDoctorReportFn = vi.fn(async () => {});

    const output = await runDoctorCommand(
      {},
      {
        buildReport: () => report,
        isInteractiveTerminalFn: () => true,
        presentDoctorReportFn,
      },
    );

    expect(output).toBe('');
    expect(presentDoctorReportFn).toHaveBeenCalledWith(report);
  });

  it('falls back to plain text when not interactive', async () => {
    const output = await runDoctorCommand(
      {},
      {
        buildReport: () => createReport(),
        isInteractiveTerminalFn: () => false,
      },
    );

    expect(output).toContain('Agent Bar Doctor');
    expect(output).toContain('[ok] Config');
  });
});

describe('doctor tui presenter', () => {
  it('emits spinner, log, note, and outro calls for mixed report states', async () => {
    const events: string[] = [];

    await presentDoctorReport(createReport(), {
      intro: (message) => {
        events.push(`intro:${message}`);
      },
      note: (message, title) => {
        events.push(`note:${title}:${message}`);
      },
      outro: (message) => {
        events.push(`outro:${message}`);
      },
      spinnerFactory: () => ({
        start: (message) => {
          events.push(`spinner:start:${message}`);
        },
        stop: (message) => {
          events.push(`spinner:stop:${message}`);
        },
      }),
      log: {
        success: (message) => {
          events.push(`success:${message}`);
        },
        warn: (message) => {
          events.push(`warn:${message}`);
        },
        error: (message) => {
          events.push(`error:${message}`);
        },
      },
    });

    expect(events).toContain('intro:Agent Bar Doctor');
    expect(events).toContain('spinner:start:Checking Config...');
    expect(events).toContain('success:Config: Config file loaded.');
    expect(events).toContain('warn:Copilot token: Copilot token source is not configured.');
    expect(events).toContain('error:Codex CLI: Codex CLI is missing from PATH.');
    expect(events.some((event) => event.startsWith('note:Suggested Fixes:'))).toBe(true);
    expect(events).toContain('outro:Mode: cli');
  });
});

function createReport(): DiagnosticsReport {
  return {
    generated_at: '2026-03-25T17:10:00.000Z',
    runtime_mode: 'cli',
    checks: [
      {
        id: 'config',
        label: 'Config',
        status: 'ok',
        message: 'Config file loaded.',
        suggested_command: 'agent-bar config validate',
      },
      {
        id: 'copilot-token',
        label: 'Copilot token',
        status: 'warn',
        message: 'Copilot token source is not configured.',
        suggested_command: 'agent-bar auth copilot',
      },
      {
        id: 'codex-cli',
        label: 'Codex CLI',
        status: 'error',
        message: 'Codex CLI is missing from PATH.',
        suggested_command: 'npm install -g @openai/codex',
      },
    ],
  };
}

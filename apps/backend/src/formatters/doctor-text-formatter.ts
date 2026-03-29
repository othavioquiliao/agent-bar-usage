import type { DiagnosticsReport } from 'shared-contract';

function statusPrefix(status: string): string {
  switch (status) {
    case 'ok':
      return '[ok]';
    case 'warn':
      return '[!!]';
    default:
      return '[FAIL]';
  }
}

export function formatDoctorAsText(report: DiagnosticsReport): string {
  const lines: string[] = ['Agent Bar Doctor', ''];

  for (const check of report.checks) {
    lines.push(`  ${statusPrefix(check.status)} ${check.label}: ${check.message}`);
    if (check.status !== 'ok' && check.suggested_command) {
      lines.push(`       -> ${check.suggested_command}`);
    }
    if (check.id === 'copilot-token' && check.status !== 'ok') {
      lines.push('');
      lines.push('       Como configurar:');
      lines.push('       1. Abra https://github.com/settings/tokens?type=beta');
      lines.push('       2. Crie um token pessoal');
      lines.push('       3. Rode: agent-bar auth copilot --token ghp_SEU_TOKEN');
      lines.push('');
    }
  }

  lines.push('');
  lines.push(`Mode: ${report.runtime_mode}`);
  return lines.join('\n');
}

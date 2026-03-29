import type { ProviderSnapshot, SnapshotEnvelope } from 'shared-contract';

import { colorize, PROVIDER_ACCENTS, TERMINAL_THEME } from './terminal-theme.js';
import { formatRelativeAbsoluteTimestamp, formatResetWindowText } from './time-formatters.js';

export interface TerminalSnapshotFormatterOptions {
  now?: Date;
}

function formatProviderTitle(providerId: string): string {
  if (!providerId) {
    return 'Provider';
  }

  return providerId.charAt(0).toUpperCase() + providerId.slice(1);
}

function getStatusColor(snapshot: ProviderSnapshot): string {
  switch (snapshot.status) {
    case 'ok':
      return TERMINAL_THEME.green;
    case 'degraded':
      return TERMINAL_THEME.yellow;
    case 'error':
      return TERMINAL_THEME.red;
    default:
      return TERMINAL_THEME.comment;
  }
}

function getAccentColor(providerId: string): string {
  return PROVIDER_ACCENTS[providerId] ?? TERMINAL_THEME.magenta;
}

function clampPercent(percent: number | null | undefined): number | null {
  if (typeof percent !== 'number' || !Number.isFinite(percent)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(percent)));
}

function buildProgressBar(percent: number | null): string {
  const totalBars = 20;
  if (percent === null) {
    return colorize('░'.repeat(totalBars), TERMINAL_THEME.comment);
  }

  const filledBars = Math.round((percent / 100) * totalBars);
  const emptyBars = totalBars - filledBars;
  const color =
    percent >= 90
      ? TERMINAL_THEME.red
      : percent >= 70
        ? TERMINAL_THEME.yellow
        : percent >= 40
          ? TERMINAL_THEME.cyan
          : TERMINAL_THEME.green;

  return `${colorize('█'.repeat(filledBars), color)}${colorize('░'.repeat(emptyBars), TERMINAL_THEME.comment)}`;
}

function pushLine(lines: string[], label: string, value: string | null): void {
  if (!value) {
    return;
  }

  lines.push(`${colorize('│', TERMINAL_THEME.comment)} ${colorize(label.padEnd(8), TERMINAL_THEME.comment)} ${value}`);
}

function formatUsageLine(snapshot: ProviderSnapshot): string {
  if (!snapshot.usage) {
    return colorize('Usage unavailable', TERMINAL_THEME.comment);
  }

  const used = snapshot.usage.used ?? '?';
  const limit = snapshot.usage.limit ?? '?';
  const percent = clampPercent(snapshot.usage.percent_used);
  const percentText = percent === null ? '--%' : `${percent}%`;

  return `${colorize(`${used}/${limit}`, TERMINAL_THEME.textBright, { bold: true })} ${colorize(`(${percentText})`, getStatusColor(snapshot))}`;
}

function formatBarLine(snapshot: ProviderSnapshot): string {
  return `${buildProgressBar(clampPercent(snapshot.usage?.percent_used))} ${colorize(
    `${clampPercent(snapshot.usage?.percent_used) ?? '--'}%`.padStart(4),
    getStatusColor(snapshot),
    { bold: true },
  )}`;
}

function formatStatusLine(snapshot: ProviderSnapshot): string {
  return colorize(snapshot.status, getStatusColor(snapshot), { bold: true });
}

function formatSourceLine(snapshot: ProviderSnapshot): string {
  return colorize(snapshot.source, TERMINAL_THEME.cyan);
}

function formatUpdatedLine(snapshot: ProviderSnapshot, now: Date): string {
  return colorize(
    formatRelativeAbsoluteTimestamp(snapshot.updated_at, { now }) ?? snapshot.updated_at,
    TERMINAL_THEME.text,
  );
}

function formatResetLine(snapshot: ProviderSnapshot, now: Date): string | null {
  const resetText = formatResetWindowText(snapshot.reset_window, { now });
  return resetText ? colorize(resetText, TERMINAL_THEME.text) : null;
}

function formatErrorLine(snapshot: ProviderSnapshot): string | null {
  if (!snapshot.error) {
    return null;
  }

  return colorize(`${snapshot.error.code}: ${snapshot.error.message}`, TERMINAL_THEME.red);
}

function formatDiagnosticsLine(snapshot: ProviderSnapshot): string | null {
  const attempts = snapshot.diagnostics?.attempts ?? [];
  if (attempts.length === 0) {
    return null;
  }

  return colorize(`${attempts.length} diagnostic attempt${attempts.length === 1 ? '' : 's'}`, TERMINAL_THEME.comment);
}

function formatProviderCard(snapshot: ProviderSnapshot, now: Date): string {
  const title = formatProviderTitle(snapshot.provider);
  const accent = getAccentColor(snapshot.provider);
  const border = colorize('─'.repeat(Math.max(12, 38 - title.length)), accent);
  const lines: string[] = [
    `${colorize('┌─', accent)} ${colorize(title, accent, { bold: true })} ${border}`,
    `${colorize('│', TERMINAL_THEME.comment)} ${formatBarLine(snapshot)}`,
  ];

  pushLine(lines, 'Usage', formatUsageLine(snapshot));
  pushLine(lines, 'Status', formatStatusLine(snapshot));
  pushLine(lines, 'Source', formatSourceLine(snapshot));
  pushLine(lines, 'Updated', formatUpdatedLine(snapshot, now));
  pushLine(lines, 'Reset', formatResetLine(snapshot, now));
  pushLine(lines, 'Error', formatErrorLine(snapshot));
  pushLine(lines, 'Diag', formatDiagnosticsLine(snapshot));
  lines.push(colorize('└────────────────────────────────────────', accent));

  return lines.join('\n');
}

export function formatSnapshotAsTerminal(
  envelope: SnapshotEnvelope,
  options: TerminalSnapshotFormatterOptions = {},
): string {
  const now = options.now ?? new Date();

  if (envelope.providers.length === 0) {
    return colorize('No provider snapshots yet', TERMINAL_THEME.comment);
  }

  return envelope.providers.map((snapshot) => formatProviderCard(snapshot, now)).join('\n\n');
}

import type { ResetWindow, UsageSnapshot } from 'shared-contract';

import { normalizeLineEndings, stripAnsi } from '../shared/interactive-command.js';

export class CodexCliParseError extends Error {
  constructor(
    readonly code: 'codex_output_empty' | 'codex_update_required' | 'codex_parse_failed',
    message: string,
  ) {
    super(message);
    this.name = 'CodexCliParseError';
  }
}

export interface CodexCliUsage {
  credits: number | null;
  fiveHourPercentLeft: number | null;
  weeklyPercentLeft: number | null;
  fiveHourResetWindow: ResetWindow | null;
  weeklyResetWindow: ResetWindow | null;
  rawText: string;
}

export function parseCodexUsage(text: string, now = new Date()): CodexCliUsage {
  const clean = stripAnsi(normalizeLineEndings(text)).trim();
  if (!clean) {
    throw new CodexCliParseError('codex_output_empty', 'Codex CLI returned no output.');
  }

  const lower = clean.toLowerCase();
  if (lower.includes('update available') && lower.includes('codex')) {
    throw new CodexCliParseError(
      'codex_update_required',
      'Codex CLI is showing an update prompt instead of usage output.',
    );
  }

  const credits = parseCredits(clean);
  const fiveHourLine = firstMatchingLine(clean, /5h limit/i);
  const weeklyLine = firstMatchingLine(clean, /weekly limit/i);
  const fiveHourPercentLeft = parsePercentLeft(fiveHourLine);
  const weeklyPercentLeft = parsePercentLeft(weeklyLine);
  const fiveHourResetWindow = fiveHourLine ? parseResetWindow(fiveHourLine, '5h limit', now) : null;
  const weeklyResetWindow = weeklyLine ? parseResetWindow(weeklyLine, 'weekly limit', now) : null;

  if (credits == null && fiveHourPercentLeft == null && weeklyPercentLeft == null) {
    throw new CodexCliParseError(
      'codex_parse_failed',
      `Could not locate Codex usage fields in output: ${clean.slice(0, 240)}`,
    );
  }

  return {
    credits,
    fiveHourPercentLeft,
    weeklyPercentLeft,
    fiveHourResetWindow,
    weeklyResetWindow,
    rawText: clean,
  };
}

export function mapCodexUsageToSnapshot(parsed: CodexCliUsage): {
  usage: UsageSnapshot;
  resetWindow: ResetWindow | null;
} | null {
  if (parsed.fiveHourPercentLeft != null) {
    const used = clampPercent(100 - parsed.fiveHourPercentLeft);
    return {
      usage: {
        kind: 'quota',
        used,
        limit: 100,
        percent_used: used,
      },
      resetWindow: parsed.fiveHourResetWindow,
    };
  }

  if (parsed.weeklyPercentLeft != null) {
    const used = clampPercent(100 - parsed.weeklyPercentLeft);
    return {
      usage: {
        kind: 'quota',
        used,
        limit: 100,
        percent_used: used,
      },
      resetWindow: parsed.weeklyResetWindow,
    };
  }

  if (parsed.credits != null) {
    return {
      usage: {
        kind: 'quota',
        used: parsed.credits,
        limit: null,
        percent_used: null,
      },
      resetWindow: null,
    };
  }

  return null;
}

function parseCredits(text: string): number | null {
  const match = text.match(/Credits:\s*([0-9][0-9.,]*)/i);
  if (!match?.[1]) {
    return null;
  }

  const normalized = match[1].replaceAll(',', '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstMatchingLine(text: string, pattern: RegExp): string | null {
  for (const line of text.split('\n')) {
    if (pattern.test(line)) {
      return line.trim();
    }
  }

  return null;
}

function parsePercentLeft(line: string | null): number | null {
  if (!line) {
    return null;
  }

  const match = line.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
  if (!match?.[1]) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? clampPercent(parsed) : null;
}

function parseResetWindow(line: string, label: string, now: Date): ResetWindow | null {
  const candidate =
    line.match(/\(([^)]+)\)/)?.[1]?.trim() ?? line.match(/(?:reset(?:s)?(?: at| on)?\s*)(.+)$/i)?.[1]?.trim() ?? null;

  if (!candidate) {
    return null;
  }

  const resetsAt = parseResetDatetime(candidate, now);
  if (!resetsAt) {
    return null;
  }

  return {
    resets_at: resetsAt,
    label,
  };
}

function parseResetDatetime(raw: string, now: Date): string | null {
  let value = raw.trim().replaceAll(/^[()]+|[()]+$/g, '');
  value = value.replaceAll(/\s+/g, ' ').trim();
  value = value.replace(/^(?:resets?|reset)(?: at| on)?\s+/i, '').trim();
  if (!value) {
    return null;
  }

  const direct = Date.parse(value);
  if (Number.isFinite(direct)) {
    return new Date(direct).toISOString();
  }

  const calendar = new Intl.DateTimeFormat('en-US', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    hour12: false,
  });
  void calendar;

  const withDayMonth = value.match(/^(\d{1,2}:\d{2}) on (\d{1,2} [A-Za-z]{3})$/);
  if (withDayMonth?.[1] && withDayMonth[2]) {
    const [time, dayMonth] = [withDayMonth[1], withDayMonth[2]];
    const parsed = parseWithFormat(`${dayMonth} ${time}`, ['d MMM HH:mm', 'd MMM H:mm'], now);
    if (parsed) {
      return parsed;
    }
  }

  const withMonthDay = value.match(/^(\d{1,2}:\d{2}) on ([A-Za-z]{3} \d{1,2})$/);
  if (withMonthDay?.[1] && withMonthDay[2]) {
    const [time, monthDay] = [withMonthDay[1], withMonthDay[2]];
    const parsed = parseWithFormat(`${monthDay} ${time}`, ['MMM d HH:mm', 'MMM d H:mm'], now);
    if (parsed) {
      return parsed;
    }
  }

  const timeOnly = value.match(/^(\d{1,2}:\d{2})$/);
  if (timeOnly?.[1]) {
    const parsed = parseTimeOnly(timeOnly[1], now);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function parseWithFormat(value: string, formats: string[], now: Date): string | null {
  for (const format of formats) {
    const parsed = parseDateWithFormat(value, format, now);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function parseDateWithFormat(value: string, format: string, now: Date): string | null {
  const [datePart, timePart] = value.split(/\s+(?=\d{1,2}:\d{2}$)/);
  if (!datePart || !timePart) {
    return null;
  }

  const timeMatch = timePart.match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) {
    return null;
  }

  const time = {
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
  };
  if (!Number.isFinite(time.hour) || !Number.isFinite(time.minute)) {
    return null;
  }

  const monthMap = new Map([
    ['Jan', 0],
    ['Feb', 1],
    ['Mar', 2],
    ['Apr', 3],
    ['May', 4],
    ['Jun', 5],
    ['Jul', 6],
    ['Aug', 7],
    ['Sep', 8],
    ['Oct', 9],
    ['Nov', 10],
    ['Dec', 11],
  ]);

  const dayMonthMatch = format.startsWith('d MMM')
    ? value.match(/^(\d{1,2}) ([A-Za-z]{3}) \d{1,2}:\d{2}$/)
    : value.match(/^([A-Za-z]{3}) (\d{1,2}) \d{1,2}:\d{2}$/);
  if (!dayMonthMatch) {
    return null;
  }

  const monthIndex = format.startsWith('d MMM') ? monthMap.get(dayMonthMatch[2]) : monthMap.get(dayMonthMatch[1]);
  const day = Number(format.startsWith('d MMM') ? dayMonthMatch[1] : dayMonthMatch[2]);
  if (monthIndex == null || !Number.isFinite(day)) {
    return null;
  }

  const candidate = new Date(now);
  candidate.setMonth(monthIndex, day);
  candidate.setHours(time.hour, time.minute, 0, 0);
  if (candidate.getTime() < now.getTime()) {
    candidate.setFullYear(candidate.getFullYear() + 1);
  }
  return candidate.toISOString();
}

function parseTimeOnly(value: string, now: Date): string | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  const candidate = new Date(now);
  candidate.setHours(hour, minute, 0, 0);
  if (candidate.getTime() < now.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate.toISOString();
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

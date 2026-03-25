import type { ResetWindow, UsageSnapshot } from "shared-contract";

import { normalizeLineEndings, stripAnsi } from "../shared/interactive-command.js";

export class ClaudeCliParseError extends Error {
  constructor(
    readonly code: "claude_output_empty" | "claude_parse_failed",
    message: string,
  ) {
    super(message);
    this.name = "ClaudeCliParseError";
  }
}

export interface ClaudeCliUsage {
  sessionPercentLeft: number | null;
  weeklyPercentLeft: number | null;
  opusPercentLeft: number | null;
  sessionResetWindow: ResetWindow | null;
  weeklyResetWindow: ResetWindow | null;
  opusResetWindow: ResetWindow | null;
  rawText: string;
}

export function parseClaudeUsage(text: string, now = new Date()): ClaudeCliUsage {
  const clean = stripAnsi(normalizeLineEndings(text)).trim();
  if (!clean) {
    throw new ClaudeCliParseError("claude_output_empty", "Claude CLI returned no output.");
  }

  const sessionLine = firstMatchingLine(clean, /current session/i);
  const weeklyLine = firstMatchingLine(clean, /current week(?!.*opus)(?!.*sonnet)/i);
  const opusLine = firstMatchingLine(clean, /current week \(opus\)|current week \(sonnet only\)|current week \(sonnet\)/i);

  const sessionPercentLeft = parsePercentLeft(sessionLine);
  const weeklyPercentLeft = parsePercentLeft(weeklyLine);
  const opusPercentLeft = parsePercentLeft(opusLine);

  if (sessionPercentLeft == null && weeklyPercentLeft == null && opusPercentLeft == null) {
    throw new ClaudeCliParseError(
      "claude_parse_failed",
      `Could not locate Claude usage fields in output: ${clean.slice(0, 240)}`,
    );
  }

  return {
    sessionPercentLeft,
    weeklyPercentLeft,
    opusPercentLeft,
    sessionResetWindow: sessionLine ? parseResetWindow(sessionLine, "Current session", now) : null,
    weeklyResetWindow: weeklyLine ? parseResetWindow(weeklyLine, "Current week", now) : null,
    opusResetWindow: opusLine ? parseResetWindow(opusLine, "Opus", now) : null,
    rawText: clean,
  };
}

export function mapClaudeUsageToSnapshot(parsed: ClaudeCliUsage): {
  usage: UsageSnapshot;
  resetWindow: ResetWindow | null;
} | null {
  if (parsed.sessionPercentLeft != null) {
    const used = clampPercent(100 - parsed.sessionPercentLeft);
    return {
      usage: {
        kind: "quota",
        used,
        limit: 100,
        percent_used: used,
      },
      resetWindow: parsed.sessionResetWindow,
    };
  }

  if (parsed.weeklyPercentLeft != null) {
    const used = clampPercent(100 - parsed.weeklyPercentLeft);
    return {
      usage: {
        kind: "quota",
        used,
        limit: 100,
        percent_used: used,
      },
      resetWindow: parsed.weeklyResetWindow,
    };
  }

  if (parsed.opusPercentLeft != null) {
    const used = clampPercent(100 - parsed.opusPercentLeft);
    return {
      usage: {
        kind: "quota",
        used,
        limit: 100,
        percent_used: used,
      },
      resetWindow: parsed.opusResetWindow,
    };
  }

  return null;
}

function firstMatchingLine(text: string, pattern: RegExp): string | null {
  for (const line of text.split("\n")) {
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
    line.match(/\(([^)]+)\)/)?.[1]?.trim() ??
    line.match(/(?:reset(?:s)?(?: at| on)?\s*)(.+)$/i)?.[1]?.trim() ??
    null;

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
  let value = raw.trim().replaceAll(/^[()]+|[()]+$/g, "");
  value = value.replaceAll(/\s+/g, " ").trim();
  value = value.replace(/^(?:resets?|reset)(?: at| on)?\s+/i, "").trim();
  if (!value) {
    return null;
  }

  const direct = Date.parse(value);
  if (Number.isFinite(direct)) {
    return new Date(direct).toISOString();
  }

  const withDayMonth = value.match(/^(\d{1,2}:\d{2}) on (\d{1,2} [A-Za-z]{3})$/);
  if (withDayMonth?.[1] && withDayMonth[2]) {
    const parsed = parseDateWithParts(withDayMonth[2], withDayMonth[1], true, now);
    if (parsed) {
      return parsed;
    }
  }

  const withMonthDay = value.match(/^(\d{1,2}:\d{2}) on ([A-Za-z]{3} \d{1,2})$/);
  if (withMonthDay?.[1] && withMonthDay[2]) {
    const parsed = parseDateWithParts(withMonthDay[2], withMonthDay[1], false, now);
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

function parseDateWithParts(datePart: string, timePart: string, dayMonth: boolean, now: Date): string | null {
  const timeMatch = timePart.match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) {
    return null;
  }

  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  const monthMap = new Map([
    ["Jan", 0],
    ["Feb", 1],
    ["Mar", 2],
    ["Apr", 3],
    ["May", 4],
    ["Jun", 5],
    ["Jul", 6],
    ["Aug", 7],
    ["Sep", 8],
    ["Oct", 9],
    ["Nov", 10],
    ["Dec", 11],
  ]);

  const match = dayMonth
    ? datePart.match(/^(\d{1,2}) ([A-Za-z]{3})$/)
    : datePart.match(/^([A-Za-z]{3}) (\d{1,2})$/);
  if (!match) {
    return null;
  }

  const monthIndex = dayMonth ? monthMap.get(match[2]) : monthMap.get(match[1]);
  const day = Number(dayMonth ? match[1] : match[2]);
  if (monthIndex == null || !Number.isFinite(day)) {
    return null;
  }

  const candidate = new Date(now);
  candidate.setMonth(monthIndex, day);
  candidate.setHours(hour, minute, 0, 0);
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

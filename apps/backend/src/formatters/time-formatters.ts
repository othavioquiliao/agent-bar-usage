import type { ResetWindow } from 'shared-contract';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

interface TimeFormatterOptions {
  now?: Date;
}

function parseTimestamp(value: Date | string | null | undefined): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function shouldSuppressResetLabel(label: string): boolean {
  return /^(?:resets?\b|today\b|tomorrow\b|yesterday\b|soon\b|in\b)/i.test(label.trim());
}

export function formatAbsoluteTimestamp(value: Date | string | null | undefined): string | null {
  const timestamp = parseTimestamp(value);
  if (!timestamp) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(timestamp);
  } catch {
    return timestamp.toLocaleString();
  }
}

export function formatRelativeTimestamp(
  value: Date | string | null | undefined,
  { now = new Date() }: TimeFormatterOptions = {},
): string | null {
  const timestamp = parseTimestamp(value);
  if (!timestamp) {
    return null;
  }

  const current = now instanceof Date ? now : new Date(now);
  const diff = timestamp.getTime() - current.getTime();
  const absDiff = Math.abs(diff);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', YEAR_MS],
    ['month', MONTH_MS],
    ['day', DAY_MS],
    ['hour', HOUR_MS],
    ['minute', MINUTE_MS],
    ['second', 1_000],
  ];
  const [unit, unitMs] = units.find(([, unitSize]) => absDiff >= unitSize) ?? units[units.length - 1];
  const numericValue = Math.round(diff / unitMs);

  try {
    return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(numericValue, unit);
  } catch {
    const absolute = formatAbsoluteTimestamp(timestamp);
    if (!absolute) {
      return null;
    }
    return diff >= 0 ? `in ${absolute}` : `${absolute} ago`;
  }
}

export function formatRelativeAbsoluteTimestamp(
  value: Date | string | null | undefined,
  options: TimeFormatterOptions = {},
): string | null {
  const relative = formatRelativeTimestamp(value, options);
  const absolute = formatAbsoluteTimestamp(value);

  if (relative && absolute) {
    return `${relative} (${absolute})`;
  }

  return relative ?? absolute;
}

export function formatResetWindowText(
  resetWindow: ResetWindow | null | undefined,
  options: TimeFormatterOptions = {},
): string | null {
  if (!resetWindow) {
    return null;
  }

  const timestampText = formatRelativeAbsoluteTimestamp(resetWindow.resets_at, options);
  if (!timestampText) {
    return resetWindow.label ?? null;
  }

  const label = String(resetWindow.label ?? '').trim();
  if (!label || shouldSuppressResetLabel(label)) {
    return timestampText;
  }

  return `${label}: ${timestampText}`;
}

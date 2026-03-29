const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

function parseTimestamp(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatAbsoluteDate(date) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function formatRelativeTimestamp(value, now = new Date()) {
  const timestamp = parseTimestamp(value);

  if (!timestamp) {
    return null;
  }

  const current = now instanceof Date ? now : new Date(now);
  const diff = timestamp.getTime() - current.getTime();
  const absDiff = Math.abs(diff);
  const units = [
    ['year', YEAR_MS],
    ['month', MONTH_MS],
    ['day', DAY_MS],
    ['hour', HOUR_MS],
    ['minute', MINUTE_MS],
    ['second', 1000],
  ];
  const [unit, unitMs] = units.find(([, unitSize]) => absDiff >= unitSize) ?? units[units.length - 1];
  const numericValue = Math.round(diff / unitMs);

  try {
    return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(numericValue, unit);
  } catch {
    const absolute = formatAbsoluteDate(timestamp);
    return diff >= 0 ? `in ${absolute}` : `${absolute} ago`;
  }
}

export function formatTimestampLabel(value, { prefix = 'Updated', now = new Date() } = {}) {
  const relative = formatRelativeTimestamp(value, now);

  if (!relative) {
    return `${prefix} time unavailable`;
  }

  return `${prefix} ${relative}`;
}

export function formatAbsoluteTimestamp(value) {
  const timestamp = parseTimestamp(value);

  if (!timestamp) {
    return null;
  }

  return formatAbsoluteDate(timestamp);
}

export function formatLastUpdatedText(value, now = new Date()) {
  return formatTimestampLabel(value, { prefix: 'Last updated', now });
}

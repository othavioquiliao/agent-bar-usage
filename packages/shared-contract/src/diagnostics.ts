export const DIAGNOSTICS_CHECK_IDS = [
  'config',
  'secret-tool',
  'codex-cli',
  'claude-cli',
  'node-pty',
  'copilot-token',
  'systemd-env',
  'service-runtime',
] as const;

export type DiagnosticsCheckId = (typeof DIAGNOSTICS_CHECK_IDS)[number];

export const DIAGNOSTICS_CHECK_STATUSES = ['ok', 'warn', 'error'] as const;
export type DiagnosticsCheckStatus = (typeof DIAGNOSTICS_CHECK_STATUSES)[number];

export const DIAGNOSTICS_RUNTIME_MODES = ['cli', 'service', 'unknown'] as const;
export type DiagnosticsRuntimeMode = (typeof DIAGNOSTICS_RUNTIME_MODES)[number];

export type DiagnosticsCheckDetails = Record<string, unknown>;

export interface DiagnosticsCheck {
  id: DiagnosticsCheckId;
  label: string;
  status: DiagnosticsCheckStatus;
  message: string;
  suggested_command: string;
  details?: DiagnosticsCheckDetails;
}

export interface DiagnosticsReport {
  generated_at: string;
  runtime_mode: DiagnosticsRuntimeMode;
  checks: DiagnosticsCheck[];
}

const CHECK_ID_SET = new Set<string>(DIAGNOSTICS_CHECK_IDS);
const CHECK_STATUS_SET = new Set<string>(DIAGNOSTICS_CHECK_STATUSES);
const RUNTIME_MODE_SET = new Set<string>(DIAGNOSTICS_RUNTIME_MODES);
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
}

function assertNoExtraKeys(value: Record<string, unknown>, allowedKeys: readonly string[], label: string): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      throw new TypeError(`${label} contains unexpected field: ${key}.`);
    }
  }
}

function assertNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }

  return value;
}

function assertIsoDatetime(value: unknown, label: string): string {
  const stringValue = assertNonEmptyString(value, label);
  if (!ISO_DATETIME_PATTERN.test(stringValue)) {
    throw new TypeError(`${label} must be an ISO-8601 datetime string.`);
  }
  return stringValue;
}

export function assertDiagnosticsCheckId(value: unknown, label = 'id'): DiagnosticsCheckId {
  if (typeof value !== 'string' || !CHECK_ID_SET.has(value)) {
    throw new TypeError(`${label} must be one of: ${DIAGNOSTICS_CHECK_IDS.join(', ')}.`);
  }
  return value as DiagnosticsCheckId;
}

export function assertDiagnosticsRuntimeMode(value: unknown, label = 'runtime_mode'): DiagnosticsRuntimeMode {
  if (typeof value !== 'string' || !RUNTIME_MODE_SET.has(value)) {
    throw new TypeError(`${label} must be one of: ${DIAGNOSTICS_RUNTIME_MODES.join(', ')}.`);
  }
  return value as DiagnosticsRuntimeMode;
}

function assertDiagnosticsCheckStatus(value: unknown, label = 'status'): DiagnosticsCheckStatus {
  if (typeof value !== 'string' || !CHECK_STATUS_SET.has(value)) {
    throw new TypeError(`${label} must be one of: ${DIAGNOSTICS_CHECK_STATUSES.join(', ')}.`);
  }
  return value as DiagnosticsCheckStatus;
}

export function assertDiagnosticsCheck(value: unknown, label = 'check'): DiagnosticsCheck {
  assertRecord(value, label);
  assertNoExtraKeys(value, ['id', 'label', 'status', 'message', 'suggested_command', 'details'], label);

  const details = value.details;
  if (details !== undefined) {
    assertRecord(details, `${label}.details`);
  }

  return {
    id: assertDiagnosticsCheckId(value.id, `${label}.id`),
    label: assertNonEmptyString(value.label, `${label}.label`),
    status: assertDiagnosticsCheckStatus(value.status, `${label}.status`),
    message: assertNonEmptyString(value.message, `${label}.message`),
    suggested_command: assertNonEmptyString(value.suggested_command, `${label}.suggested_command`),
    ...(details ? { details } : {}),
  };
}

export function assertDiagnosticsReport(value: unknown): DiagnosticsReport {
  assertRecord(value, 'Diagnostics report');
  assertNoExtraKeys(value, ['generated_at', 'runtime_mode', 'checks'], 'Diagnostics report');

  if (!Array.isArray(value.checks)) {
    throw new TypeError('Diagnostics report checks must be an array.');
  }

  return {
    generated_at: assertIsoDatetime(value.generated_at, 'generated_at'),
    runtime_mode: assertDiagnosticsRuntimeMode(value.runtime_mode),
    checks: value.checks.map((check, index) => assertDiagnosticsCheck(check, `checks[${index}]`)),
  };
}

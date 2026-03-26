const DEVICE_CODE_URL = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const DEVICE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface DeviceFlowResult {
  access_token: string;
  token_type: string;
  scope: string;
}

type DeviceFlowErrorCode =
  | "device_flow_request_failed"
  | "device_flow_invalid_response"
  | "device_flow_access_denied"
  | "device_flow_expired"
  | "device_flow_poll_failed";

export class GitHubDeviceFlowError extends Error {
  constructor(
    readonly code: DeviceFlowErrorCode,
    message: string,
    readonly causeValue?: unknown,
  ) {
    super(message);
    this.name = "GitHubDeviceFlowError";
  }
}

interface DeviceFlowErrorResponse {
  error?: string;
  error_description?: string;
}

export async function requestDeviceCode(
  clientId: string,
  scope: string,
  fetchFn: typeof fetch = fetch,
): Promise<DeviceCodeResponse> {
  const normalizedClientId = normalizeRequired(clientId, "GitHub OAuth client id");
  const normalizedScope = normalizeRequired(scope, "GitHub device flow scope");

  const response = await fetchJson(fetchFn, DEVICE_CODE_URL, {
    method: "POST",
    headers: createHeaders(),
    body: new URLSearchParams({
      client_id: normalizedClientId,
      scope: normalizedScope,
    }),
  });

  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    throw new GitHubDeviceFlowError(
      "device_flow_request_failed",
      formatGitHubError("GitHub rejected the device code request", payload, response.status),
      payload,
    );
  }

  return parseDeviceCodeResponse(payload);
}

export async function pollForAccessToken(
  clientId: string,
  deviceCode: string,
  interval: number,
  expiresIn: number,
  fetchFn: typeof fetch = fetch,
): Promise<DeviceFlowResult> {
  const normalizedClientId = normalizeRequired(clientId, "GitHub OAuth client id");
  const normalizedDeviceCode = normalizeRequired(deviceCode, "GitHub device code");
  let currentIntervalSeconds = normalizePositiveInteger(interval, "GitHub polling interval");
  const deadline = Date.now() + normalizePositiveInteger(expiresIn, "GitHub device code expiry") * 1_000;

  while (Date.now() < deadline) {
    const response = await fetchJson(fetchFn, ACCESS_TOKEN_URL, {
      method: "POST",
      headers: createHeaders(),
      body: new URLSearchParams({
        client_id: normalizedClientId,
        device_code: normalizedDeviceCode,
        grant_type: DEVICE_GRANT_TYPE,
      }),
    });

    const payload = await parseResponsePayload(response);

    if ("access_token" in payload) {
      return parseAccessTokenResponse(payload);
    }

    const errorCode = typeof payload.error === "string" ? payload.error : null;

    switch (errorCode) {
      case "authorization_pending":
        await delay(currentIntervalSeconds * 1_000);
        continue;
      case "slow_down":
        currentIntervalSeconds += 5;
        await delay(currentIntervalSeconds * 1_000);
        continue;
      case "expired_token":
        throw new GitHubDeviceFlowError(
          "device_flow_expired",
          "GitHub device code expired. Run `agent-bar auth copilot` again.",
          payload,
        );
      case "access_denied":
        throw new GitHubDeviceFlowError(
          "device_flow_access_denied",
          "GitHub device authorization was denied.",
          payload,
        );
      default:
        throw new GitHubDeviceFlowError(
          "device_flow_poll_failed",
          formatGitHubError("GitHub access token polling failed", payload, response.status),
          payload,
        );
    }
  }

  throw new GitHubDeviceFlowError(
    "device_flow_expired",
    "GitHub device code expired before authorization completed. Run `agent-bar auth copilot` again.",
  );
}

function createHeaders(): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

async function fetchJson(fetchFn: typeof fetch, url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetchFn(url, init);
  } catch (error) {
    throw new GitHubDeviceFlowError(
      "device_flow_request_failed",
      `Could not reach GitHub device flow endpoint: ${url}.`,
      error,
    );
  }
}

async function parseResponsePayload(response: Response): Promise<Record<string, unknown>> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    throw new GitHubDeviceFlowError(
      "device_flow_invalid_response",
      "GitHub device flow returned a non-JSON response.",
      error,
    );
  }

  if (!isRecord(payload)) {
    throw new GitHubDeviceFlowError(
      "device_flow_invalid_response",
      "GitHub device flow response did not match the expected object shape.",
      payload,
    );
  }

  return payload;
}

function parseDeviceCodeResponse(payload: Record<string, unknown>): DeviceCodeResponse {
  const deviceCode = readString(payload.device_code, "device_code");
  const userCode = readString(payload.user_code, "user_code");
  const verificationUri = readString(payload.verification_uri, "verification_uri");
  const expiresIn = readPositiveInteger(payload.expires_in, "expires_in");
  const interval = readPositiveInteger(payload.interval ?? 5, "interval");

  return {
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: verificationUri,
    expires_in: expiresIn,
    interval,
  };
}

function parseAccessTokenResponse(payload: Record<string, unknown>): DeviceFlowResult {
  return {
    access_token: readString(payload.access_token, "access_token"),
    token_type: readString(payload.token_type, "token_type"),
    scope: readString(payload.scope ?? "", "scope", true),
  };
}

function readString(value: unknown, fieldName: string, allowEmpty = false): string {
  if (typeof value !== "string") {
    throw new GitHubDeviceFlowError(
      "device_flow_invalid_response",
      `GitHub device flow response is missing ${fieldName}.`,
      value,
    );
  }

  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) {
    throw new GitHubDeviceFlowError(
      "device_flow_invalid_response",
      `GitHub device flow response is missing ${fieldName}.`,
      value,
    );
  }

  return trimmed;
}

function readPositiveInteger(value: unknown, fieldName: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new GitHubDeviceFlowError(
      "device_flow_invalid_response",
      `GitHub device flow response has invalid ${fieldName}.`,
      value,
    );
  }

  return Number(value);
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new GitHubDeviceFlowError(
      "device_flow_request_failed",
      `${label} is required.`,
    );
  }

  return normalized;
}

function normalizePositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new GitHubDeviceFlowError(
      "device_flow_request_failed",
      `${label} must be a positive integer.`,
      value,
    );
  }

  return value;
}

function formatGitHubError(prefix: string, payload: Record<string, unknown>, status: number): string {
  const error = typeof payload.error === "string" ? payload.error : "unknown_error";
  const description = typeof payload.error_description === "string" ? payload.error_description.trim() : "";

  return description.length > 0
    ? `${prefix} (status ${status}): ${error} - ${description}`
    : `${prefix} (status ${status}): ${error}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

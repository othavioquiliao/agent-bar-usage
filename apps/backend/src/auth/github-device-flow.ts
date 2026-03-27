/**
 * GitHub Device Flow (RFC 8628 / OAuth 2.0 Device Authorization Grant)
 *
 * Step 1: requestDeviceCode  — POST /login/device/code
 * Step 2: pollForAccessToken — POST /login/oauth/access_token (poll until authorized or expired)
 *
 * Both functions accept an optional fetchFn parameter so unit tests can inject
 * a stub without hitting the network.
 */

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

/** Internal shape returned by GitHub's token endpoint while polling. */
interface TokenPollResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
  interval?: number;
}

/**
 * Step 1: Request a device code from GitHub.
 * POST https://github.com/login/device/code
 */
export async function requestDeviceCode(
  clientId: string,
  scope: string,
  fetchFn: typeof fetch = fetch,
): Promise<DeviceCodeResponse> {
  let response: Response;
  try {
    response = await fetchFn(DEVICE_CODE_URL, {
      method: "POST",
      headers: createHeaders(),
      body: buildFormBody({
        client_id: clientId,
        scope,
      }),
    });
  } catch (error) {
    throw new Error(`Could not reach GitHub device flow endpoint: ${DEVICE_CODE_URL}.`, {
      cause: error,
    });
  }

  if (!response.ok) {
    throw new Error(formatGitHubHttpError("GitHub device code request failed", response, await readJsonBody(response)));
  }

  return parseDeviceCodeResponse(await readJsonBody(response));
}

/**
 * Step 2: Poll for the access token until the user authorizes or the code expires.
 * POST https://github.com/login/oauth/access_token
 *
 * Handles GitHub-specific error codes:
 *  - authorization_pending: wait interval seconds, retry
 *  - slow_down: increase interval by 5 seconds, retry
 *  - expired_token: throw — user must restart the flow
 *  - access_denied: throw — user denied the request
 */
export async function pollForAccessToken(
  clientId: string,
  deviceCode: string,
  interval: number,
  expiresIn: number,
  fetchFn: typeof fetch = fetch,
): Promise<DeviceFlowResult> {
  const expiresAt = Date.now() + expiresIn * 1000;
  let currentInterval = interval;

  while (Date.now() < expiresAt) {
    await sleep(currentInterval * 1000);

    let response: Response;
    try {
      response = await fetchFn(ACCESS_TOKEN_URL, {
        method: "POST",
        headers: createHeaders(),
        body: buildFormBody({
          client_id: clientId,
          device_code: deviceCode,
          grant_type: DEVICE_GRANT_TYPE,
        }),
      });
    } catch (error) {
      throw new Error(`Could not reach GitHub device flow endpoint: ${ACCESS_TOKEN_URL}.`, {
        cause: error,
      });
    }

    if (!response.ok) {
      throw new Error(formatGitHubHttpError("GitHub token poll failed", response, await readJsonBody(response)));
    }

    const data = parseTokenPollResponse(await readJsonBody(response));

    if (data.access_token) {
      return {
        access_token: data.access_token,
        token_type: data.token_type ?? "bearer",
        scope: data.scope ?? "",
      };
    }

    switch (data.error) {
      case "authorization_pending":
        // Normal: user has not authorized yet — keep polling
        break;

      case "slow_down":
        // GitHub wants us to back off; it also adjusts the interval in the response
        currentInterval = (data.interval ?? currentInterval) + 5;
        break;

      case "expired_token":
      case "token_expired":
        throw new Error("Device flow code expired. Please run the command again to get a new code.");

      case "access_denied":
        throw new Error("Authorization denied. The user cancelled the GitHub authorization.");

      default:
        throw new Error(
          `GitHub token poll returned unexpected error: ${data.error ?? "unknown"} — ${data.error_description ?? ""}`,
        );
    }
  }

  throw new Error("Device flow timed out waiting for authorization. Please try again.");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createHeaders(): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

function buildFormBody(values: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    params.set(key, value);
  }
  return params;
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throw new Error("GitHub device flow returned a non-JSON response.", {
      cause: error,
    });
  }
}

function parseDeviceCodeResponse(payload: unknown): DeviceCodeResponse {
  const record = toRecord(payload);

  return {
    device_code: readRequiredString(record.device_code, "device_code"),
    user_code: readRequiredString(record.user_code, "user_code"),
    verification_uri: readRequiredString(record.verification_uri, "verification_uri"),
    expires_in: readPositiveInteger(record.expires_in, "expires_in"),
    interval: readPositiveInteger(record.interval, "interval"),
  };
}

function parseTokenPollResponse(payload: unknown): TokenPollResponse {
  return toRecord(payload) as TokenPollResponse;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error("GitHub device flow response did not match the expected object shape.");
  }

  return value as Record<string, unknown>;
}

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`GitHub device flow response is missing ${field}.`);
  }

  return value.trim();
}

function readPositiveInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`GitHub device flow response has invalid ${field}.`);
  }

  return Number(value);
}

function formatGitHubHttpError(prefix: string, response: Response, payload: unknown): string {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const description = typeof record?.error_description === "string" ? record.error_description.trim() : "";
  const errorCode = typeof record?.error === "string" ? record.error.trim() : "";
  const suffix = description || errorCode;

  return suffix
    ? `${prefix} with HTTP ${response.status}: ${suffix}`
    : `${prefix} with HTTP ${response.status}`;
}

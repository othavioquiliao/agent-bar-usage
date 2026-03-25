/**
 * GitHub Device Flow (RFC 8628 / OAuth 2.0 Device Authorization Grant)
 *
 * Step 1: requestDeviceCode  — POST /login/device/code
 * Step 2: pollForAccessToken — POST /login/oauth/access_token (poll until authorized or expired)
 *
 * Both functions accept an optional fetchFn parameter so unit tests can inject
 * a stub without hitting the network.
 */

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
  const response = await fetchFn("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ client_id: clientId, scope }),
  });

  if (!response.ok) {
    throw new Error(`GitHub device code request failed with HTTP ${response.status}`);
  }

  const data = (await response.json()) as DeviceCodeResponse;
  return data;
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

    const response = await fetchFn("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub token poll failed with HTTP ${response.status}`);
    }

    const data = (await response.json()) as TokenPollResponse;

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

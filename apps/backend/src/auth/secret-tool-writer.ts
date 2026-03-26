import {
  SubprocessError,
  describeSubprocessFailure,
  resolveCommandInPath,
  runSubprocess,
  type SubprocessOptions,
  type SubprocessResult,
} from "../utils/subprocess.js";

export interface SecretToolWriterOptions {
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  runSubprocessFn?: (
    command: string,
    args: string[],
    options?: SubprocessOptions,
  ) => Promise<SubprocessResult>;
  resolveCommandInPathFn?: (command: string, env?: NodeJS.ProcessEnv) => string | null;
}

type SecretToolWriteErrorCode = "secret_tool_unavailable" | "secret_tool_write_failed";

export class SecretToolWriteError extends Error {
  constructor(
    readonly code: SecretToolWriteErrorCode,
    message: string,
    readonly causeValue?: unknown,
  ) {
    super(message);
    this.name = "SecretToolWriteError";
  }
}

export async function storeSecretViaSecretTool(
  service: string,
  account: string,
  value: string,
  label = "Agent Bar Copilot",
  options: SecretToolWriterOptions = {},
): Promise<void> {
  const normalizedService = normalizeRequired(service, "secret-tool service");
  const normalizedAccount = normalizeRequired(account, "secret-tool account");
  const normalizedValue = normalizeRequired(value, "secret-tool value");
  const normalizedLabel = normalizeRequired(label, "secret-tool label");
  const env = options.env ?? process.env;
  const command = (options.resolveCommandInPathFn ?? resolveCommandInPath)("secret-tool", env);

  if (!command) {
    throw new SecretToolWriteError(
      "secret_tool_unavailable",
      "secret-tool is required to store Copilot credentials. Install it with `sudo apt install libsecret-tools`.",
    );
  }

  try {
    await (options.runSubprocessFn ?? runSubprocess)(
      command,
      ["store", `--label=${normalizedLabel}`, "service", normalizedService, "account", normalizedAccount],
      {
        env,
        input: normalizedValue,
        timeoutMs: options.timeoutMs ?? 10_000,
      },
    );
  } catch (error) {
    if (error instanceof SecretToolWriteError) {
      throw error;
    }

    if (error instanceof SubprocessError) {
      throw new SecretToolWriteError(
        "secret_tool_write_failed",
        describeSubprocessFailure(error),
        error,
      );
    }

    throw new SecretToolWriteError(
      "secret_tool_write_failed",
      "Could not store the Copilot token in secret-tool.",
      error,
    );
  }
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new SecretToolWriteError("secret_tool_write_failed", `${label} is required.`);
  }

  return normalized;
}

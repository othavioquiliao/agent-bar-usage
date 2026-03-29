/**
 * Writes a secret to GNOME Keyring via the `secret-tool` CLI.
 *
 * This is the write-side counterpart to SecretToolStore (which is read-only).
 * Kept separate so read-path code has no write capability surface.
 *
 * Usage:
 *   secret-tool store --label=<label> service <service> account <account>
 *   (value piped via stdin)
 */

import { runSubprocess, type SubprocessOptions, type SubprocessResult } from '../utils/subprocess.js';

export interface SecretToolWriterOptions {
  runSubprocessFn?: (command: string, args: string[], options?: SubprocessOptions) => Promise<SubprocessResult>;
}

/**
 * Store a secret value in GNOME Keyring via secret-tool.
 * Runs: secret-tool store --label=<label> service <service> account <account>
 * Value is piped via stdin.
 *
 * @throws if secret-tool is not found on PATH or exits non-zero.
 */
export async function storeSecretViaSecretTool(
  service: string,
  account: string,
  value: string,
  label?: string,
  options: SecretToolWriterOptions = {},
): Promise<void> {
  const run = options.runSubprocessFn ?? runSubprocess;
  const effectiveLabel = label ?? `${service}/${account}`;

  await run('secret-tool', ['store', `--label=${effectiveLabel}`, 'service', service, 'account', account], {
    input: value,
  });
}

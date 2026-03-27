import type { ProviderSnapshot, ProviderSourceMode } from "shared-contract";

import {
  createErrorSnapshot,
  createProviderError,
  type ProviderAdapterContext,
} from "../../core/provider-adapter.js";

const DEFAULT_SOURCE: ProviderSourceMode = "cli";

export async function fetchCodexUsage(context: ProviderAdapterContext): Promise<ProviderSnapshot> {
  const updatedAt = context.now().toISOString();
  const source = context.sourceMode === "auto" ? DEFAULT_SOURCE : context.sourceMode;

  return createErrorSnapshot(
    context.providerId,
    source,
    updatedAt,
    createProviderError(
      "codex_cli_deprecated",
      "Codex CLI interactive /status is no longer supported in Codex v0.117+. Set sourceMode to 'auto' to use the app-server path.",
      false,
    ),
  );
}

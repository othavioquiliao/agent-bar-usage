import type { ProviderAdapter, ProviderAdapterContext } from "../../core/provider-adapter.js";
import { createUnavailableSnapshot } from "../../core/provider-adapter.js";
import { fetchCodexUsageViaAppServer } from "./codex-appserver-fetcher.js";
import { fetchCodexUsage } from "./codex-cli-fetcher.js";

export function createCodexCliAdapter(): ProviderAdapter {
  return {
    id: "codex",
    defaultSourceMode: "cli",
    async isAvailable(context: ProviderAdapterContext): Promise<boolean> {
      return context.sourceMode === "cli" || context.sourceMode === "auto";
    },
    async fetch(context: ProviderAdapterContext) {
      if (context.sourceMode !== "cli" && context.sourceMode !== "auto") {
        return createUnavailableSnapshot(context.providerId, context.sourceMode, context.now().toISOString());
      }

      // Primary: JSON-RPC via `codex app-server` (no PTY required)
      const appServerResult = await fetchCodexUsageViaAppServer({ env: context.env });

      // If the binary is missing entirely, fall through to PTY path
      // which has its own binary resolution and richer error reporting
      if (appServerResult.error?.code === "codex_cli_missing") {
        return await fetchCodexUsage(context);
      }

      return appServerResult;
    },
  };
}

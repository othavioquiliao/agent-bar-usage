import type { ProviderAdapter, ProviderAdapterContext } from "../../core/provider-adapter.js";
import { createUnavailableSnapshot } from "../../core/provider-adapter.js";
import { fetchCodexUsageViaAppServer } from "./codex-appserver-fetcher.js";
import { fetchCodexUsage } from "./codex-cli-fetcher.js";

export function createCodexCliAdapter(): ProviderAdapter {
  return {
    id: "codex",
    defaultSourceMode: "auto",
    async isAvailable(context: ProviderAdapterContext): Promise<boolean> {
      return context.sourceMode === "cli" || context.sourceMode === "auto";
    },
    async fetch(context: ProviderAdapterContext) {
      if (context.sourceMode === "cli") {
        return await fetchCodexUsage(context);
      }

      if (context.sourceMode !== "auto") {
        return createUnavailableSnapshot(context.providerId, context.sourceMode, context.now().toISOString());
      }

      // In auto mode, prefer the app-server path but keep the PTY CLI path as a fallback.
      const appServerResult = await fetchCodexUsageViaAppServer({ env: context.env });
      if (!appServerResult.error) {
        return appServerResult;
      }

      return await fetchCodexUsage(context);
    },
  };
}

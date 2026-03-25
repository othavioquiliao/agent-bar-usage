import type { ProviderAdapter, ProviderAdapterContext } from "../../core/provider-adapter.js";
import { createUnavailableSnapshot } from "../../core/provider-adapter.js";
import { fetchClaudeUsage } from "./claude-cli-fetcher.js";

export function createClaudeCliAdapter(): ProviderAdapter {
  return {
    id: "claude",
    defaultSourceMode: "cli",
    async isAvailable(context: ProviderAdapterContext): Promise<boolean> {
      return context.sourceMode === "cli" || context.sourceMode === "auto";
    },
    async fetch(context: ProviderAdapterContext) {
      if (context.sourceMode === "cli" || context.sourceMode === "auto") {
        return await fetchClaudeUsage(context);
      }

      return createUnavailableSnapshot(context.providerId, context.sourceMode, context.now().toISOString());
    },
  };
}

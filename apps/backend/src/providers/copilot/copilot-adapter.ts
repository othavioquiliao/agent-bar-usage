import type { ProviderAdapter, ProviderAdapterContext } from "../../core/provider-adapter.js";
import { createUnavailableSnapshot } from "../../core/provider-adapter.js";
import { fetchCopilotUsage } from "./copilot-usage-fetcher.js";

export function createCopilotAdapter(): ProviderAdapter {
  return {
    id: "copilot",
    defaultSourceMode: "api",
    async isAvailable(context: ProviderAdapterContext): Promise<boolean> {
      return context.sourceMode === "api" || context.sourceMode === "auto";
    },
    async fetch(context: ProviderAdapterContext) {
      if (context.sourceMode === "api" || context.sourceMode === "auto") {
        return await fetchCopilotUsage(context);
      }

      return createUnavailableSnapshot(context.providerId, context.sourceMode, context.now().toISOString());
    },
  };
}

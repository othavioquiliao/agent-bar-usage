import type { ProviderAdapter, ProviderAdapterContext } from "../../core/provider-adapter.js";
import { createUnavailableSnapshot } from "../../core/provider-adapter.js";
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
        return createUnavailableSnapshot(
          context.providerId,
          context.sourceMode === "auto" ? "cli" : context.sourceMode,
          context.now().toISOString(),
        );
      }

      return await fetchCodexUsage(context);
    },
  };
}

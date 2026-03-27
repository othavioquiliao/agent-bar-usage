import type { ProviderAdapter, ProviderAdapterContext } from "../../core/provider-adapter.js";
import { createUnavailableSnapshot } from "../../core/provider-adapter.js";
import { readClaudeCredentials } from "./claude-credentials.js";
import { fetchClaudeUsageViaApi } from "./claude-api-fetcher.js";
import { fetchClaudeUsage } from "./claude-cli-fetcher.js";

export function createClaudeCliAdapter(): ProviderAdapter {
  return {
    id: "claude",
    defaultSourceMode: "cli",
    async isAvailable(context: ProviderAdapterContext): Promise<boolean> {
      return context.sourceMode === "cli" || context.sourceMode === "auto" || context.sourceMode === "api";
    },
    async fetch(context: ProviderAdapterContext) {
      if (context.sourceMode === "api") {
        return await fetchClaudeUsageViaApi();
      }

      if (context.sourceMode === "cli") {
        return await fetchClaudeUsage(context);
      }

      if (context.sourceMode === "auto") {
        // Prefer HTTP API only in auto mode when Claude OAuth credentials exist on disk.
        const credentials = await readClaudeCredentials();
        if (credentials) {
          const apiSnapshot = await fetchClaudeUsageViaApi({ credentials });
          if (!apiSnapshot.error) {
            return apiSnapshot;
          }
        }

        // Fall back to PTY-based CLI fetcher when auto-selected API lookup fails.
        return await fetchClaudeUsage(context);
      }

      return createUnavailableSnapshot(context.providerId, context.sourceMode, context.now().toISOString());
    },
  };
}

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
      if (context.sourceMode === "api" || context.sourceMode === "auto" || context.sourceMode === "cli") {
        // Prefer HTTP API when Claude OAuth credentials exist on disk
        const credentials = await readClaudeCredentials();
        if (credentials) {
          return fetchClaudeUsageViaApi({ credentials });
        }

        // Fallback to PTY-based CLI fetcher when no credentials file
        if (context.sourceMode !== "api") {
          return await fetchClaudeUsage(context);
        }
      }

      return createUnavailableSnapshot(context.providerId, context.sourceMode, context.now().toISOString());
    },
  };
}

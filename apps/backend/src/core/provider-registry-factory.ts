import { ProviderRegistry } from "./provider-registry.js";
import { createClaudeCliAdapter } from "../providers/claude/claude-cli-adapter.js";
import { createCodexCliAdapter } from "../providers/codex/codex-cli-adapter.js";
import { createCopilotAdapter } from "../providers/copilot/copilot-adapter.js";

export function createProviderRegistry(): ProviderRegistry {
  return new ProviderRegistry([
    createCopilotAdapter(),
    createCodexCliAdapter(),
    createClaudeCliAdapter(),
  ]);
}

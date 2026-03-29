import { createClaudeCliAdapter } from './claude/claude-cli-adapter.js';
import { createCodexCliAdapter } from './codex/codex-cli-adapter.js';
import { createCopilotAdapter } from './copilot/copilot-adapter.js';

export function getBuiltinProviders() {
  return [createCopilotAdapter(), createCodexCliAdapter(), createClaudeCliAdapter()];
}

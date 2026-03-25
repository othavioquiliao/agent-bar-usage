import type { ProviderSnapshot, ProviderSourceMode } from "shared-contract";

import {
  createErrorSnapshot,
  createProviderError,
  createUnavailableSnapshot,
  type ProviderAdapterContext,
} from "../../core/provider-adapter.js";
import { resolveCommandInPath } from "../../utils/subprocess.js";
import { normalizeLineEndings, PtyUnavailableError, runInteractiveCommand, stripAnsi } from "../shared/interactive-command.js";
import { ClaudeCliParseError, mapClaudeUsageToSnapshot, parseClaudeUsage } from "./claude-cli-parser.js";

const DEFAULT_SOURCE: ProviderSourceMode = "cli";
const REQUEST_TIMEOUT_MS = 20_000;

export async function fetchClaudeUsage(context: ProviderAdapterContext): Promise<ProviderSnapshot> {
  const updatedAt = context.now().toISOString();
  const source = normalizeSourceMode(context.sourceMode, DEFAULT_SOURCE);

  if (source !== DEFAULT_SOURCE) {
    return createUnavailableSnapshot(
      context.providerId,
      source,
      updatedAt,
      createProviderError(
        "claude_source_unsupported",
        "Claude usage is only available through the CLI source mode on Ubuntu.",
      ),
    );
  }

  const binary = resolveClaudeBinary(context.env);
  if (!binary) {
    return createErrorSnapshot(
      context.providerId,
      source,
      updatedAt,
      createProviderError(
        "claude_cli_missing",
        "Claude CLI is not installed or not available on PATH.",
        false,
      ),
    );
  }

  const startedAt = Date.now();

  try {
    const result = await runInteractiveCommand(binary, [], {
      env: context.env,
      timeoutMs: REQUEST_TIMEOUT_MS,
      input: "y\r\r/usage\r",
    });

    return buildSnapshotFromText(context, source, updatedAt, result.stdout, startedAt, "claude.cli");
  } catch (error) {
    if (error instanceof PtyUnavailableError) {
      return createErrorSnapshot(
        context.providerId,
        source,
        updatedAt,
        createProviderError("claude_pty_unavailable", error.message, false),
      );
    }

    if (error instanceof ClaudeCliParseError) {
      return createErrorSnapshot(
        context.providerId,
        source,
        updatedAt,
        createProviderError(
          error.code,
          error.message,
          error.code === "claude_parse_failed",
        ),
      );
    }

    const output = extractSubprocessOutput(error);
    const parsed = output ? tryParseClaudeOutput(output) : null;
    if (parsed) {
      return buildSnapshotFromParsed(context, source, updatedAt, parsed, startedAt, "claude.cli");
    }

    return createErrorSnapshot(
      context.providerId,
      source,
      updatedAt,
      createProviderError(
        "claude_cli_failed",
        error instanceof Error ? error.message : "Claude CLI command failed.",
        true,
      ),
    );
  }
}

function buildSnapshotFromText(
  context: ProviderAdapterContext,
  source: ProviderSourceMode,
  updatedAt: string,
  text: string,
  startedAt: number,
  strategy: string,
): ProviderSnapshot {
  const parsed = tryParseClaudeOutput(text);
  if (!parsed) {
    return createErrorSnapshot(
      context.providerId,
      source,
      updatedAt,
      createProviderError(
        "claude_parse_failed",
        "Claude CLI output did not include the expected usage fields.",
        true,
      ),
    );
  }

  return buildSnapshotFromParsed(context, source, updatedAt, parsed, startedAt, strategy);
}

function buildSnapshotFromParsed(
  context: ProviderAdapterContext,
  source: ProviderSourceMode,
  updatedAt: string,
  parsed: ReturnType<typeof tryParseClaudeOutput>,
  startedAt: number,
  strategy: string,
): ProviderSnapshot {
  if (!parsed) {
    return createErrorSnapshot(
      context.providerId,
      source,
      updatedAt,
      createProviderError(
        "claude_parse_failed",
        "Claude CLI output did not include the expected usage fields.",
        true,
      ),
    );
  }

  return {
    provider: context.providerId,
    status: "ok",
    source,
    updated_at: updatedAt,
    usage: parsed.usage,
    reset_window: parsed.resetWindow,
    error: null,
    diagnostics: {
      attempts: [
        {
          strategy,
          available: true,
          duration_ms: Date.now() - startedAt,
          error: null,
        },
      ],
    },
  };
}

function tryParseClaudeOutput(text: string): ReturnType<typeof mapClaudeUsageToSnapshot> | null {
  try {
    const parsed = parseClaudeUsage(stripAnsi(normalizeLineEndings(text)));
    return mapClaudeUsageToSnapshot(parsed);
  } catch {
    return null;
  }
}

function resolveClaudeBinary(env: NodeJS.ProcessEnv): string | null {
  const override = normalizeBinaryOverride(env.CLAUDE_CLI_PATH);
  if (override) {
    return override;
  }

  return resolveCommandInPath("claude", env);
}

function normalizeBinaryOverride(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed;
}

function extractSubprocessOutput(error: unknown): string | null {
  if (!isSubprocessFailure(error)) {
    return null;
  }

  return `${error.result.stdout}\n${error.result.stderr}`.trim();
}

function isSubprocessFailure(error: unknown): error is { result: { stdout: string; stderr: string } } {
  return Boolean(error && typeof error === "object" && "result" in error);
}

function normalizeSourceMode(
  sourceMode: ProviderSourceMode,
  defaultMode: ProviderSourceMode,
): ProviderSourceMode {
  return sourceMode === "auto" ? defaultMode : sourceMode;
}

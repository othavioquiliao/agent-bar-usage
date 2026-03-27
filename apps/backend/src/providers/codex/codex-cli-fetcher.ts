import type { ProviderSnapshot, ProviderSourceMode } from "shared-contract";

import {
  createErrorSnapshot,
  createProviderError,
  createUnavailableSnapshot,
  type ProviderAdapterContext,
} from "../../core/provider-adapter.js";
import { describeSubprocessFailure, resolveCommandInPath, SubprocessError } from "../../utils/subprocess.js";
import { normalizeLineEndings, PtyUnavailableError, runInteractiveCommand, stripAnsi } from "../shared/interactive-command.js";
import { CodexCliParseError, mapCodexUsageToSnapshot, parseCodexUsage } from "./codex-cli-parser.js";

const DEFAULT_SOURCE: ProviderSourceMode = "cli";
const REQUEST_TIMEOUT_MS = 12_000;

export async function fetchCodexUsage(context: ProviderAdapterContext): Promise<ProviderSnapshot> {
  const updatedAt = context.now().toISOString();
  const source = normalizeSourceMode(context.sourceMode, DEFAULT_SOURCE);

  if (source !== DEFAULT_SOURCE) {
    return createUnavailableSnapshot(
      context.providerId,
      source,
      updatedAt,
      createProviderError(
        "codex_source_unsupported",
        "Codex usage is only available through the CLI source mode on Ubuntu.",
      ),
    );
  }

  const binary = resolveCodexBinary(context.env);
  if (!binary) {
    return createErrorSnapshot(
      context.providerId,
      source,
      updatedAt,
      createProviderError(
        "codex_cli_missing",
        "Codex CLI is not installed or not available on PATH.",
        false,
      ),
    );
  }

  const startedAt = Date.now();

  try {
    const result = await runInteractiveCommand(binary, ["-s", "read-only", "-a", "untrusted"], {
      env: context.env,
      timeoutMs: REQUEST_TIMEOUT_MS,
      input: "/status\n",
    });
    const output = result.stdout.trim();

    return buildSnapshotFromText(context, source, updatedAt, output, startedAt, "codex.cli");
  } catch (error) {
    if (error instanceof PtyUnavailableError) {
      return createErrorSnapshot(
        context.providerId,
        source,
        updatedAt,
        createProviderError("codex_pty_unavailable", error.message, false),
      );
    }

    if (error instanceof CodexCliParseError) {
      return createErrorSnapshot(
        context.providerId,
        source,
        updatedAt,
        createProviderError(
          error.code,
          error.message,
          error.code === "codex_parse_failed",
        ),
      );
    }

    const output = extractSubprocessOutput(error);
    const parsed = output ? tryParseCodexOutput(output) : null;
    if (parsed) {
      return buildSnapshotFromParsed(context, source, updatedAt, parsed, startedAt, "codex.cli");
    }

    if (looksLikeUpdatePrompt(output ?? "", error)) {
      return createErrorSnapshot(
        context.providerId,
        source,
        updatedAt,
        createProviderError(
          "codex_update_required",
          "Codex CLI is prompting for an update and cannot expose usage yet.",
          false,
        ),
      );
    }

    const message =
      error instanceof SubprocessError
        ? describeSubprocessFailure(error)
        : error instanceof Error
          ? error.message
          : "Codex CLI command failed.";

    return createErrorSnapshot(
      context.providerId,
      source,
      updatedAt,
      createProviderError("codex_cli_failed", message, true),
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
  const parsed = tryParseCodexOutput(text);
  if (!parsed) {
    return createErrorSnapshot(
      context.providerId,
      source,
      updatedAt,
      createProviderError(
        "codex_parse_failed",
        "Codex CLI output did not include the expected usage fields.",
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
  parsed: ReturnType<typeof tryParseCodexOutput>,
  startedAt: number,
  strategy: string,
): ProviderSnapshot {
  if (!parsed) {
    return createErrorSnapshot(
      context.providerId,
      source,
      updatedAt,
      createProviderError(
        "codex_parse_failed",
        "Codex CLI output did not include the expected usage fields.",
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

function tryParseCodexOutput(text: string): ReturnType<typeof mapCodexUsageToSnapshot> | null {
  try {
    const parsed = parseCodexUsage(stripAnsi(normalizeLineEndings(text)));
    return mapCodexUsageToSnapshot(parsed);
  } catch (error) {
    if (error instanceof CodexCliParseError && error.code === "codex_update_required") {
      throw error;
    }
    return null;
  }
}

function resolveCodexBinary(env: NodeJS.ProcessEnv): string | null {
  const override = normalizeBinaryOverride(env.CODEX_CLI_PATH);
  if (override) {
    return override;
  }

  return resolveCommandInPath("codex", env);
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

function looksLikeUpdatePrompt(output: string, error: unknown): boolean {
  const text = `${output}\n${error instanceof Error ? error.message : ""}`.toLowerCase();
  return text.includes("update available") || text.includes("update required");
}

function normalizeSourceMode(
  sourceMode: ProviderSourceMode,
  defaultMode: ProviderSourceMode,
): ProviderSourceMode {
  return sourceMode === "auto" ? defaultMode : sourceMode;
}


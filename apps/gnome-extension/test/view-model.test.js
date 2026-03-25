import { describe, expect, it } from "vitest";

import {
  buildIndicatorSummaryViewModel,
  buildProviderRowViewModel,
  buildSnapshotViewModel,
} from "../utils/view-model.js";

describe("provider view models", () => {
  it("maps a healthy provider snapshot into display text", () => {
    const row = buildProviderRowViewModel(
      {
        provider: "codex",
        status: "ok",
        source: "cli",
        updated_at: "2026-03-25T17:05:00.000Z",
        usage: {
          kind: "quota",
          used: 10,
          limit: 100,
          percent_used: 10,
        },
        reset_window: {
          resets_at: "2026-03-26T00:00:00.000Z",
          label: "Tomorrow",
        },
        error: null,
      },
      {
        now: new Date("2026-03-25T17:10:00.000Z"),
      },
    );

    expect(row).toMatchObject({
      title: "Codex",
      statusText: "Healthy",
      usageText: "Usage: 10 / 100 (10%)",
      resetText: "Reset: Tomorrow",
      sourceText: "Source: cli",
      errorText: null,
    });
    expect(row.updatedAtText).toBe("Updated 5 minutes ago");
  });

  it("maps an error provider snapshot into readable error text", () => {
    const row = buildProviderRowViewModel(
      {
        provider: "claude",
        status: "error",
        source: "cli",
        updated_at: "2026-03-25T17:02:00.000Z",
        usage: null,
        reset_window: null,
        error: {
          code: "provider_fetch_failed",
          message: "adapter exploded",
          retryable: false,
        },
      },
      {
        now: new Date("2026-03-25T17:10:00.000Z"),
      },
    );

    expect(row).toMatchObject({
      title: "Claude",
      statusText: "Error",
      usageText: "Usage unavailable",
      errorText: "adapter exploded",
      sourceText: "Source: cli",
      diagnosticsSummaryText: "Diagnostics: adapter exploded",
      suggestedCommandText: "Suggested command: agent-bar doctor --json",
    });
  });

  it("surfaces missing prerequisite guidance for secret-tool failures", () => {
    const row = buildProviderRowViewModel(
      {
        provider: "claude",
        status: "error",
        source: "cli",
        updated_at: "2026-03-25T17:02:00.000Z",
        usage: null,
        reset_window: null,
        error: {
          code: "secret_store_unavailable",
          message: "secret-tool is unavailable",
          retryable: false,
        },
      },
      {
        now: new Date("2026-03-25T17:10:00.000Z"),
      },
    );

    expect(row.diagnosticsSummaryText).toBe("Missing prerequisite: secret-tool");
    expect(row.suggestedCommandText).toBe("Suggested command: agent-bar doctor --json");
  });

  it("maps an unavailable provider snapshot without losing the placeholder text", () => {
    const row = buildProviderRowViewModel(
      {
        provider: "copilot",
        status: "unavailable",
        source: "api",
        updated_at: "2026-03-25T17:02:00.000Z",
        usage: null,
        reset_window: null,
        error: null,
      },
      {
        now: new Date("2026-03-25T17:10:00.000Z"),
      },
    );

    expect(row).toMatchObject({
      title: "Copilot",
      statusText: "Unavailable",
      usageText: "Usage unavailable",
      errorText: null,
    });
  });
});

describe("snapshot view models", () => {
  it("returns an empty state when no snapshot envelope exists", () => {
    const snapshot = buildSnapshotViewModel(
      {
        snapshotEnvelope: null,
        isLoading: false,
        lastUpdatedText: null,
        lastError: null,
      },
      {
        now: new Date("2026-03-25T17:10:00.000Z"),
      },
    );

    expect(snapshot.providerRows).toEqual([]);
    expect(snapshot.summaryTitle).toBe("No provider data yet");
    expect(snapshot.emptyStateText).toBe("No provider snapshots yet");
  });

  it("builds the loading indicator summary text", () => {
    const summary = buildIndicatorSummaryViewModel(
      {
        isLoading: true,
        snapshotEnvelope: null,
        lastError: null,
        lastUpdatedText: null,
      },
      {
        now: new Date("2026-03-25T17:10:00.000Z"),
      },
    );

    expect(summary).toMatchObject({
      iconName: "view-refresh-symbolic",
      labelText: "Refreshing",
    });
  });

  it("surfaces backend errors in the snapshot summary", () => {
    const snapshot = buildSnapshotViewModel(
      {
        snapshotEnvelope: null,
        isLoading: false,
        lastUpdatedText: null,
        lastError: "backend unavailable",
      },
      {
        now: new Date("2026-03-25T17:10:00.000Z"),
      },
    );

    expect(snapshot.diagnosticsSummaryText).toBe("Backend error: backend unavailable");
    expect(snapshot.suggestedCommandText).toBe("Suggested command: agent-bar doctor --json");
  });
});

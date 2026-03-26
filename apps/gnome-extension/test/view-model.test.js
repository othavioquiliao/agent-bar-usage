import { describe, expect, it } from "vitest";

import {
  buildIndicatorSummaryViewModel,
  buildProviderRowViewModel,
  buildSnapshotViewModel,
} from "../utils/view-model.js";

const NOW = new Date("2026-03-25T17:10:00.000Z");

function buildState(providers, overrides = {}) {
  return {
    isLoading: false,
    lastError: null,
    lastUpdatedText: null,
    snapshotEnvelope: providers
      ? {
          generated_at: "2026-03-25T17:05:00.000Z",
          providers,
        }
      : null,
    ...overrides,
  };
}

describe("indicator summary view model", () => {
  it("returns aggregate-only healthy indicator copy", () => {
    const summary = buildIndicatorSummaryViewModel(
      buildState([
        {
          provider: "codex",
          status: "ok",
          usage: {
            kind: "quota",
            used: 10,
            limit: 100,
            percent_used: 10,
          },
        },
        {
          provider: "claude",
          status: "ok",
          usage: {
            kind: "quota",
            used: 25,
            limit: 100,
            percent_used: 25,
          },
        },
      ]),
      { now: NOW },
    );

    expect(summary).toMatchObject({
      iconName: "emblem-ok-symbolic",
      labelText: "2/2 ok",
      healthyCount: 2,
      issueCount: 0,
      providerCount: 2,
    });
  });

  it("returns issue indicator copy with singular and plural labels", () => {
    const singleIssue = buildIndicatorSummaryViewModel(
      buildState([
        { provider: "codex", status: "ok", usage: { kind: "quota", used: 10, limit: 100, percent_used: 10 } },
        { provider: "claude", status: "error", usage: null, error: { code: "provider_fetch_failed", message: "boom" } },
      ]),
      { now: NOW },
    );
    const pluralIssues = buildIndicatorSummaryViewModel(
      buildState([
        { provider: "codex", status: "error", usage: null, error: { code: "provider_fetch_failed", message: "boom" } },
        { provider: "claude", status: "degraded", usage: null, error: { code: "auth_required", message: "auth expired" } },
        { provider: "copilot", status: "ok", usage: { kind: "quota", used: 20, limit: 100, percent_used: 20 } },
      ]),
      { now: NOW },
    );

    expect(singleIssue).toMatchObject({
      iconName: "dialog-warning-symbolic",
      labelText: "1 issue",
      issueCount: 1,
    });
    expect(pluralIssues).toMatchObject({
      iconName: "dialog-warning-symbolic",
      labelText: "2 issues",
      issueCount: 2,
    });
  });

  it("returns service failure indicator copy for backend errors", () => {
    const summary = buildIndicatorSummaryViewModel(
      buildState(null, {
        lastError: "backend unavailable",
      }),
      { now: NOW },
    );

    expect(summary).toMatchObject({
      iconName: "dialog-error-symbolic",
      labelText: "Service",
      issueCount: 0,
      providerCount: 0,
    });
  });

  it("returns exact loading and empty indicator labels", () => {
    const loading = buildIndicatorSummaryViewModel(
      buildState(null, {
        isLoading: true,
      }),
      { now: NOW },
    );
    const empty = buildIndicatorSummaryViewModel(buildState(null), { now: NOW });

    expect(loading.labelText).toBe("Refreshing");
    expect(empty).toMatchObject({
      iconName: "dialog-information-symbolic",
      labelText: "No data",
      providerCount: 0,
    });
  });
});

describe("provider row view models", () => {
  it("exposes compact healthy row fields without inline diagnostics noise", () => {
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
      { now: NOW },
    );

    expect(row).toMatchObject({
      providerId: "codex",
      title: "Codex",
      status: "ok",
      statusText: "Healthy",
      statusIconName: "emblem-ok-symbolic",
      iconKey: "codex",
      quotaText: "10 / 100 (10%)",
      progressPercent: 10,
      progressVisible: true,
      secondaryText: "Reset Tomorrow",
      issueSummaryText: null,
      detailsSourceText: "Source: cli",
      detailsSuggestedCommandText: null,
    });
    expect(row.updatedAtText).toBe("Updated 5 minutes ago");
    expect(row.secondaryText).not.toContain("Source:");
    expect(row.secondaryText).not.toContain("Suggested command:");
  });

  it("normalizes missing prerequisites and auth failures into compact secondary labels", () => {
    const missingPrerequisite = buildProviderRowViewModel(
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
      { now: NOW },
    );
    const authNeeded = buildProviderRowViewModel(
      {
        provider: "copilot",
        status: "degraded",
        source: "api",
        updated_at: "2026-03-25T17:02:00.000Z",
        usage: null,
        reset_window: null,
        error: {
          code: "auth_required",
          message: "Sign in again",
          retryable: true,
        },
        diagnostics: {
          attempts: [{ command: "copilot auth login" }],
        },
      },
      { now: NOW },
    );

    expect(missingPrerequisite).toMatchObject({
      statusIconName: "dialog-error-symbolic",
      quotaText: null,
      progressPercent: null,
      progressVisible: false,
      secondaryText: "Missing secret-tool",
      issueSummaryText: "Missing secret-tool",
      detailsSourceText: "Source: cli",
      detailsSuggestedCommandText: "Suggested command: agent-bar doctor --json",
    });
    expect(authNeeded).toMatchObject({
      statusIconName: "dialog-warning-symbolic",
      progressVisible: false,
      secondaryText: "Auth needed",
      issueSummaryText: "Auth needed",
      detailsSuggestedCommandText: "Suggested command: agent-bar doctor --json",
    });
    expect(authNeeded.secondaryText).not.toContain("Suggested command:");
    expect(authNeeded.secondaryText).not.toContain("Source:");
  });
});

describe("snapshot view models", () => {
  it("tracks aggregate healthy and issue counts for menu rendering", () => {
    const snapshot = buildSnapshotViewModel(
      buildState([
        {
          provider: "codex",
          status: "ok",
          usage: {
            kind: "quota",
            used: 10,
            limit: 100,
            percent_used: 10,
          },
        },
        {
          provider: "claude",
          status: "error",
          usage: null,
          error: {
            code: "provider_fetch_failed",
            message: "adapter exploded",
          },
        },
      ]),
      { now: NOW },
    );

    expect(snapshot).toMatchObject({
      providerCount: 2,
      healthyCount: 1,
      issueCount: 1,
      diagnosticsSummaryText: "1 issue",
      suggestedCommandText: "Suggested command: agent-bar doctor --json",
    });
  });
});

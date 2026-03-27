import { describe, expect, it } from "vitest";

import { buildProviderRowLayoutModel } from "../panel/provider-row-model.js";

describe("provider row layout model", () => {
  it("prefers reset text over issue and metadata text", () => {
    const layout = buildProviderRowLayoutModel({
      providerId: "codex",
      title: "Codex",
      status: "ok",
      statusText: "Healthy",
      statusIconName: "emblem-ok-symbolic",
      quotaText: "10 / 100 (10%)",
      progressPercent: 10,
      progressVisible: true,
      resetText: "Reset Tomorrow",
      issueSummaryText: "Auth needed",
      metadataText: "Updated 5 minutes ago",
    });

    expect(layout.secondaryText).toBe("Reset Tomorrow");
  });

  it("falls back to issue text and hides details-only metadata", () => {
    const layout = buildProviderRowLayoutModel({
      providerId: "claude",
      title: "Claude",
      status: "error",
      statusText: "Error",
      statusIconName: "dialog-error-symbolic",
      quotaText: null,
      progressPercent: null,
      progressVisible: false,
      issueSummaryText: "Missing secret-tool",
      metadataText: "Source: cli",
      secondaryText: "Suggested command: agent-bar doctor --json",
    });

    expect(layout.secondaryText).toBe("Missing secret-tool");
    expect(layout.secondaryText).not.toContain("Suggested command:");
    expect(layout.secondaryText).not.toContain("Source:");
  });

  it("shows the progress bar only when quota data and a percent are both present", () => {
    const visible = buildProviderRowLayoutModel({
      providerId: "copilot",
      title: "Copilot",
      status: "degraded",
      statusText: "Issue",
      statusIconName: "dialog-warning-symbolic",
      quotaText: "80 / 100 (80%)",
      progressPercent: 80,
      progressVisible: true,
    });
    const hiddenWithoutQuota = buildProviderRowLayoutModel({
      providerId: "copilot",
      title: "Copilot",
      status: "degraded",
      statusText: "Issue",
      statusIconName: "dialog-warning-symbolic",
      quotaText: null,
      progressPercent: 80,
      progressVisible: true,
    });
    const hiddenWithoutPercent = buildProviderRowLayoutModel({
      providerId: "copilot",
      title: "Copilot",
      status: "degraded",
      statusText: "Issue",
      statusIconName: "dialog-warning-symbolic",
      quotaText: "80 / 100",
      progressPercent: null,
      progressVisible: true,
    });

    expect(visible).toMatchObject({
      quotaLine: "80 / 100 (80%)",
      progressPercent: 80,
      showProgressBar: true,
      showProgressFill: true,
    });
    expect(hiddenWithoutQuota.showProgressBar).toBe(false);
    expect(hiddenWithoutPercent.showProgressBar).toBe(false);
  });

  it("keeps suggested command text out of the primary row layout model", () => {
    const layout = buildProviderRowLayoutModel({
      providerId: "codex",
      title: "Codex",
      status: "error",
      statusText: "Error",
      statusIconName: "dialog-error-symbolic",
      quotaText: null,
      progressPercent: null,
      progressVisible: false,
      secondaryText: "Suggested command: agent-bar doctor --json",
      metadataText: "Updated 5 minutes ago",
    });

    expect(layout.secondaryText).toBeNull();
    expect(layout.quotaLine).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import {
  applyLoadingState,
  applySnapshotError,
  applySnapshotSuccess,
  createInitialState,
} from "../state/extension-state.js";
import { parseStrictJson } from "../utils/json.js";

describe("extension state", () => {
  it("creates the idle baseline state", () => {
    expect(createInitialState()).toEqual({
      status: "idle",
      isLoading: false,
      snapshotEnvelope: null,
      schemaVersion: null,
      generatedAt: null,
      providers: [],
      error: null,
    });
  });

  it("marks the state as loading while preserving the previous snapshot", () => {
    const previousState = {
      ...createInitialState(),
      status: "ready",
      snapshotEnvelope: {
        schema_version: "1",
        generated_at: "2026-03-25T17:00:00Z",
        providers: [],
      },
      schemaVersion: "1",
      generatedAt: "2026-03-25T17:00:00Z",
    };

    expect(applyLoadingState(previousState)).toEqual({
      ...previousState,
      status: "loading",
      isLoading: true,
      error: null,
    });
  });

  it("applies a successful snapshot envelope", () => {
    const snapshotEnvelope = {
      schema_version: "1",
      generated_at: "2026-03-25T17:15:00Z",
      providers: [
        {
          provider: "codex",
          status: "ok",
          source: "cli",
          updated_at: "2026-03-25T17:15:00Z",
          usage: {
            kind: "quota",
            used: 10,
            limit: 100,
            percent_used: 10,
          },
          reset_window: null,
          error: null,
        },
      ],
    };

    expect(applySnapshotSuccess(applyLoadingState(createInitialState()), snapshotEnvelope)).toEqual({
      status: "ready",
      isLoading: false,
      snapshotEnvelope,
      schemaVersion: "1",
      generatedAt: "2026-03-25T17:15:00Z",
      providers: snapshotEnvelope.providers,
      error: null,
    });
  });

  it("captures a normalized error message when refresh fails", () => {
    const state = applySnapshotError(createInitialState(), new Error("backend unavailable"));

    expect(state).toEqual({
      status: "error",
      isLoading: false,
      snapshotEnvelope: null,
      schemaVersion: null,
      generatedAt: null,
      providers: [],
      error: "backend unavailable",
    });
  });

  it("throws a clear error for invalid backend JSON", () => {
    expect(() => parseStrictJson("{not-json}", "backend stdout")).toThrow(
      "Invalid JSON from backend stdout",
    );
  });
});

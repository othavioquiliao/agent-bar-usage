import { describe, expect, it, vi } from "vitest";

import { createPollingService } from "../services/polling-service.js";
import { createInitialState } from "../state/extension-state.js";

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

describe("polling service", () => {
  it("starts and stops the polling timer", () => {
    const scheduler = {
      setInterval: vi.fn(() => 42),
      clearInterval: vi.fn(),
      now: () => new Date("2026-03-25T17:00:00.000Z"),
    };
    const backendClient = {
      fetchUsageSnapshot: vi.fn(),
    };
    const service = createPollingService({
      backendClient,
      scheduler,
      initialState: createInitialState(),
      intervalMs: 15_000,
    });

    service.start();

    expect(service.isActive).toBe(true);
    expect(scheduler.setInterval).toHaveBeenCalledTimes(1);
    expect(scheduler.setInterval).toHaveBeenCalledWith(expect.any(Function), 15_000);

    service.stop();

    expect(service.isActive).toBe(false);
    expect(scheduler.clearInterval).toHaveBeenCalledWith(42);
  });

  it("prevents overlapping refreshes and transitions to ready on success", async () => {
    const deferred = createDeferred();
    const scheduler = {
      setInterval: vi.fn(() => 7),
      clearInterval: vi.fn(),
      now: () => new Date("2026-03-25T17:10:00.000Z"),
    };
    const backendClient = {
      fetchUsageSnapshot: vi.fn(() => deferred.promise),
    };
    const states = [];
    const service = createPollingService({
      backendClient,
      scheduler,
      onStateChange: (state) => states.push(state),
    });

    const firstRefresh = service.refreshNow();
    const secondRefresh = service.refreshNow();

    expect(secondRefresh).toBe(firstRefresh);
    expect(backendClient.fetchUsageSnapshot).toHaveBeenCalledTimes(1);
    expect(states[0]).toMatchObject({
      status: "loading",
      isLoading: true,
      lastError: null,
    });

    deferred.resolve({
      schema_version: "1",
      generated_at: "2026-03-25T17:05:00.000Z",
      providers: [],
    });

    await firstRefresh;

    expect(states.at(-1)).toMatchObject({
      status: "ready",
      isLoading: false,
      lastUpdatedText: "Last updated 5 minutes ago",
    });
  });

  it("captures backend failures in state", async () => {
    const scheduler = {
      setInterval: vi.fn(() => 8),
      clearInterval: vi.fn(),
      now: () => new Date("2026-03-25T17:10:00.000Z"),
    };
    const backendClient = {
      fetchUsageSnapshot: vi.fn(async () => {
        throw new Error("backend unavailable");
      }),
    };
    const states = [];
    const service = createPollingService({
      backendClient,
      scheduler,
      onStateChange: (state) => states.push(state),
    });

    await expect(service.refreshNow()).rejects.toThrow("backend unavailable");

    expect(states[0]).toMatchObject({
      status: "loading",
      isLoading: true,
    });
    expect(states.at(-1)).toMatchObject({
      status: "error",
      isLoading: false,
      lastError: "backend unavailable",
    });
  });
});


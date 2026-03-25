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

  it("logs structured error when snapshot fetch fails", async () => {
    const errors = [];
    const originalError = console.error;
    console.error = (...args) => errors.push(args.join(" "));

    const scheduler = {
      setInterval: vi.fn(() => 9),
      clearInterval: vi.fn(),
      now: () => new Date("2026-03-25T17:10:00.000Z"),
    };
    const fetchError = new Error("connection refused");
    fetchError.argv = ["/usr/bin/agent-bar", "service", "refresh", "--json"];
    fetchError.stderr = "ECONNREFUSED";
    const backendClient = {
      fetchUsageSnapshot: vi.fn(async () => {
        throw fetchError;
      }),
    };
    const states = [];
    const service = createPollingService({
      backendClient,
      scheduler,
      onStateChange: (state) => states.push(state),
    });

    await service.refreshNow();

    expect(errors.some((e) => e.includes("[agent-bar]") && e.includes("connection refused"))).toBe(true);
    expect(errors.some((e) => e.includes("[agent-bar]") && e.includes("ECONNREFUSED"))).toBe(true);

    console.error = originalError;
  });

  it("retries with backoff after failure", async () => {
    let callCount = 0;
    const backendClient = {
      fetchUsageSnapshot: async () => {
        callCount++;
        if (callCount <= 2) throw new Error("connection refused");
        return { schema_version: "1", generated_at: new Date().toISOString(), providers: [] };
      },
    };

    const timeouts = [];
    const scheduler = {
      setInterval: (cb, ms) => {
        timeouts.push({ cb, ms });
        return timeouts.length;
      },
      clearInterval: vi.fn(),
      now: () => new Date(),
    };

    const service = createPollingService({ backendClient, scheduler, retryDelays: [100, 200] });
    service.start();
    await service.refreshNow();

    // After first failure, a retry should be scheduled
    expect(timeouts.length).toBeGreaterThanOrEqual(2); // 1 for start() timer + at least 1 for retry
  });

  it("resets retry counter on success", async () => {
    let callCount = 0;
    const backendClient = {
      fetchUsageSnapshot: async () => {
        callCount++;
        if (callCount === 1) throw new Error("transient failure");
        return { schema_version: "1", generated_at: new Date().toISOString(), providers: [] };
      },
    };

    const timeouts = [];
    const scheduler = {
      setInterval: (cb, ms) => {
        timeouts.push({ cb, ms });
        return timeouts.length;
      },
      clearInterval: vi.fn(),
      now: () => new Date(),
    };

    const states = [];
    const service = createPollingService({
      backendClient,
      scheduler,
      retryDelays: [100, 200],
      onStateChange: (s) => states.push(s),
    });
    service.start();

    // First call fails
    await service.refreshNow();
    // Retry timeout scheduled — trigger it
    const retryTimeout = timeouts.find((t) => t.ms === 100);
    expect(retryTimeout).toBeDefined();
    await retryTimeout.cb();

    // Second call succeeds — should land in ready state
    expect(states.at(-1)).toMatchObject({ status: "ready", isLoading: false });
  });

  it("clamps retry delay to last value in retryDelays array", async () => {
    let callCount = 0;
    let lastRefreshPromise = null;
    const backendClient = {
      fetchUsageSnapshot: async () => {
        callCount++;
        throw new Error("persistent failure");
      },
    };

    const timeouts = [];
    const originalSchedulerSetInterval = (cb, ms) => {
      const wrappedCb = () => {
        lastRefreshPromise = cb();
        return lastRefreshPromise;
      };
      timeouts.push({ cb: wrappedCb, ms });
      return timeouts.length;
    };
    const scheduler = {
      setInterval: originalSchedulerSetInterval,
      clearInterval: vi.fn(),
      now: () => new Date(),
    };

    const service = createPollingService({ backendClient, scheduler, retryDelays: [100, 200] });
    service.start();

    // Fail 1
    await service.refreshNow();
    const retry1 = timeouts.find((t) => t.ms === 100);
    expect(retry1).toBeDefined();

    // Fail 2 — trigger retry callback and wait for the inner refreshNow to settle
    retry1.cb();
    await lastRefreshPromise;
    const retry2 = timeouts.find((t) => t.ms === 200);
    expect(retry2).toBeDefined();

    // Fail 3 — should clamp at 200 (last entry)
    retry2.cb();
    await lastRefreshPromise;
    const retry3Candidates = timeouts.filter((t) => t.ms === 200);
    expect(retry3Candidates.length).toBeGreaterThanOrEqual(2);
  });

  it("stop() clears retry state", async () => {
    const backendClient = {
      fetchUsageSnapshot: async () => {
        throw new Error("fail");
      },
    };

    const scheduler = {
      setInterval: vi.fn(() => 99),
      clearInterval: vi.fn(),
      now: () => new Date(),
    };

    const service = createPollingService({ backendClient, scheduler, retryDelays: [100] });
    service.start();
    await service.refreshNow();

    service.stop();

    // clearInterval should have been called for both the poll timer and the retry timer
    expect(scheduler.clearInterval).toHaveBeenCalled();
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


import { applyLoadingState, applySnapshotError, applySnapshotSuccess, createInitialState } from "../state/extension-state.js";
import { formatLastUpdatedText } from "../utils/time.js";

const DEFAULT_INTERVAL_MS = 150_000;

function defaultScheduler() {
  return {
    setInterval(callback, intervalMs) {
      return globalThis.setInterval(callback, intervalMs);
    },
    clearInterval(handle) {
      globalThis.clearInterval(handle);
    },
    now() {
      return new Date();
    },
  };
}

export function createPollingService({
  backendClient,
  onStateChange = () => {},
  intervalMs = DEFAULT_INTERVAL_MS,
  scheduler = defaultScheduler(),
  initialState = createInitialState(),
  retryDelays = [2_000, 8_000, 30_000],
} = {}) {
  let state = initialState;
  let timerHandle = null;
  let isActive = false;
  let currentGeneration = 0;
  let inFlightPromise = null;
  let consecutiveFailures = 0;
  let retryHandle = null;

  function emit(nextState) {
    state = nextState;
    onStateChange(nextState);
  }

  function clearTimer() {
    if (timerHandle !== null) {
      scheduler.clearInterval(timerHandle);
      timerHandle = null;
    }
  }

  function scheduleTimer() {
    clearTimer();

    if (!isActive) {
      return;
    }

    timerHandle = scheduler.setInterval(() => {
      void refreshNow();
    }, intervalMs);
  }

  function clearRetry() {
    if (retryHandle !== null) {
      scheduler.clearInterval(retryHandle);
      retryHandle = null;
    }
  }

  function scheduleRetry() {
    clearRetry();
    if (!isActive || consecutiveFailures === 0) return;
    const delay = retryDelays[Math.min(consecutiveFailures - 1, retryDelays.length - 1)];
    retryHandle = scheduler.setInterval(() => {
      clearRetry();
      return refreshNow();
    }, delay);
  }

  function refreshNow({ forceRefresh = false } = {}) {
    if (inFlightPromise) {
      return inFlightPromise;
    }

    const generation = currentGeneration;
    emit(applyLoadingState(state));

    let fetchResult;

    try {
      fetchResult = backendClient.fetchUsageSnapshot({ forceRefresh });
    } catch (error) {
      emit(applySnapshotError(state, error));
      return Promise.reject(error);
    }

    const refreshPromise = Promise.resolve(fetchResult)
      .then((snapshotEnvelope) => {
        if (generation !== currentGeneration) {
          return snapshotEnvelope;
        }

        consecutiveFailures = 0;
        clearRetry();

        emit(
          applySnapshotSuccess(state, snapshotEnvelope, {
            lastUpdatedText: formatLastUpdatedText(snapshotEnvelope?.generated_at, scheduler.now()),
          }),
        );

        return snapshotEnvelope;
      })
      .catch((error) => {
        if (generation !== currentGeneration) {
          return undefined;
        }

        console.error(`[agent-bar] Snapshot fetch failed: ${error?.message ?? error}`);
        if (error?.argv) {
          console.error(`[agent-bar]   command: ${error.argv.join(" ")}`);
        }
        if (error?.stderr) {
          console.error(`[agent-bar]   stderr: ${error.stderr}`);
        }

        emit(applySnapshotError(state, error));
        consecutiveFailures += 1;
        scheduleRetry();
      })
      .finally(() => {
        if (inFlightPromise === refreshPromise) {
          inFlightPromise = null;
        }
      });

    inFlightPromise = refreshPromise;
    return refreshPromise;
  }

  return {
    start() {
      if (isActive) {
        return state;
      }

      isActive = true;
      currentGeneration += 1;
      scheduleTimer();
      return state;
    },

    stop() {
      if (!isActive) {
        clearTimer();
        return state;
      }

      isActive = false;
      currentGeneration += 1;
      clearTimer();
      clearRetry();
      consecutiveFailures = 0;
      inFlightPromise = null;
      return state;
    },

    refreshNow,

    getState() {
      return state;
    },

    get isActive() {
      return isActive;
    },
  };
}

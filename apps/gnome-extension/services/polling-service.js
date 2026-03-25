import { applyLoadingState, applySnapshotError, applySnapshotSuccess, createInitialState } from "../state/extension-state.js";
import { formatLastUpdatedText } from "../utils/time.js";

const DEFAULT_INTERVAL_MS = 30_000;

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
} = {}) {
  let state = initialState;
  let timerHandle = null;
  let isActive = false;
  let currentGeneration = 0;
  let inFlightPromise = null;

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

        emit(applySnapshotError(state, error));
        throw error;
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

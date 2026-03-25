export function createInitialState() {
  return {
    status: "idle",
    isLoading: false,
    snapshotEnvelope: null,
    schemaVersion: null,
    generatedAt: null,
    providers: [],
    error: null,
  };
}

export function applyLoadingState(previousState = createInitialState()) {
  return {
    ...previousState,
    status: "loading",
    isLoading: true,
    error: null,
  };
}

export function applySnapshotSuccess(previousState = createInitialState(), snapshotEnvelope) {
  return {
    ...previousState,
    status: "ready",
    isLoading: false,
    snapshotEnvelope,
    schemaVersion: snapshotEnvelope.schema_version,
    generatedAt: snapshotEnvelope.generated_at,
    providers: snapshotEnvelope.providers,
    error: null,
  };
}

export function applySnapshotError(previousState = createInitialState(), error) {
  return {
    ...previousState,
    status: "error",
    isLoading: false,
    error: normalizeError(error),
  };
}

function normalizeError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error === null || error === undefined) {
    return "Unknown backend error";
  }

  return String(error);
}

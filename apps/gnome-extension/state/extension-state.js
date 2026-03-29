export function createInitialState() {
  return {
    status: 'idle',
    isLoading: false,
    snapshotEnvelope: null,
    schemaVersion: null,
    generatedAt: null,
    providers: [],
    lastUpdatedText: null,
    lastError: null,
    error: null,
  };
}

export function applyLoadingState(previousState = createInitialState()) {
  return {
    ...previousState,
    status: 'loading',
    isLoading: true,
    lastError: null,
    error: null,
  };
}

export function applySnapshotSuccess(
  previousState = createInitialState(),
  snapshotEnvelope,
  { lastUpdatedText = null } = {},
) {
  return {
    ...previousState,
    status: 'ready',
    isLoading: false,
    snapshotEnvelope,
    schemaVersion: snapshotEnvelope?.schema_version ?? null,
    generatedAt: snapshotEnvelope?.generated_at ?? null,
    providers: Array.isArray(snapshotEnvelope?.providers) ? snapshotEnvelope.providers : [],
    lastUpdatedText,
    lastError: null,
    error: null,
  };
}

export function applySnapshotError(previousState = createInitialState(), error) {
  return {
    ...previousState,
    status: 'error',
    isLoading: false,
    lastError: normalizeError(error),
    error: normalizeError(error),
  };
}

function normalizeError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error === null || error === undefined) {
    return 'Unknown backend error';
  }

  return String(error);
}

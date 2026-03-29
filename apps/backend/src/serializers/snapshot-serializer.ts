import { assertSnapshotEnvelope, type ProviderSnapshot, type SnapshotEnvelope } from 'shared-contract';

export interface SnapshotSerializationOptions {
  includeDiagnostics?: boolean;
}

function stripDiagnostics(snapshot: ProviderSnapshot): ProviderSnapshot {
  const { diagnostics: _ignored, ...withoutDiagnostics } = snapshot;
  return withoutDiagnostics;
}

export function serializeSnapshotEnvelope(
  envelope: SnapshotEnvelope,
  options: SnapshotSerializationOptions = {},
): SnapshotEnvelope {
  const includeDiagnostics = options.includeDiagnostics ?? false;

  const providers = envelope.providers.map((provider) => (includeDiagnostics ? provider : stripDiagnostics(provider)));

  return assertSnapshotEnvelope({
    ...envelope,
    providers,
  });
}

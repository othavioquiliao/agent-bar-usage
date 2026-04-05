import type { BackendConfig } from './config-schema.js';

export function createDefaultConfig(): Readonly<BackendConfig> {
  return {
    schemaVersion: 1,
    defaults: {
      ttlSeconds: 150,
    },
    providers: [
      {
        id: 'copilot',
        enabled: true,
        sourceMode: 'api',
      },
      {
        id: 'codex',
        enabled: true,
        sourceMode: 'auto',
      },
      {
        id: 'claude',
        enabled: true,
        sourceMode: 'auto',
      },
    ],
  };
}

import { isEnvSecretReference, type SecretReference } from './secret-reference.js';
import { SecretResolutionError, type SecretResolveContext, type SecretStore } from './secret-store.js';

export interface EnvSecretStoreOptions {
  env?: NodeJS.ProcessEnv;
}

export class EnvSecretStore implements SecretStore {
  readonly store = 'env' as const;
  readonly #defaultEnv: NodeJS.ProcessEnv;

  constructor(options: EnvSecretStoreOptions = {}) {
    this.#defaultEnv = options.env ?? process.env;
  }

  async resolve(reference: SecretReference, context: SecretResolveContext = {}): Promise<string> {
    if (!isEnvSecretReference(reference)) {
      throw new SecretResolutionError(
        'secret_store_unsupported',
        this.store,
        `EnvSecretStore cannot resolve reference type: ${reference.store}.`,
      );
    }

    const env = context.env ?? this.#defaultEnv;
    const value = env[reference.env];

    if (!value || value.trim().length === 0) {
      throw new SecretResolutionError(
        'secret_not_found',
        this.store,
        `Environment variable ${reference.env} is missing or empty.`,
      );
    }

    return value;
  }
}

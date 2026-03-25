import type { SecretReference, SecretStoreId } from "./secret-reference.js";

export type SecretResolutionErrorCode =
  | "secret_reference_invalid"
  | "secret_store_unsupported"
  | "secret_store_unavailable"
  | "secret_not_found"
  | "secret_store_failed";

export class SecretResolutionError extends Error {
  constructor(
    readonly code: SecretResolutionErrorCode,
    readonly store: SecretStoreId | "unknown",
    message: string,
    readonly retryable = false,
    readonly causeValue?: unknown,
  ) {
    super(message);
    this.name = "SecretResolutionError";
  }
}

export interface SecretResolveContext {
  env?: NodeJS.ProcessEnv;
}

export interface SecretStore {
  readonly store: SecretStoreId;
  resolve(reference: SecretReference, context?: SecretResolveContext): Promise<string>;
}

export class SecretResolver {
  readonly #stores = new Map<SecretStoreId, SecretStore>();

  constructor(stores: SecretStore[]) {
    for (const store of stores) {
      this.#stores.set(store.store, store);
    }
  }

  async resolve(reference: SecretReference, context: SecretResolveContext = {}): Promise<string> {
    const store = this.#stores.get(reference.store);

    if (!store) {
      throw new SecretResolutionError(
        "secret_store_unsupported",
        reference.store,
        `No secret store registered for ${reference.store}.`,
      );
    }

    return await store.resolve(reference, context);
  }
}

export function isSecretResolutionError(error: unknown): error is SecretResolutionError {
  return error instanceof SecretResolutionError;
}

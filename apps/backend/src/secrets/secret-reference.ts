import type { ConfigSecretReference } from '../config/config-schema.js';

export type SecretStoreId = 'secret-tool' | 'env';

export interface SecretToolReference {
  store: 'secret-tool';
  service: string;
  account: string;
}

export interface EnvSecretReference {
  store: 'env';
  env: string;
}

export type SecretReference = SecretToolReference | EnvSecretReference;

export class SecretReferenceError extends Error {
  constructor(
    readonly code: 'secret_reference_invalid' | 'secret_store_unsupported',
    message: string,
  ) {
    super(message);
    this.name = 'SecretReferenceError';
  }
}

export function toSecretReference(reference: ConfigSecretReference): SecretReference {
  switch (reference.store) {
    case 'secret-tool':
      return parseSecretToolReference(reference);
    case 'env':
      return parseEnvReference(reference);
    default:
      throw new SecretReferenceError(
        'secret_store_unsupported',
        `Unsupported secret store: ${(reference as { store?: string }).store ?? 'unknown'}.`,
      );
  }
}

export function isSecretToolReference(reference: SecretReference): reference is SecretToolReference {
  return reference.store === 'secret-tool';
}

export function isEnvSecretReference(reference: SecretReference): reference is EnvSecretReference {
  return reference.store === 'env';
}

function parseSecretToolReference(reference: ConfigSecretReference): SecretToolReference {
  if (!reference.service || !reference.account) {
    throw new SecretReferenceError(
      'secret_reference_invalid',
      'secret-tool references require both `service` and `account`.',
    );
  }

  return {
    store: 'secret-tool',
    service: reference.service,
    account: reference.account,
  };
}

function parseEnvReference(reference: ConfigSecretReference): EnvSecretReference {
  if (!reference.env) {
    throw new SecretReferenceError('secret_reference_invalid', 'env references require the `env` field.');
  }

  return {
    store: 'env',
    env: reference.env,
  };
}

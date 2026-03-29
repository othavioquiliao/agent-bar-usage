import {
  describeSubprocessFailure,
  resolveCommandInPath,
  runSubprocess,
  SubprocessError,
  type SubprocessOptions,
  type SubprocessResult,
} from '../utils/subprocess.js';
import { isSecretToolReference, type SecretReference } from './secret-reference.js';
import { SecretResolutionError, type SecretResolveContext, type SecretStore } from './secret-store.js';

export interface SecretToolStoreOptions {
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  runSubprocessFn?: (command: string, args: string[], options?: SubprocessOptions) => Promise<SubprocessResult>;
  resolveCommandInPathFn?: (command: string, env?: NodeJS.ProcessEnv) => string | null;
}

export class SecretToolStore implements SecretStore {
  readonly store = 'secret-tool' as const;
  readonly #defaultEnv: NodeJS.ProcessEnv;
  readonly #timeoutMs: number;
  readonly #runSubprocess: (command: string, args: string[], options?: SubprocessOptions) => Promise<SubprocessResult>;
  readonly #resolveCommandInPath: (command: string, env?: NodeJS.ProcessEnv) => string | null;

  constructor(options: SecretToolStoreOptions = {}) {
    this.#defaultEnv = options.env ?? process.env;
    this.#timeoutMs = options.timeoutMs ?? 10_000;
    this.#runSubprocess = options.runSubprocessFn ?? runSubprocess;
    this.#resolveCommandInPath = options.resolveCommandInPathFn ?? resolveCommandInPath;
  }

  async resolve(reference: SecretReference, context: SecretResolveContext = {}): Promise<string> {
    if (!isSecretToolReference(reference)) {
      throw new SecretResolutionError(
        'secret_store_unsupported',
        this.store,
        `SecretToolStore cannot resolve reference type: ${reference.store}.`,
      );
    }

    const env = context.env ?? this.#defaultEnv;
    const command = this.#resolveCommandInPath('secret-tool', env);

    if (!command) {
      throw new SecretResolutionError(
        'secret_store_unavailable',
        this.store,
        'secret-tool is not available on PATH for this runtime.',
      );
    }

    try {
      const result = await this.#runSubprocess(
        command,
        ['lookup', 'service', reference.service, 'account', reference.account],
        {
          env,
          timeoutMs: this.#timeoutMs,
        },
      );
      const value = result.stdout.trim();

      if (!value) {
        throw new SecretResolutionError(
          'secret_not_found',
          this.store,
          `No secret found for service=${reference.service} account=${reference.account}.`,
        );
      }

      return value;
    } catch (error) {
      if (error instanceof SecretResolutionError) {
        throw error;
      }

      if (error instanceof SubprocessError) {
        const exitCode = error.result.exitCode ?? -1;

        if (exitCode === 1) {
          throw new SecretResolutionError(
            'secret_not_found',
            this.store,
            `No secret found for service=${reference.service} account=${reference.account}.`,
            false,
            error,
          );
        }

        throw new SecretResolutionError(
          'secret_store_failed',
          this.store,
          describeSubprocessFailure(error),
          true,
          error,
        );
      }

      throw new SecretResolutionError(
        'secret_store_failed',
        this.store,
        'Secret lookup failed due to an unexpected runtime error.',
        true,
        error,
      );
    }
  }
}

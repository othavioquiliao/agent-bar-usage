import { z } from "zod";
import { providerIdSchema, providerSourceModeSchema } from "shared-contract";

export const secretStoreSchema = z.enum(["secret-tool", "env"]);

export type SecretStore = z.infer<typeof secretStoreSchema>;

export const configSecretReferenceSchema = z
  .object({
    store: secretStoreSchema.default("secret-tool"),
    service: z.string().trim().min(1).optional(),
    account: z.string().trim().min(1).optional(),
    env: z.string().trim().min(1).optional(),
  })
  .strict();

export type ConfigSecretReference = z.infer<typeof configSecretReferenceSchema>;

export const providerConfigSchema = z
  .object({
    id: providerIdSchema,
    enabled: z.boolean().default(true),
    sourceMode: providerSourceModeSchema.default("auto"),
    secretRef: configSecretReferenceSchema.optional(),
  })
  .strict();

export type ProviderConfig = z.infer<typeof providerConfigSchema>;

export const backendConfigSchema = z
  .object({
    schemaVersion: z.literal(1).default(1),
    defaults: z
      .object({
        ttlSeconds: z.coerce.number().int().positive().default(150),
      })
      .strict()
      .default({
        ttlSeconds: 150,
      }),
    providers: z.array(providerConfigSchema).default([]),
  })
  .strict();

export type BackendConfig = z.infer<typeof backendConfigSchema>;

export interface SanitizedSecretReference {
  store: SecretStore;
  configured: true;
}

export interface SanitizedProviderConfig {
  id: ProviderConfig["id"];
  enabled: boolean;
  sourceMode: ProviderConfig["sourceMode"];
  secretRef: SanitizedSecretReference | null;
}

export interface SanitizedBackendConfig {
  schemaVersion: number;
  defaults: {
    ttlSeconds: number;
  };
  providers: SanitizedProviderConfig[];
}

export function sanitizeBackendConfig(config: BackendConfig): SanitizedBackendConfig {
  return {
    schemaVersion: config.schemaVersion,
    defaults: {
      ttlSeconds: config.defaults.ttlSeconds,
    },
    providers: config.providers.map((provider) => ({
      id: provider.id,
      enabled: provider.enabled,
      sourceMode: provider.sourceMode,
      secretRef: provider.secretRef
        ? {
            store: provider.secretRef.store,
            configured: true,
          }
        : null,
    })),
  };
}

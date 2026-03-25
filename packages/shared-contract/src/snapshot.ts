import { z } from "zod";

import { providerIdSchema, sourceModeSchema } from "./request.js";

export const SNAPSHOT_SCHEMA_VERSION = "1" as const;

export const providerStatusSchema = z.enum(["ok", "degraded", "error", "unavailable"]);

export const usageSnapshotSchema = z
  .object({
    kind: z.literal("quota"),
    used: z.number().nonnegative(),
    limit: z.number().positive(),
    percent_used: z.number().min(0).max(100)
  })
  .strict();

export const resetWindowSchema = z
  .object({
    resets_at: z.string().datetime(),
    label: z.string().min(1)
  })
  .strict();

export const providerErrorSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    retryable: z.boolean()
  })
  .strict();

export const diagnosticAttemptSchema = z
  .object({
    strategy: z.string().min(1),
    available: z.boolean(),
    duration_ms: z.number().int().nonnegative(),
    error: providerErrorSchema.nullable()
  })
  .strict();

export const providerDiagnosticsSchema = z
  .object({
    attempts: z.array(diagnosticAttemptSchema)
  })
  .strict();

export const providerSnapshotSchema = z
  .object({
    provider: providerIdSchema,
    status: providerStatusSchema,
    source: sourceModeSchema,
    updated_at: z.string().datetime(),
    usage: usageSnapshotSchema.nullable(),
    reset_window: resetWindowSchema.nullable(),
    error: providerErrorSchema.nullable(),
    diagnostics: providerDiagnosticsSchema.optional()
  })
  .strict();

export const snapshotEnvelopeSchema = z
  .object({
    schema_version: z.literal(SNAPSHOT_SCHEMA_VERSION),
    generated_at: z.string().datetime(),
    providers: z.array(providerSnapshotSchema)
  })
  .strict();

export type ProviderStatus = z.infer<typeof providerStatusSchema>;
export type UsageSnapshot = z.infer<typeof usageSnapshotSchema>;
export type ResetWindow = z.infer<typeof resetWindowSchema>;
export type ProviderError = z.infer<typeof providerErrorSchema>;
export type DiagnosticAttempt = z.infer<typeof diagnosticAttemptSchema>;
export type ProviderDiagnostics = z.infer<typeof providerDiagnosticsSchema>;
export type ProviderSnapshot = z.infer<typeof providerSnapshotSchema>;
export type SnapshotEnvelope = z.infer<typeof snapshotEnvelopeSchema>;

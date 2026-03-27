import { z } from "zod";

import { providerIdSchema, providerSourceModeSchema } from "./request.js";

export const snapshotSchemaVersion = "1" as const;

export const providerStatusSchema = z.enum(["ok", "degraded", "error", "unavailable"]);

export type ProviderStatus = z.infer<typeof providerStatusSchema>;

export const providerErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
}).strict();

export type ProviderError = z.infer<typeof providerErrorSchema>;

export const usageSchema = z.object({
  kind: z.enum(["quota"]),
  used: z.number().nonnegative().nullable().optional(),
  limit: z.number().nonnegative().nullable().optional(),
  percent_used: z.number().min(0).max(100).nullable().optional(),
}).strict();

export type UsageSnapshot = z.infer<typeof usageSchema>;

export const resetWindowSchema = z.object({
  resets_at: z.string().datetime({ offset: true }),
  label: z.string(),
}).strict();

export type ResetWindow = z.infer<typeof resetWindowSchema>;

export const providerAttemptSchema = z.object({
  strategy: z.string(),
  available: z.boolean(),
  duration_ms: z.number().nonnegative().optional(),
  error: providerErrorSchema.nullable().optional(),
}).strict();

export type ProviderAttempt = z.infer<typeof providerAttemptSchema>;

export const providerDiagnosticsSchema = z.object({
  attempts: z.array(providerAttemptSchema).default([]),
}).strict();

export type ProviderDiagnostics = z.infer<typeof providerDiagnosticsSchema>;

export const providerSnapshotSchema = z.object({
  provider: providerIdSchema,
  status: providerStatusSchema,
  source: providerSourceModeSchema,
  updated_at: z.string().datetime({ offset: true }),
  usage: usageSchema.nullable().optional(),
  reset_window: resetWindowSchema.nullable().optional(),
  error: providerErrorSchema.nullable(),
  diagnostics: providerDiagnosticsSchema.optional(),
}).strict();

export type ProviderSnapshot = z.infer<typeof providerSnapshotSchema>;

export const snapshotEnvelopeSchema = z.object({
  schema_version: z.literal(snapshotSchemaVersion),
  generated_at: z.string().datetime({ offset: true }),
  providers: z.array(providerSnapshotSchema),
}).strict();

export type SnapshotEnvelope = z.infer<typeof snapshotEnvelopeSchema>;

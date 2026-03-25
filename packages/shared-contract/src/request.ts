import { z } from "zod";

export const providerIdSchema = z.enum(["copilot", "codex", "claude"]);

export type ProviderId = z.infer<typeof providerIdSchema>;

export const providerSourceModeSchema = z.enum(["auto", "cli", "oauth", "api", "web"]);

export type ProviderSourceMode = z.infer<typeof providerSourceModeSchema>;

export const backendUsageRequestSchema = z
  .object({
  providers: z.array(providerIdSchema).optional().default([]),
  source_mode_override: providerSourceModeSchema.optional().default("auto"),
  force_refresh: z.boolean().optional().default(false),
  include_diagnostics: z.boolean().optional().default(false),
  ttl_seconds: z.coerce.number().int().positive().optional().default(30),
  })
  .strict();

export const refreshRequestSchema = backendUsageRequestSchema;

export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

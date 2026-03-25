import { z } from "zod";

export const providerIdSchema = z.enum(["copilot", "codex", "claude"]);

export const sourceModeSchema = z.enum(["auto", "cli", "oauth", "api", "web"]);

export const DEFAULT_TTL_SECONDS = 30;

export const backendUsageRequestSchema = z
  .object({
    providers: z.array(providerIdSchema).min(1),
    source_mode_override: sourceModeSchema,
    force_refresh: z.boolean(),
    include_diagnostics: z.boolean(),
    ttl_seconds: z.number().int().min(0)
  })
  .strict();

export type ProviderId = z.infer<typeof providerIdSchema>;
export type SourceMode = z.infer<typeof sourceModeSchema>;
export type BackendUsageRequest = z.infer<typeof backendUsageRequestSchema>;

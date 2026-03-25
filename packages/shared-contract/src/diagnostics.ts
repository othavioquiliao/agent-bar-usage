import { z } from "zod";

export const diagnosticsCheckIdSchema = z.enum([
  "config",
  "secret-tool",
  "codex-cli",
  "claude-cli",
  "copilot-token",
  "service-runtime",
]);

export type DiagnosticsCheckId = z.infer<typeof diagnosticsCheckIdSchema>;

export const diagnosticsCheckStatusSchema = z.enum(["ok", "warn", "error"]);

export type DiagnosticsCheckStatus = z.infer<typeof diagnosticsCheckStatusSchema>;

export const diagnosticsRuntimeModeSchema = z.enum(["cli", "service", "unknown"]);

export type DiagnosticsRuntimeMode = z.infer<typeof diagnosticsRuntimeModeSchema>;

export const diagnosticsCheckDetailsSchema = z.record(z.unknown());

export type DiagnosticsCheckDetails = z.infer<typeof diagnosticsCheckDetailsSchema>;

export const diagnosticsCheckSchema = z.object({
  id: diagnosticsCheckIdSchema,
  label: z.string().min(1),
  status: diagnosticsCheckStatusSchema,
  message: z.string().min(1),
  suggested_command: z.string().min(1),
  details: diagnosticsCheckDetailsSchema.optional(),
}).strict();

export type DiagnosticsCheck = z.infer<typeof diagnosticsCheckSchema>;

export const diagnosticsReportSchema = z.object({
  generated_at: z.string().datetime(),
  runtime_mode: diagnosticsRuntimeModeSchema,
  checks: z.array(diagnosticsCheckSchema),
}).strict();

export type DiagnosticsReport = z.infer<typeof diagnosticsReportSchema>;

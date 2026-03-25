import { runSubprocess, type SubprocessResult } from "../../utils/subprocess.js";

export interface InteractiveCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
  timeoutMs?: number;
}

export async function runInteractiveCommand(
  command: string,
  args: string[] = [],
  options: InteractiveCommandOptions = {},
): Promise<SubprocessResult> {
  const scriptCommand = buildScriptCommand(command, args);

  return await runSubprocess("script", ["-qec", scriptCommand, "/dev/null"], {
    cwd: options.cwd,
    env: options.env,
    input: options.input,
    timeoutMs: options.timeoutMs,
  });
}

export function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function buildScriptCommand(command: string, args: string[]): string {
  return [command, ...args].map(shellQuote).join(" ");
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

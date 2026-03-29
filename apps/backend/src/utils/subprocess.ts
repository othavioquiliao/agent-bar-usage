import { accessSync, constants } from 'node:fs';
import path from 'node:path';

export interface SubprocessOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
  timeoutMs?: number;
}

export interface SubprocessResult {
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export class SubprocessError extends Error {
  constructor(
    message: string,
    readonly result: Omit<SubprocessResult, 'exitCode'> & { exitCode?: number },
  ) {
    super(message);
    this.name = 'SubprocessError';
  }
}

export function describeSubprocessFailure(error: SubprocessError): string {
  const exitCode = error.result.exitCode ?? 'unknown';
  const stderr = error.result.stderr.trim();

  if (stderr.length > 0) {
    return `${error.result.command} failed with exit code ${exitCode}: ${stderr}`;
  }

  return `${error.result.command} failed with exit code ${exitCode}.`;
}

export async function runSubprocess(
  command: string,
  args: string[] = [],
  options: SubprocessOptions = {},
): Promise<SubprocessResult> {
  const startedAt = Date.now();

  const proc = Bun.spawn([command, ...args], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdin: options.input ? 'pipe' : 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (options.input && proc.stdin) {
    proc.stdin.write(options.input);
    proc.stdin.flush();
    proc.stdin.end();
  }

  const timeoutMs = options.timeoutMs ?? 15_000;
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, timeoutMs);

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  clearTimeout(timeout);

  if (timedOut) {
    throw new SubprocessError(`Subprocess timed out: ${command}`, {
      command,
      args,
      stdout,
      stderr,
      durationMs: Date.now() - startedAt,
    });
  }

  const result: SubprocessResult = {
    command,
    args,
    exitCode,
    stdout,
    stderr,
    durationMs: Date.now() - startedAt,
  };

  if (result.exitCode !== 0) {
    throw new SubprocessError(`Subprocess exited with code ${result.exitCode}: ${command}`, result);
  }

  return result;
}

export function resolveCommandInPath(command: string, env: NodeJS.ProcessEnv = process.env): string | null {
  if (command.includes('/') || command.includes(path.sep)) {
    return isExecutable(command) ? command : null;
  }

  const pathValue = env.PATH ?? '';
  const segments = pathValue.split(path.delimiter);

  for (const segment of segments) {
    const candidate = path.join(segment, command);
    if (isExecutable(candidate)) {
      return candidate;
    }
  }

  return null;
}

function isExecutable(candidate: string): boolean {
  try {
    accessSync(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

import { accessSync, constants } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

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
    readonly result: Omit<SubprocessResult, "exitCode"> & { exitCode?: number },
  ) {
    super(message);
    this.name = "SubprocessError";
  }
}

export async function runSubprocess(
  command: string,
  args: string[] = [],
  options: SubprocessOptions = {},
): Promise<SubprocessResult> {
  return await new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...options.env,
      },
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      callback();
    };

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      finish(() => {
        reject(
          new SubprocessError(`Subprocess timed out: ${command}`, {
            command,
            args,
            stdout,
            stderr,
            durationMs: Date.now() - startedAt,
          }),
        );
      });
    }, options.timeoutMs ?? 15_000);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      finish(() => {
        reject(
          new SubprocessError(error.message, {
            command,
            args,
            stdout,
            stderr,
            durationMs: Date.now() - startedAt,
          }),
        );
      });
    });

    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      finish(() => {
        const result: SubprocessResult = {
          command,
          args,
          exitCode: exitCode ?? -1,
          stdout,
          stderr,
          durationMs: Date.now() - startedAt,
        };

        if (result.exitCode === 0) {
          resolve(result);
          return;
        }

        reject(new SubprocessError(`Subprocess exited with code ${result.exitCode}: ${command}`, result));
      });
    });

    if (options.input) {
      child.stdin?.write(options.input);
    }

    child.stdin?.end();
  });
}

export function resolveCommandInPath(command: string, env: NodeJS.ProcessEnv = process.env): string | null {
  if (command.includes("/") || command.includes(path.sep)) {
    return isExecutable(command) ? command : null;
  }

  const pathValue = env.PATH ?? "";
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

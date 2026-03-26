import { SubprocessError, type SubprocessResult } from "../../utils/subprocess.js";

export interface InteractiveCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
  inputDelayMs?: number;
  timeoutMs?: number;
}

export class PtyUnavailableError extends Error {
  constructor() {
    super(
      "node-pty is not available. Install build-essential and rebuild:\n" +
        "  sudo apt install build-essential python3\n" +
        "  pnpm install",
    );
    this.name = "PtyUnavailableError";
  }
}

export async function runInteractiveCommand(
  command: string,
  args: string[] = [],
  options: InteractiveCommandOptions = {},
): Promise<SubprocessResult> {
  let pty: typeof import("node-pty");
  try {
    pty = await import("node-pty");
  } catch {
    throw new PtyUnavailableError();
  }

  return await new Promise((resolve, reject) => {
    const startedAt = Date.now();
    let output = "";
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      callback();
    };

    let term: import("node-pty").IPty;
    try {
      term = pty.spawn(command, args, {
        cols: 120,
        rows: 30,
        cwd: options.cwd,
        env: {
          ...process.env,
          ...options.env,
        },
      });
    } catch (error) {
      finish(() => {
        reject(
          new SubprocessError(error instanceof Error ? error.message : `Failed to start: ${command}`, {
            command,
            args,
            stdout: output,
            stderr: "",
            durationMs: Date.now() - startedAt,
          }),
        );
      });
      return;
    }

    const timeout = setTimeout(() => {
      term.kill();
      finish(() => {
        reject(
          new SubprocessError(`Subprocess timed out: ${command}`, {
            command,
            args,
            stdout: output,
            stderr: "",
            durationMs: Date.now() - startedAt,
          }),
        );
      });
    }, options.timeoutMs ?? 15_000);

    term.onData((chunk) => {
      output += chunk;
    });

    const input = options.input;
    if (input) {
      setTimeout(() => {
        if (!settled) {
          term.write(input);
        }
      }, options.inputDelayMs ?? 200);
    }

    term.onExit(({ exitCode }) => {
      clearTimeout(timeout);
      finish(() => {
        const result: SubprocessResult = {
          command,
          args,
          exitCode,
          stdout: output,
          stderr: "",
          durationMs: Date.now() - startedAt,
        };

        if (result.exitCode === 0) {
          resolve(result);
          return;
        }

        reject(new SubprocessError(`Subprocess exited with code ${result.exitCode}: ${command}`, result));
      });
    });
  });
}

export function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

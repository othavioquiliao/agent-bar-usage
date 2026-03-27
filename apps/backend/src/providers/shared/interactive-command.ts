import { SubprocessError, type SubprocessResult } from "../../utils/subprocess.js";

export interface InteractiveCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
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
  // Dynamic import: if node-pty failed to compile, give a clear error
  let pty: typeof import("node-pty");
  try {
    pty = await import("node-pty");
  } catch {
    throw new PtyUnavailableError();
  }

  return new Promise<SubprocessResult>((resolve, reject) => {
    const startedAt = Date.now();
    let output = "";
    let settled = false;

    const term = pty.spawn(command, args, {
      cols: 120,
      rows: 30,
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
    });

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      callback();
    };

    term.onData((chunk: string) => {
      output += chunk;
    });

    const timeout = setTimeout(() => {
      term.kill();
      finish(() =>
        reject(
          new SubprocessError(`Subprocess timed out: ${command}`, {
            command,
            args,
            stdout: output,
            stderr: "",
            durationMs: Date.now() - startedAt,
          }),
        ),
      );
    }, options.timeoutMs ?? 15_000);

    // Delay input: CLI needs time to initialize its prompt before accepting input
    if (options.input) {
      setTimeout(() => {
        if (!settled) {
          term.write(options.input!);
        }
      }, 200);
    }

    term.onExit(({ exitCode }) => {
      clearTimeout(timeout);
      finish(() =>
        resolve({
          command,
          args,
          exitCode,
          stdout: output,
          stderr: "",
          durationMs: Date.now() - startedAt,
        }),
      );
    });
  });
}

// Keep these unchanged — used by all parsers
export function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

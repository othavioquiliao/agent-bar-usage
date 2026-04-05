import { SubprocessError, type SubprocessResult } from '../../utils/subprocess.js';

export interface InteractiveCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
  timeoutMs?: number;
}

/**
 * @deprecated Bun.Terminal is always available -- this error is kept only for
 * backward compatibility with provider error-handling branches that catch it.
 */
export class PtyUnavailableError extends Error {
  constructor(message = 'PTY is not available.') {
    super(message);
    this.name = 'PtyUnavailableError';
  }
}

// biome-ignore lint/complexity/useRegexLiterals: RegExp constructor avoids the ANSI escape false positive from noControlCharactersInRegex.
const ANSI_ESCAPE_PATTERN = new RegExp(String.raw`\u001b\[[0-9;?]*[ -/]*[@-~]`, 'g');

export async function runInteractiveCommand(
  command: string,
  args: string[] = [],
  options: InteractiveCommandOptions = {},
): Promise<SubprocessResult> {
  const startedAt = Date.now();
  let output = '';
  let settled = false;

  const proc = Bun.spawn([command, ...args], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    terminal: {
      cols: 120,
      rows: 30,
      data(_terminal, data) {
        output += data.toString();
      },
    },
  });

  // Delay input: CLI needs time to initialize its prompt before accepting input
  if (options.input) {
    const inputText = options.input;
    setTimeout(() => {
      if (!settled) {
        proc.terminal?.write(inputText);
      }
    }, 200);
  }

  const timeoutMs = options.timeoutMs ?? 15_000;
  const timeout = setTimeout(() => {
    settled = true;
    proc.kill();
  }, timeoutMs);

  const exitCode = await proc.exited;
  clearTimeout(timeout);

  if (settled) {
    // Timeout was reached
    throw new SubprocessError(`Subprocess timed out: ${command}`, {
      command,
      args,
      stdout: output,
      stderr: '',
      durationMs: Date.now() - startedAt,
    });
  }

  settled = true;

  return {
    command,
    args,
    exitCode,
    stdout: output,
    stderr: '',
    durationMs: Date.now() - startedAt,
  };
}

// Keep these unchanged -- used by all parsers
export function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE_PATTERN, '');
}

export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

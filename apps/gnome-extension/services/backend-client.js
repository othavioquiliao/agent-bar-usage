import { parseStrictJson } from "../utils/json.js";
import { resolveBackendInvocation } from "../utils/backend-command.js";

export class BackendClientError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "BackendClientError";
    this.cause = details.cause ?? null;
    this.argv = details.argv ?? null;
    this.cwd = details.cwd ?? null;
    this.exitCode = details.exitCode ?? null;
    this.stdout = details.stdout ?? "";
    this.stderr = details.stderr ?? "";
    this.mode = details.mode ?? null;
  }
}

function normalizeCommunicateResult(subprocess, finished) {
  let stdout = "";
  let stderr = "";

  if (Array.isArray(finished)) {
    if (typeof finished[0] === "boolean") {
      stdout = finished[1] ?? "";
      stderr = finished[2] ?? "";
    } else {
      stdout = finished[0] ?? "";
      stderr = finished[1] ?? "";
    }
  }

  return {
    stdout,
    stderr,
    success: typeof subprocess.get_successful === "function" ? subprocess.get_successful() : true,
    exitCode:
      typeof subprocess.get_if_exited === "function" && subprocess.get_if_exited() && typeof subprocess.get_exit_status === "function"
        ? subprocess.get_exit_status()
        : null,
  };
}

async function runGioSubprocess(argv, { Gio, cwd } = {}) {
  if (!Gio?.SubprocessLauncher) {
    throw new Error("Gio.SubprocessLauncher is required to invoke the backend.");
  }

  const launcher = new Gio.SubprocessLauncher({
    flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
  });

  if (cwd) {
    launcher.set_cwd(cwd);
  }

  const subprocess = launcher.spawnv(argv);

  const result = await new Promise((resolve, reject) => {
    subprocess.communicate_utf8_async(null, null, (proc, asyncResult) => {
      try {
        resolve(normalizeCommunicateResult(proc, proc.communicate_utf8_finish(asyncResult)));
      } catch (error) {
        reject(error);
      }
    });
  });

  return {
    argv,
    cwd,
    ...result,
  };
}

function createFailureError(invocation, result = {}) {
  const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";
  const exitCode = result.exitCode ?? null;
  const message = stderr
    ? `Backend command failed${typeof exitCode === "number" ? ` (exit ${exitCode})` : ""}: ${stderr}`
    : `Backend command failed${typeof exitCode === "number" ? ` (exit ${exitCode})` : ""}`;

  return new BackendClientError(message, {
    argv: invocation.argv,
    cwd: invocation.cwd,
    exitCode,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    mode: invocation.mode,
  });
}

export function createBackendClient(dependencies = {}) {
  const runCommand =
    dependencies.runCommand ?? ((argv, options = {}) => runGioSubprocess(argv, { Gio: dependencies.Gio, ...options }));
  const commandDependencies = {
    findProgramInPath: dependencies.findProgramInPath,
    repoRoot: dependencies.repoRoot,
    backendPackageRoot: dependencies.backendPackageRoot,
    nodeBinary: dependencies.nodeBinary,
    agentBarCwd: dependencies.agentBarCwd,
  };

  return {
    async fetchUsageSnapshot(options = {}) {
      const invocation = resolveBackendInvocation(options, commandDependencies);
      let result;
      try {
        result = await runCommand(invocation.argv, {
          cwd: invocation.cwd,
          Gio: dependencies.Gio,
          mode: invocation.mode,
        });
      } catch (spawnError) {
        console.error(`[agent-bar] Subprocess spawn failed (mode=${invocation.mode}): ${spawnError?.message ?? spawnError}`);
        console.error(`[agent-bar]   argv: ${invocation.argv.join(" ")}`);
        console.error(`[agent-bar]   cwd: ${invocation.cwd ?? "none"}`);
        throw new BackendClientError(`Subprocess spawn failed: ${spawnError?.message ?? spawnError}`, {
          argv: invocation.argv,
          cwd: invocation.cwd,
          mode: invocation.mode,
          cause: spawnError,
        });
      }

      if (!result?.success) {
        console.error(`[agent-bar] Backend command failed (mode=${invocation.mode}, exit=${result?.exitCode ?? "?"})`);
        console.error(`[agent-bar]   argv: ${invocation.argv.join(" ")}`);
        console.error(`[agent-bar]   stderr: ${result?.stderr?.trim() || "none"}`);
        throw createFailureError(invocation, result);
      }

      return parseStrictJson(result.stdout ?? "", "backend stdout");
    },
  };
}


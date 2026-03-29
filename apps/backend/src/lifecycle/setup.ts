/**
 * `agent-bar setup` -- Interactive setup command.
 *
 * Replaces the bash install script with a guided TypeScript flow:
 *  1. Dependency check (Bun is critical, others warn)
 *  2. CLI wrapper creation (~/.local/bin/agent-bar)
 *  3. Systemd service + env override
 *  4. tmpfiles.d configuration
 *  5. systemctl daemon-reload, enable, restart
 *  6. GNOME extension copy + enable
 *  7. PATH warning if ~/.local/bin is not in PATH
 */

import { dirname, join, resolve } from "node:path";
import {
  mkdirSync as fsMkdirSync,
  unlinkSync as fsUnlinkSync,
  cpSync as fsCpSync,
  writeFileSync as fsWriteFileSync,
  existsSync as fsExistsSync,
} from "node:fs";
import * as p from "@clack/prompts";

import { runSubprocess } from "../utils/subprocess.js";
import { checkDependencies } from "./dependency-check.js";
import {
  getInstallPaths,
  REPO_ROOT,
  EXT_ITEMS,
  ENV_VARS_TO_CAPTURE,
  APP_NAME,
  GNOME_EXT_UUID,
} from "./paths.js";

// MARK: - Dependency injection

export interface SetupDependencies {
  runSubprocessFn?: typeof runSubprocess;
  checkDependenciesFn?: typeof checkDependencies;
  mkdirSyncFn?: typeof fsMkdirSync;
  unlinkSyncFn?: typeof fsUnlinkSync;
  cpSyncFn?: typeof fsCpSync;
  writeFileSyncFn?: typeof fsWriteFileSync;
  existsSyncFn?: typeof fsExistsSync;
  resolveFn?: typeof resolve;
}

// MARK: - Setup flow

export async function runSetup(deps?: SetupDependencies): Promise<void> {
  const run = deps?.runSubprocessFn ?? runSubprocess;
  const checkDeps = deps?.checkDependenciesFn ?? checkDependencies;
  const mkdirSync = deps?.mkdirSyncFn ?? fsMkdirSync;
  const unlinkSync = deps?.unlinkSyncFn ?? fsUnlinkSync;
  const cpSync = deps?.cpSyncFn ?? fsCpSync;
  const writeFileSync = deps?.writeFileSyncFn ?? fsWriteFileSync;
  const resolvePath = deps?.resolveFn ?? resolve;

  console.clear();
  p.intro(`${APP_NAME} setup`);

  // Step 1: Dependency check
  const { missing } = checkDeps();

  if (missing.length > 0) {
    const lines = missing.map(
      (dep) => `  - ${dep.name}: ${dep.installHint}`,
    );
    p.note(lines.join("\n"), "Missing dependencies");

    const hasBun = missing.some((dep) => dep.name === "Bun");
    if (hasBun) {
      p.outro("Setup cannot continue without Bun");
      return;
    }

    // Non-critical deps (secret-tool, gnome-extensions): warn but continue
    p.log.warn("Some optional dependencies are missing. Setup will continue.");
  }

  // Step 2: Explain what setup will do
  p.note(
    [
      "This will:",
      `  1. Create ~/.local/bin/${APP_NAME} CLI wrapper`,
      "  2. Install systemd user service + env override",
      "  3. Copy GNOME extension + enable it",
      "  4. Configure tmpfiles.d for runtime socket",
    ].join("\n"),
    "Setup plan",
  );

  // Step 3: Confirm
  const proceed = await p.confirm({
    message: "Apply setup now?",
    initialValue: true,
  });

  if (p.isCancel(proceed) || !proceed) {
    p.outro("Setup cancelled");
    return;
  }

  const paths = getInstallPaths();
  const s = p.spinner();

  try {
    // Step 4: CLI wrapper
    s.start("Creating CLI wrapper...");
    mkdirSync(dirname(paths.cliSymlink), { recursive: true });
    try {
      unlinkSync(paths.cliSymlink);
    } catch {
      // File may not exist yet -- safe to ignore
    }
    const cliEntry = join(REPO_ROOT, "apps", "backend", "src", "cli.ts");
    const wrapperContent = [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      `exec bun "${cliEntry}" "$@"`,
      "",
    ].join("\n");
    writeFileSync(paths.cliSymlink, wrapperContent, { mode: 0o755 });
    s.stop("CLI wrapper created");

    // Step 5: Systemd service
    s.start("Installing systemd service...");
    mkdirSync(paths.systemdDir, { recursive: true });
    cpSync(
      join(REPO_ROOT, "packaging", "systemd", "user", "agent-bar.service"),
      paths.serviceFile,
    );
    mkdirSync(paths.overrideDir, { recursive: true });
    const envLines = ["[Service]"];
    for (const varName of ENV_VARS_TO_CAPTURE) {
      const value = process.env[varName];
      if (value) {
        envLines.push(`Environment=${varName}=${value}`);
      }
    }
    envLines.push("");
    writeFileSync(paths.envOverride, envLines.join("\n"));
    s.stop("Systemd service installed");

    // Step 6: tmpfiles.d
    s.start("Configuring tmpfiles.d...");
    mkdirSync(paths.tmpfilesDir, { recursive: true });
    cpSync(
      join(REPO_ROOT, "packaging", "tmpfiles.d", "agent-bar.conf"),
      paths.tmpfilesConf,
    );
    try {
      await run("systemd-tmpfiles", ["--user", "--create", paths.tmpfilesConf]);
    } catch {
      // Best-effort -- may not be available on all systems
    }
    s.stop("tmpfiles.d configured");

    // Step 7: systemctl reload + enable + restart
    s.start("Enabling systemd service...");
    try {
      await run("systemctl", ["--user", "daemon-reload"]);
      await run("systemctl", ["--user", "enable", "agent-bar.service"]);
      await run("systemctl", ["--user", "restart", "agent-bar.service"]);
    } catch {
      p.log.warn(
        "systemctl commands failed -- service may need manual start",
      );
    }
    s.stop("Systemd service enabled and started");

    // Step 8: GNOME extension
    s.start("Installing GNOME extension...");
    mkdirSync(paths.extensionDir, { recursive: true });
    for (const item of EXT_ITEMS) {
      try {
        cpSync(
          join(REPO_ROOT, "apps", "gnome-extension", item),
          join(paths.extensionDir, item),
          { recursive: true },
        );
      } catch {
        // Skip items that don't exist in the source
      }
    }
    try {
      await run("gnome-extensions", ["enable", GNOME_EXT_UUID]);
    } catch {
      p.log.warn(
        "Could not enable GNOME extension automatically. Enable it manually in Extensions app.",
      );
    }
    s.stop("GNOME extension installed");

    // Step 9: PATH warning
    const localBin = dirname(paths.cliSymlink);
    const pathDirs = (process.env.PATH ?? "").split(":");
    if (!pathDirs.some((d) => resolvePath(d) === resolvePath(localBin))) {
      p.log.warn(
        '~/.local/bin is not in your PATH. Add: export PATH="$HOME/.local/bin:$PATH"',
      );
    }

    p.outro("Setup complete");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    p.outro(`Setup failed: ${message}`);
    process.exitCode = 1;
  }
}

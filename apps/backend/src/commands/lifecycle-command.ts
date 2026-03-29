/**
 * Commander registration for all lifecycle commands: setup, update, remove, uninstall.
 *
 * Thin action wrappers -- all logic lives in lifecycle/*.ts files.
 * Uses process.exitCode (not process.exit) matching auth-command.ts convention.
 */

import type { Command } from "commander";
import { runSetup } from "../lifecycle/setup.js";
import { runUpdate } from "../lifecycle/update.js";
import { runRemove } from "../lifecycle/remove.js";
import { runUninstall } from "../lifecycle/uninstall.js";

export function registerLifecycleCommands(program: Command): void {
  program
    .command("setup")
    .description("Install Agent Bar: CLI symlink, systemd service, GNOME extension.")
    .action(async () => {
      try {
        await runSetup();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`\nSetup error: ${message}\n`);
        process.exitCode = 1;
      }
    });

  program
    .command("update")
    .description("Update Agent Bar: pull latest, rebuild, restart service.")
    .action(async () => {
      try {
        await runUpdate();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`\nUpdate error: ${message}\n`);
        process.exitCode = 1;
      }
    });

  program
    .command("remove")
    .description("Remove installed files (preserves secrets and settings).")
    .action(async () => {
      try {
        await runRemove();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`\nRemove error: ${message}\n`);
        process.exitCode = 1;
      }
    });

  program
    .command("uninstall")
    .description("Fully uninstall Agent Bar including secrets and settings.")
    .action(async () => {
      try {
        await runUninstall();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`\nUninstall error: ${message}\n`);
        process.exitCode = 1;
      }
    });
}

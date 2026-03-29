/**
 * `agent-bar remove` -- Quick removal that preserves secrets and settings.
 *
 * Thin wrapper around runUninstall with:
 *  - force: true (no confirmation prompt)
 *  - preserveSecrets: true (keep GNOME Keyring secrets for reinstall)
 *  - preserveSettings: true (keep settings.json and cache)
 */

import { APP_NAME } from "./paths.js";
import { runUninstall } from "./uninstall.js";

export async function runRemove(): Promise<void> {
  await runUninstall({
    force: true,
    title: `${APP_NAME} remove`,
    preserveSecrets: true,
    preserveSettings: true,
  });
}

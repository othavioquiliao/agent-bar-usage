import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const vitestEntrypoint = resolve(projectRoot, "node_modules/vitest/vitest.mjs");
const forwardedArgs = process.argv.slice(2).filter((arg) => arg !== "--");

const result = spawnSync(
  process.execPath,
  [vitestEntrypoint, "run", "--config", "vitest.config.ts", ...forwardedArgs],
  {
    cwd: projectRoot,
    stdio: "inherit",
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);

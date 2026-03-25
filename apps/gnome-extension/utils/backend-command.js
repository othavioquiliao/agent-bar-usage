const BACKEND_CLI_RELATIVE_PATH = "apps/backend/src/cli.ts";

function normalizePath(value) {
  return value.replace(/\/+$/, "");
}

function joinPath(...parts) {
  return parts.filter(Boolean).join("/").replace(/\/+/g, "/");
}

export function resolveRepoRoot(baseUrl = import.meta.url) {
  return normalizePath(decodeURIComponent(new URL("../../..", baseUrl).pathname));
}

export function buildBackendUsageArgs({ provider = null, forceRefresh = false } = {}) {
  const args = ["usage", "--json"];

  if (provider) {
    args.push("--provider", provider);
  }

  if (forceRefresh) {
    args.push("--refresh");
  }

  return args;
}

export function resolveBackendInvocation(options = {}, dependencies = {}) {
  const findProgramInPath = dependencies.findProgramInPath ?? (() => null);
  const repoRoot = normalizePath(dependencies.repoRoot ?? resolveRepoRoot());
  const backendPackageRoot = normalizePath(
    dependencies.backendPackageRoot ?? joinPath(repoRoot, "apps", "backend"),
  );
  const agentBarBinary = findProgramInPath("agent-bar");
  const nodeBinary = dependencies.nodeBinary ?? findProgramInPath("node") ?? "node";
  const usageArgs = buildBackendUsageArgs(options);

  if (agentBarBinary) {
    return {
      argv: [agentBarBinary, ...usageArgs],
      cwd: dependencies.agentBarCwd ?? repoRoot,
      binary: agentBarBinary,
      mode: "installed",
    };
  }

  return {
    argv: [nodeBinary, "--import", "tsx", joinPath(repoRoot, BACKEND_CLI_RELATIVE_PATH), ...usageArgs],
    cwd: backendPackageRoot,
    binary: nodeBinary,
    mode: "workspace-dev",
  };
}

export function resolveBackendCommand(options = {}, dependencies = {}) {
  return resolveBackendInvocation(options, dependencies).argv;
}

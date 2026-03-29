const BACKEND_CLI_RELATIVE_PATH = 'apps/backend/src/cli.ts';

function normalizePath(value) {
  return value.replace(/\/+$/, '');
}

function joinPath(...parts) {
  return parts.filter(Boolean).join('/').replace(/\/+/g, '/');
}

export function resolveRepoRoot(baseUrl = import.meta.url) {
  // GJS (GNOME Shell) does not have the URL global.
  // import.meta.url is a file:// URI — strip the scheme and walk up directories.
  let filePath = baseUrl.startsWith('file://') ? baseUrl.slice(7) : baseUrl;
  filePath = decodeURIComponent(filePath);
  // Remove filename first, then walk up 3 dirs: utils/ → gnome-extension/ → apps/ → repo root
  for (let i = 0; i < 4; i++) {
    const lastSlash = filePath.lastIndexOf('/');
    if (lastSlash > 0) filePath = filePath.slice(0, lastSlash);
  }
  return normalizePath(filePath);
}

export function buildBackendUsageArgs({ provider = null, forceRefresh = false } = {}) {
  const args = ['usage', '--json', '--diagnostics'];

  if (provider) {
    args.push('--provider', provider);
  }

  if (forceRefresh) {
    args.push('--refresh');
  }

  return args;
}

export function buildBackendServiceArgs({ provider = null, forceRefresh = false } = {}) {
  const args = ['service', forceRefresh ? 'refresh' : 'snapshot', '--json'];

  if (provider) {
    args.push('--provider', provider);
  }

  return args;
}

export function resolveBackendInvocation(options = {}, dependencies = {}) {
  const findProgramInPath = dependencies.findProgramInPath ?? (() => null);
  const repoRoot = normalizePath(dependencies.repoRoot ?? resolveRepoRoot());
  const backendPackageRoot = normalizePath(dependencies.backendPackageRoot ?? joinPath(repoRoot, 'apps', 'backend'));
  const agentBarBinary = findProgramInPath('agent-bar');
  const nodeBinary = dependencies.nodeBinary ?? findProgramInPath('node') ?? 'node';

  if (agentBarBinary) {
    return {
      argv: [agentBarBinary, ...buildBackendServiceArgs(options)],
      cwd: dependencies.agentBarCwd ?? repoRoot,
      binary: agentBarBinary,
      mode: 'installed',
    };
  }

  return {
    argv: [
      nodeBinary,
      '--import',
      'tsx',
      joinPath(repoRoot, BACKEND_CLI_RELATIVE_PATH),
      ...buildBackendUsageArgs(options),
    ],
    cwd: backendPackageRoot,
    binary: nodeBinary,
    mode: 'workspace-dev',
  };
}

export function resolveBackendCommand(options = {}, dependencies = {}) {
  return resolveBackendInvocation(options, dependencies).argv;
}

import { resolveCommandInPath } from '../utils/subprocess.js';

export interface DependencyCheck {
  name: string;
  command: string;
  installHint: string;
}

export const REQUIRED_DEPS: DependencyCheck[] = [
  {
    name: 'Bun',
    command: 'bun',
    installHint: 'curl -fsSL https://bun.sh/install | bash',
  },
  {
    name: 'secret-tool',
    command: 'secret-tool',
    installHint: 'sudo apt install libsecret-tools',
  },
  {
    name: 'gnome-extensions',
    command: 'gnome-extensions',
    installHint: 'sudo apt install gnome-shell-extensions',
  },
];

export function checkDependencies(resolveFn: typeof resolveCommandInPath = resolveCommandInPath): {
  missing: DependencyCheck[];
} {
  const missing = REQUIRED_DEPS.filter((dep) => resolveFn(dep.command) === null);
  return { missing };
}

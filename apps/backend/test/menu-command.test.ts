import { describe, expect, it, vi } from 'vitest';

import { buildMenuOptions, runMenuCommand } from '../src/commands/menu-command.js';

describe('menu command', () => {
  it('exposes the expected top-level actions', () => {
    expect(buildMenuOptions().map((option) => option.value)).toEqual(['list', 'providers', 'login', 'doctor']);
  });

  it('routes each menu action to the injected handler', async () => {
    const outputs: string[] = [];
    const showListAll = vi.fn(async () => 'list output');
    const runProvidersCommandFn = vi.fn(async () => 'providers output');
    const runProviderLoginMenuFn = vi.fn(async () => {});
    const runDoctorCommandFn = vi.fn(async () => 'doctor output');
    const actionSequence = ['list', 'providers', 'login', 'doctor', '__cancel__'] as const;
    let index = 0;

    await runMenuCommand({
      clearScreen: () => {},
      intro: () => {},
      note: () => {},
      outro: () => {},
      isCancel: (value) => value === '__cancel__',
      selectAction: async () => actionSequence[index++] as never,
      writeStdout: (text) => {
        outputs.push(text);
      },
      showListAll,
      runProvidersCommandFn,
      runProviderLoginMenuFn,
      runDoctorCommandFn,
    });

    expect(showListAll).toHaveBeenCalledTimes(1);
    expect(runProvidersCommandFn).toHaveBeenCalledTimes(1);
    expect(runProviderLoginMenuFn).toHaveBeenCalledTimes(1);
    expect(runDoctorCommandFn).toHaveBeenCalledTimes(1);
    expect(outputs.join('')).toContain('list output');
    expect(outputs.join('')).toContain('providers output');
    expect(outputs.join('')).toContain('doctor output');
  });
});

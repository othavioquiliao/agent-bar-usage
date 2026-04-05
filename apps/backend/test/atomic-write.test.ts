import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { atomicWriteFileSync } from '../src/utils/atomic-write.js';

describe('atomicWriteFileSync', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'atomic-write-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes correct content to the target file path', () => {
    const filePath = path.join(tmpDir, 'output.json');

    atomicWriteFileSync(filePath, '{"hello":"world"}\n');

    expect(readFileSync(filePath, 'utf8')).toBe('{"hello":"world"}\n');
  });

  it('overwrites existing file content atomically', () => {
    const filePath = path.join(tmpDir, 'output.json');
    writeFileSync(filePath, 'original content', 'utf8');

    atomicWriteFileSync(filePath, 'new content');

    expect(readFileSync(filePath, 'utf8')).toBe('new content');
  });

  it('does not leave a temp file behind on success', () => {
    const filePath = path.join(tmpDir, 'output.json');
    const tmpPath = `${filePath}.${process.pid}.tmp`;

    atomicWriteFileSync(filePath, 'data');

    expect(existsSync(tmpPath)).toBe(false);
    expect(existsSync(filePath)).toBe(true);
  });

  it('cleans up temp file and re-throws when target directory does not exist', () => {
    const filePath = path.join(tmpDir, 'nonexistent', 'deep', 'output.json');
    const tmpPath = `${filePath}.${process.pid}.tmp`;

    expect(() => atomicWriteFileSync(filePath, 'data')).toThrow();
    expect(existsSync(tmpPath)).toBe(false);
  });

  it('preserves original file if write to temp path fails (read-only dir simulation)', () => {
    const filePath = path.join(tmpDir, 'existing.json');
    const originalContent = '{"original":true}\n';
    writeFileSync(filePath, originalContent, 'utf8');

    // Write to a path where the temp file cannot be created (nonexistent parent)
    const badPath = path.join(tmpDir, 'no-such-dir', 'file.json');
    expect(() => atomicWriteFileSync(badPath, 'new data')).toThrow();

    // Original file is untouched
    expect(readFileSync(filePath, 'utf8')).toBe(originalContent);
  });
});

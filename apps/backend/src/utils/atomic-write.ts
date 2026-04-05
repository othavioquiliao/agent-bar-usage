import { renameSync, unlinkSync, writeFileSync } from 'node:fs';

/**
 * Write data to a file atomically via temp-file + rename.
 *
 * Writes to `${filePath}.${process.pid}.tmp` first, then renames to the
 * final path. If either step fails, the temp file is cleaned up (best-effort)
 * and the original error is re-thrown.
 *
 * Callers are responsible for ensuring the parent directory exists.
 */
export function atomicWriteFileSync(filePath: string, data: string): void {
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  try {
    writeFileSync(tmpPath, data, 'utf8');
    renameSync(tmpPath, filePath);
  } catch (error) {
    try {
      unlinkSync(tmpPath);
    } catch {
      // Cleanup best-effort — temp file may not have been created
    }
    throw error;
  }
}

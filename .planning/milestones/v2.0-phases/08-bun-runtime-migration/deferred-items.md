# Phase 08: Deferred Items

## From 08-02 (Subprocess Migration to Bun.spawn)

1. **prerequisite-checks.ts still imports node-pty** -- `src/core/prerequisite-checks.ts:177` has `await import("node-pty")` as a prerequisite check. This check is now invalid since Bun.Terminal replaces node-pty. The check and its test assertion in `test/prerequisite-checks.test.ts:53` need to be updated or removed. Discovered during task 2 verification.

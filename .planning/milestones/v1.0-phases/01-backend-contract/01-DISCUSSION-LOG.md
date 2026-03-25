# Phase 1: Backend Contract - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 1-Backend Contract
**Areas discussed:** Backend shape, Output contract, Snapshot schema, Refresh behavior

---

## Backend shape

| Option | Description | Selected |
|--------|-------------|----------|
| CLI-first, stateless, daemon-ready | Canonical backend entrypoint is a command/bin interface now; internals stay ready for a daemon later | ✓ |
| Daemon since day one | Backend starts as a local service with state/cache immediately | |
| Hybrid complete in phase 1 | Deliver CLI and daemon together in this phase | |

**User's choice:** CLI-first, stateless, daemon-ready
**Notes:** Keep the public contract daemon-ready even though the first implementation boundary is CLI-first.

---

## Output contract

| Option | Description | Selected |
|--------|-------------|----------|
| JSON-first | JSON is the real API; text output is secondary | |
| Dual first-class | JSON and human-readable output both matter from the beginning | ✓ |
| Text-first | Human CLI experience first; JSON later | |

**User's choice:** Dual first-class
**Notes:** Human-readable output should not be treated as a debug-only side channel.

---

## Snapshot schema

| Option | Description | Selected |
|--------|-------------|----------|
| Rich controlled | Usage summary, source, updated_at, structured error, reset window when available, optional diagnostics block | ✓ |
| Minimal | Status/usage/source/error/updated_at only | |
| Always full diagnostics | Fetch attempts, timings, and deeper details always present in the main payload | |

**User's choice:** Rich controlled
**Notes:** Keep diagnostics available, but structured and optional rather than noisy by default.

---

## Refresh behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Short cache + forced refresh | Normal reads may reuse a short TTL; explicit refresh bypasses cache | ✓ |
| Always fresh | Every read triggers a real fetch | |
| Cache/manual only | Read cached snapshots unless the user manually refreshes | |

**User's choice:** Short cache + forced refresh
**Notes:** Backend should support fast repeated reads without giving up an explicit hard refresh path.

---

## the agent's Discretion

- Exact field names and nesting for the JSON payload
- Exact TTL value for the short cache
- Exact human-readable output formatting

## Deferred Ideas

None.

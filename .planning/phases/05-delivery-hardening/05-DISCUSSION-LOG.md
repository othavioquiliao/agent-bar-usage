# Phase 5: Delivery & Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25T17:23:51Z
**Phase:** 5-Delivery & Hardening
**Areas discussed:** Diagnostics Surface, Installation and Delivery, Runtime Model, Independent Debugging

---

## Diagnostics Surface

| Option | Description | Selected |
|--------|-------------|----------|
| A | Only CLI and runbook guidance | |
| B | CLI plus an explicit diagnostics/failure surface in the GNOME extension | ✓ |
| C | Another direction | |

**User's choice:** B
**Notes:** Diagnostics should not stay terminal-only; the desktop surface should also help explain missing prerequisites and runtime failures.

---

## Installation and Delivery

| Option | Description | Selected |
|--------|-------------|----------|
| A | Manual setup, but fully documented | |
| B | Script-assisted installation/setup flow | ✓ |
| C | More release-like packaging/distribution first | |

**User's choice:** B
**Notes:** Delivery should center on a supported script path instead of doc-only setup, while still documenting the flow.

---

## Runtime Model

| Option | Description | Selected |
|--------|-------------|----------|
| A | Keep the current on-demand subprocess model | |
| B | Add a local service as an optional path | |
| C | Introduce a local backend service in this phase | ✓ |

**User's choice:** C
**Notes:** Hardening should include moving beyond subprocess-only runtime behavior and bringing service/autostart concerns into Phase 5.

---

## Independent Debugging

| Option | Description | Selected |
|--------|-------------|----------|
| A | Minimal separate smoke/debug commands for backend and extension | ✓ |
| B | Stronger dev workflow with fixtures/log plumbing | |
| C | Another direction | |

**User's choice:** A
**Notes:** Debuggability should stay lightweight; explicit commands are enough for this phase.

---

## the agent's Discretion

- Exact service/autostart mechanism
- Exact diagnostics command naming and output shape
- Exact install script layout and packaging handoff
- Exact GNOME UI affordance for diagnostics

## Deferred Ideas

None.

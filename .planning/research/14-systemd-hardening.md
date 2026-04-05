# Phase 14: systemd User Service Hardening - Research

**Researched:** 2026-04-05
**Domain:** systemd user service configuration, cgroup v2 resource control, journal integration
**Confidence:** HIGH
**Target platform:** Ubuntu 24.04 LTS (systemd 255.4, cgroup v2 unified hierarchy)

## Summary

This research answers five specific questions about the systemd user service hardening directives decided in CONTEXT.md (D-06 through D-11). All findings are verified against official systemd documentation (Ubuntu Noble man pages) and cross-referenced with upstream sources.

The most critical finding is **directive placement**: `StartLimitBurst` and `StartLimitIntervalSec` MUST go in `[Unit]`, not `[Service]`. Placing them in `[Service]` causes systemd to emit a warning and silently ignore them -- the single most common misconfiguration in systemd service files.

**Primary recommendation:** Apply the exact service file template in the Code Examples section. All directives are verified for correct section placement and user-service compatibility.

---

## 1. Directive Placement: `[Unit]` vs `[Service]`

### StartLimitBurst and StartLimitIntervalSec -- MUST be in `[Unit]`

**Confidence:** HIGH

These directives belong in `[Unit]`, not `[Service]`. This was changed in systemd 230 (2016) when they were moved from `systemd.service(5)` to `systemd.unit(5)`. [VERIFIED: Ubuntu Noble man page for systemd.unit.5]

**What happens if you put them in `[Service]`:**
- systemd logs: `Unknown lvalue 'StartLimitIntervalSec' in section 'Service', ignoring.`
- The directives are silently ignored -- the service has NO rate limiting. [VERIFIED: HashiCorp KB article, Red Hat KB article]

**Historical confusion:** Older documentation (Debian Jessie, pre-systemd 230) documented these in `[Service]`. Many tutorials and StackOverflow answers still show the old placement. [CITED: https://support.hashicorp.com/hc/en-us/articles/4406120244755]

**Also note:** The old name `StartLimitInterval=` (without `Sec`) is deprecated. Use `StartLimitIntervalSec=` on systemd 230+. Ubuntu 24.04 ships systemd 255, so the new names are correct. [VERIFIED: Ubuntu 24.04 ships systemd 255.4]

### Resource control directives -- go in `[Service]`

`MemoryHigh`, `MemoryMax`, `TasksMax`, `Nice` are all resource-control or exec directives and belong in `[Service]`. [VERIFIED: Ubuntu Noble man page for systemd.resource-control.5 lists applicable section types as Slice, Scope, Service, Socket, Mount, Swap]

### Timeout directives -- go in `[Service]`

`TimeoutStartSec`, `TimeoutStopSec` are service-specific directives in `[Service]`. [VERIFIED: these are documented in systemd.service(5)]

### Journal directives -- go in `[Service]`

`StandardOutput`, `StandardError` are exec directives in `[Service]`. [VERIFIED: documented in systemd.exec(5)]

### Summary table

| Directive | Section | Why |
|-----------|---------|-----|
| `StartLimitBurst=5` | `[Unit]` | Rate limiting is a unit-level concept (since systemd 230) |
| `StartLimitIntervalSec=300` | `[Unit]` | Same as above |
| `MemoryHigh=256M` | `[Service]` | Resource control applies to service cgroup |
| `MemoryMax=512M` | `[Service]` | Resource control applies to service cgroup |
| `TasksMax=50` | `[Service]` | Resource control applies to service cgroup |
| `Nice=10` | `[Service]` | Exec property of the service process |
| `TimeoutStartSec=30` | `[Service]` | Service lifecycle timeout |
| `TimeoutStopSec=10` | `[Service]` | Service lifecycle timeout |
| `StandardOutput=journal` | `[Service]` | Exec property of the service process |
| `StandardError=journal` | `[Service]` | Exec property of the service process |

---

## 2. MemoryHigh Behavior in User Services on Ubuntu 24.04

**Confidence:** HIGH

### Behavior confirmed: throttle, not kill

`MemoryHigh=` specifies a throttling limit. When exceeded: [VERIFIED: Ubuntu Noble man page for systemd.resource-control.5]

> "Memory usage may go above the limit if unavoidable, but the processes are heavily slowed down and memory is taken away aggressively in such cases."

This maps to the kernel's `memory.high` cgroup v2 knob. The kernel applies **memory reclaim pressure** -- it does NOT invoke the OOM killer. The process is slowed (I/O and CPU throttled) while the kernel tries to reclaim pages. Only `MemoryMax=` (which maps to `memory.max`) triggers the OOM killer.

**The two-tier defense from D-06 works correctly:**
1. At 256M (`MemoryHigh`): kernel throttles, reclaims memory. Service slows down but stays alive.
2. At 512M (`MemoryMax`): OOM killer invoked within the cgroup. Service is killed and `Restart=on-failure` triggers.

### cgroup v2 requirement -- satisfied on Ubuntu 24.04

`MemoryHigh=` only works on the unified cgroup hierarchy (cgroup v2). Ubuntu has defaulted to cgroup v2 since Ubuntu 21.10. Ubuntu 24.04 LTS ships with cgroup v2 as default. [VERIFIED: Ubuntu 24.04 release notes confirm systemd 255.4; cgroup v2 default since 21.10 per Phoronix and ubuntu-devel mailing list]

### User services -- works with caveats

Resource control directives work in user services on cgroup v2. The key requirement is that the user session's cgroup slice must have the `memory` controller delegated. On Ubuntu 24.04 with GNOME, the `user@.service` systemd unit manages user sessions and delegates controllers by default via `Delegate=` in the user slice. [CITED: Arch Wiki cgroups, systemd issue #31660]

**Known limitation:** There is a reported issue (systemd/systemd#31660) where `MemoryHigh` set on a parent slice may not propagate to child services. However, this applies to slice-level settings, not to directives set directly on the service unit file. Setting `MemoryHigh=256M` directly in `agent-bar.service` applies the limit directly to the service's own cgroup -- this is the correct approach and avoids the propagation issue. [VERIFIED: systemd issue #31660 describes slice propagation, not direct service settings]

### Verification command

After service starts, verify cgroup limits are applied:

```bash
# Check the service's cgroup memory.high value
systemctl --user show agent-bar.service -p MemoryHigh
# Should output: MemoryHigh=268435456 (256M in bytes)

# Or check the kernel cgroup knob directly
cat /sys/fs/cgroup/user.slice/user-$(id -u).slice/user@$(id -u).service/app.slice/agent-bar.service/memory.high
# Should output: 268435456
```

---

## 3. Journal Integration: Is `StandardOutput=journal` the Default?

**Confidence:** HIGH

### Yes, `journal` is the default for both stdout and stderr

The systemd service manager connects all service processes to the journal by default. From the official documentation: [CITED: man7.org/linux/man-pages/man8/systemd-journald.service.8.html]

> "The systemd service manager invokes all service processes with standard output and standard error connected to the journal by default."

And from the Native Journal Protocol documentation: [CITED: systemd.io/JOURNAL_NATIVE_PROTOCOL]

> "`StandardOutput=journal` + `StandardError=journal` in service files (both of which are default settings)"

The actual default chain is:
- `StandardOutput=` defaults to the value of `DefaultStandardOutput=` in `systemd-system.conf(5)` (for system services) or `systemd-user.conf(5)` (for user services)
- `DefaultStandardOutput=` defaults to `journal`
- `StandardError=` defaults to `inherit` (inherits from StandardOutput), which effectively means `journal`

### Should you be explicit anyway?

**Recommendation: Yes, keep the explicit `StandardOutput=journal` and `StandardError=journal`.**

Reasons:
1. **Self-documenting:** Anyone reading the service file immediately knows log routing intent without consulting systemd defaults.
2. **Defensive against system-level overrides:** A sysadmin could change `DefaultStandardOutput=` in `/etc/systemd/user.conf`. Explicit settings in the unit file override system defaults.
3. **D-09 decided this explicitly:** The CONTEXT.md decision says "declares default for clarity." This is the right call.
4. **Zero cost:** Specifying a default value has no performance or behavioral penalty.

### Querying logs

```bash
# View agent-bar logs specifically
journalctl --user -u agent-bar.service

# Follow live
journalctl --user -u agent-bar.service -f

# Since last boot
journalctl --user -u agent-bar.service -b
```

---

## 4. StartLimitAction for User Services

**Confidence:** HIGH

### Default is `none` -- service just stops retrying

`StartLimitAction=` defaults to `none`. [VERIFIED: Ubuntu Noble man page for systemd.unit.5]

When the rate limit is exceeded (more than `StartLimitBurst` starts within `StartLimitIntervalSec`):
1. The service enters a **failed state** with result `start-limit-hit`.
2. **No further start attempts are permitted** -- neither automatic (via `Restart=`) nor manual (`systemctl --user start`).
3. **No system-level action** (no reboot, no exit).

### Allowed values in user mode

For user services (`systemd --user`), only these values are allowed: [VERIFIED: Ubuntu Noble man page for systemd.unit.5]
- `none` (default) -- just block further starts
- `exit` -- terminate the user service manager
- `exit-force` -- forcefully terminate the user service manager
- `soft-reboot` -- (systemd 255+)
- `soft-reboot-force` -- (systemd 255+)

The system-level actions (`reboot`, `reboot-force`, `reboot-immediate`, `poweroff`, `poweroff-force`, `poweroff-immediate`, `kexec`, `kexec-force`, `halt`, `halt-force`, `halt-immediate`) are NOT available to user services.

### Recommendation: Do NOT set `StartLimitAction=` explicitly

Since `none` is the default and is the only sensible value for a desktop background service, there is no need to declare it. Adding it would be noise without value. This is different from `StandardOutput=journal` (which is worth being explicit about for clarity) because:
- No sysadmin would change the default `StartLimitAction` for all user services
- `none` is always the right choice for a non-critical user service
- The behavior ("just stop trying") is obvious and expected

### Recovery from start-limit-hit

When the burst is exceeded, the user must manually reset:

```bash
systemctl --user reset-failed agent-bar.service
systemctl --user start agent-bar.service
```

Or wait for the interval to expire (the counter resets after `StartLimitIntervalSec` seconds).

### Mathematical check for D-08 values

D-08 specifies: `StartLimitBurst=5`, `StartLimitIntervalSec=300`, with `RestartSec=2`.

The critical relationship is: `StartLimitIntervalSec` must exceed `RestartSec x StartLimitBurst`. [CITED: Michael Stapelberg blog post on indefinite restarts]

- `RestartSec(2) x StartLimitBurst(5) = 10 seconds`
- `StartLimitIntervalSec = 300 seconds`
- 300 >> 10, so the rate limit CAN be reached within the window.

In practice: if the service crashes immediately on each start, it will attempt 5 starts in ~10 seconds (0s, 2s, 4s, 6s, 8s), hit the burst limit, and enter failed state. The remaining 290 seconds of the interval pass unused. This is correct behavior -- the service fails fast rather than thrashing for 5 minutes.

---

## 5. Ordering with GNOME Services

**Confidence:** HIGH

### Current state: `After=default.target`

The current service file uses `After=default.target` and `WantedBy=default.target`. This means:
- The service starts after the user session's default target is reached
- It starts on every user login (graphical or not)

### Should we use `After=graphical-session.target`?

**No. Keep `After=default.target` and `WantedBy=default.target`.** Here is why:

**Agent Bar is a backend polling service, not a GUI application.** It does not need:
- `DISPLAY` or `WAYLAND_DISPLAY` environment variables
- A running compositor
- Any graphical toolkit

What it DOES need:
- **DBUS session bus** -- for `secret-tool` to reach GNOME Keyring
- **Network** -- for HTTP polling of provider APIs

Both of these are available by the time `default.target` is reached. The DBUS session bus is available early in the user session (before `graphical-session.target`), and `DBUS_SESSION_BUS_ADDRESS` is already captured in the `env.conf` drop-in at install time. [VERIFIED: install-ubuntu.sh captures DBUS_SESSION_BUS_ADDRESS in env.conf at line 240]

**Why `graphical-session.target` would be WRONG:**

1. **`graphical-session.target` adds `PartOf=` semantics:** Services using this target are expected to declare `PartOf=graphical-session.target`, which means they stop when the graphical session stops. If the user switches TTYs or the compositor crashes, the backend would stop unnecessarily.

2. **`graphical-session.target` adds startup delay:** The graphical session target is reached later than `default.target` (after the compositor, shell, and settings daemons are all running). The backend doesn't need any of this.

3. **SSH sessions:** If a user starts a headless session, `graphical-session.target` is never reached. The backend could still be useful for CLI-based diagnostics (`agent-bar status`).

### What about DBUS ordering specifically?

The DBUS session bus daemon is started very early in the user session lifecycle -- it is a prerequisite for `default.target` on GNOME. The `dbus.socket` user unit is activated before any DBUS-dependent services. [CITED: systemd.io/DESKTOP_ENVIRONMENTS]

However, **GNOME Keyring** (the daemon that `secret-tool` talks to) is a separate question. `gnome-keyring-daemon` is started via DBUS activation -- it starts on first access, not at a fixed point. This means:

- The first `secret-tool` call after login may have a ~100ms delay while GNOME Keyring activates
- This is handled gracefully by the existing `SecretToolStore` implementation (10-second timeout, error handling for subprocess failures)
- No additional ordering directive is needed

### Recommendation: No change to ordering

Keep `After=default.target` and `WantedBy=default.target`. Do NOT add `After=graphical-session.target`. The current ordering is correct for a backend polling daemon that uses DBUS indirectly via subprocess calls to `secret-tool`.

---

## Complete Service File Template

Based on all research findings, here is the exact hardened service file:

```ini
[Unit]
Description=Agent Bar local backend service
After=default.target
StartLimitBurst=5
StartLimitIntervalSec=300

[Service]
Type=simple
ExecStart=%h/.local/bin/agent-bar service run
Restart=on-failure
RestartSec=2
Nice=10
MemoryHigh=256M
MemoryMax=512M
TasksMax=50
TimeoutStartSec=30
TimeoutStopSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
```

### Directive ordering rationale

Within each section, directives are grouped by concern:
1. **[Unit]**: Description, ordering, rate limiting
2. **[Service]**: Type and command, restart behavior, scheduling priority, resource limits, timeouts, logging
3. **[Install]**: Target binding

### Optional: Documentation directive

The CONTEXT.md lists `Documentation=` as Claude's discretion. Adding it is low-value for a user service (no one runs `systemctl --user help agent-bar`), but harmless:

```ini
[Unit]
Description=Agent Bar local backend service
Documentation=https://github.com/your-org/agent-bar-usage
After=default.target
StartLimitBurst=5
StartLimitIntervalSec=300
```

**Recommendation:** Skip it. The repo URL will change, creating a maintenance burden for zero practical benefit in a user service context.

---

## Verification Commands

After applying the hardened service file, verify correctness:

```bash
# 1. Reload and restart
systemctl --user daemon-reload
systemctl --user restart agent-bar.service

# 2. Verify unit file has no warnings
systemd-analyze --user verify ~/.config/systemd/user/agent-bar.service 2>&1
# Should output nothing (no warnings)

# 3. Check that rate limit settings are in [Unit] and recognized
systemctl --user show agent-bar.service -p StartLimitBurst -p StartLimitIntervalUSec
# Should output:
#   StartLimitBurst=5
#   StartLimitIntervalUSec=5min  (300s expressed as interval)

# 4. Check resource limits
systemctl --user show agent-bar.service -p MemoryHigh -p MemoryMax -p TasksMax
# Should output:
#   MemoryHigh=268435456
#   MemoryMax=536870912
#   TasksMax=50

# 5. Check timeouts and nice
systemctl --user show agent-bar.service -p TimeoutStartUSec -p TimeoutStopUSec -p Nice
# Should output:
#   TimeoutStartUSec=30s
#   TimeoutStopUSec=10s
#   Nice=10

# 6. Check journal output
systemctl --user show agent-bar.service -p StandardOutput -p StandardError
# Should output:
#   StandardOutput=journal
#   StandardError=journal

# 7. Verify cgroup memory knobs (after service is running)
cat "/sys/fs/cgroup/user.slice/user-$(id -u).slice/user@$(id -u).service/app.slice/agent-bar.service/memory.high" 2>/dev/null
# Should output: 268435456
```

---

## Common Pitfalls

### Pitfall 1: StartLimit directives in wrong section
**What goes wrong:** Rate limiting silently ignored, service restarts forever.
**Why it happens:** Pre-systemd-230 docs showed these in `[Service]`.
**How to avoid:** Always place in `[Unit]`. Use `systemd-analyze --user verify` to catch warnings.
**Warning signs:** `journalctl --user` shows `Unknown lvalue 'StartLimitBurst' in section 'Service'`

### Pitfall 2: MemoryHigh has no effect
**What goes wrong:** Service uses unlimited memory despite `MemoryHigh=256M`.
**Why it happens:** cgroup v1 (legacy hierarchy) does not support `MemoryHigh`. Or the memory controller is not delegated to the user slice.
**How to avoid:** Verify cgroup v2 is active: `cat /sys/fs/cgroup/cgroup.controllers` should list `memory`. Check the service's own cgroup: the `memory.high` file should exist and contain the expected value.
**Warning signs:** `systemctl --user show agent-bar.service -p MemoryHigh` returns `infinity`.

### Pitfall 3: StartLimitIntervalSec too short relative to RestartSec
**What goes wrong:** Rate limit window expires before enough restarts accumulate, making the limit unreachable.
**Why it happens:** `RestartSec x StartLimitBurst > StartLimitIntervalSec`. Example: `RestartSec=60`, `StartLimitBurst=5`, `StartLimitIntervalSec=120` -- only 2 restarts can happen in 120s, never reaching burst of 5.
**How to avoid:** Ensure `StartLimitIntervalSec >> RestartSec x StartLimitBurst`. The D-08 values (300 >> 2x5=10) have massive margin.
**Warning signs:** Service never enters `start-limit-hit` state despite repeated failures.

### Pitfall 4: TimeoutStartSec has no effect on Type=simple
**What goes wrong:** Expectation that systemd will kill a stuck startup after 30s, but `Type=simple` considers the service "started" immediately after `ExecStart=` begins.
**Why it happens:** `TimeoutStartSec` for `Type=simple` only applies to the time between systemd invoking the process and the process actually running. In practice this is near-instant.
**How to avoid:** Understand that `TimeoutStartSec=30` for `Type=simple` is a safety net for pathological cases (binary not found, loader crashes, etc.), not for slow application initialization. For application-level startup monitoring, `WatchdogSec` with `Type=notify` would be needed (deferred per D-10).
**Warning signs:** None -- this is a documentation clarification, not a functional issue. The directive is still correct to include.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | GNOME Keyring activates on first DBUS access with ~100ms delay | Section 5 (Ordering) | LOW -- if activation takes longer, the existing 10s timeout in SecretToolStore handles it |

**All other claims in this research were verified against official documentation or upstream sources.**

---

## Sources

### Primary (HIGH confidence)
- [Ubuntu Noble systemd.unit.5](https://manpages.ubuntu.com/manpages/noble/man5/systemd.unit.5.html) -- StartLimitBurst, StartLimitIntervalSec, StartLimitAction placement and defaults
- [Ubuntu Noble systemd.resource-control.5](https://manpages.ubuntu.com/manpages/noble/man5/systemd.resource-control.5.html) -- MemoryHigh, MemoryMax, TasksMax behavior and section placement
- [Ubuntu 24.04 release notes](https://documentation.ubuntu.com/release-notes/24.04/) -- systemd 255.4 version, cgroup v2 default
- [man7.org systemd-journald.service.8](https://man7.org/linux/man-pages/man8/systemd-journald.service.8.html) -- StandardOutput/StandardError journal default
- [systemd.io Native Journal Protocol](https://systemd.io/JOURNAL_NATIVE_PROTOCOL/) -- Confirms journal is default for both stdout and stderr
- [systemd.io Desktop Environments](https://systemd.io/DESKTOP_ENVIRONMENTS/) -- graphical-session.target vs default.target semantics
- [man7.org systemd.special.7](https://man7.org/linux/man-pages/man7/systemd.special.7.html) -- target definitions and ordering guarantees

### Secondary (MEDIUM confidence)
- [HashiCorp KB: Unknown lvalue in section Service](https://support.hashicorp.com/hc/en-us/articles/4406120244755) -- Confirms StartLimit must be in [Unit]
- [Red Hat KB: Unknown lvalue StartLimitIntervalSec](https://access.redhat.com/solutions/3143751) -- Same confirmation from different vendor
- [Michael Stapelberg: systemd indefinite restarts](https://michael.stapelberg.ch/posts/2024-01-17-systemd-indefinite-service-restarts/) -- Mathematical relationship between RestartSec and StartLimitInterval
- [systemd/systemd#31660](https://github.com/systemd/systemd/issues/31660) -- MemoryHigh propagation issue in user slices (not applicable to direct service settings)
- [GNOME Discourse: user service with graphical session](https://discourse.gnome.org/t/start-a-systemd-user-service-with-graphical-session-in-gnome-40/8738) -- graphical-session.target lifecycle and PartOf semantics

### Codebase verification
- `packaging/systemd/user/agent-bar.service` -- current service file
- `scripts/install-ubuntu.sh:233-251` -- env.conf drop-in capturing DBUS_SESSION_BUS_ADDRESS
- `apps/backend/src/secrets/secret-tool-store.ts` -- 10s timeout for secret-tool subprocess
- `apps/backend/src/core/prerequisite-checks.ts` -- systemd-env check verifying env.conf exists

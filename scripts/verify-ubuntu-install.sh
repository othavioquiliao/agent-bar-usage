#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v agent-bar >/dev/null 2>&1; then
  echo "agent-bar is not on PATH." >&2
  exit 1
fi

if ! systemctl --user is-active --quiet agent-bar.service; then
  echo "agent-bar.service is not active." >&2
  systemctl --user status agent-bar.service --no-pager >&2 || true
  exit 1
fi

doctor_json="$(agent-bar doctor --json)"
service_status_json="$(agent-bar service status --json)"
snapshot_json="$(agent-bar service snapshot --json)"

node --input-type=module -e '
  const [doctorRaw, statusRaw, snapshotRaw] = process.argv.slice(1);
  const doctor = JSON.parse(doctorRaw);
  const status = JSON.parse(statusRaw);
  const snapshot = JSON.parse(snapshotRaw);

  if (!Array.isArray(doctor.checks) || doctor.checks.length === 0) {
    throw new Error("doctor report did not contain checks");
  }

  if (typeof status.running !== "boolean") {
    throw new Error("service status did not include a running flag");
  }

  if (!snapshot || typeof snapshot.schema_version !== "string" || !Array.isArray(snapshot.providers)) {
    throw new Error("service snapshot did not match the expected envelope shape");
  }
' "$doctor_json" "$service_status_json" "$snapshot_json"

echo "Verified agent-bar install from $repo_root"

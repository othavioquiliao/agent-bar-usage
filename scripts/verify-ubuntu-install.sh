#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
systemd_override_path="${HOME}/.config/systemd/user/agent-bar.service.d/env.conf"
gnome_ext_uuid="agent-bar-ubuntu@othavio.dev"
installed_extension_dir="${HOME}/.local/share/gnome-shell/extensions/${gnome_ext_uuid}"

fail() {
  echo "$1" >&2
  exit 1
}

require_file() {
  local file_path="$1"
  local message="$2"

  if [[ ! -f "$file_path" ]]; then
    fail "$message"
  fi
}

if ! command -v agent-bar >/dev/null 2>&1; then
  fail "agent-bar is not on PATH."
fi

if ! systemctl --user is-active --quiet agent-bar.service; then
  echo "agent-bar.service is not active." >&2
  systemctl --user status agent-bar.service --no-pager >&2 || true
  exit 1
fi

require_file \
  "$systemd_override_path" \
  "systemd environment override not found at $systemd_override_path. Re-run \`pnpm install:ubuntu\`."
require_file \
  "$installed_extension_dir/extension.js" \
  "Installed GNOME extension is missing extension.js. Re-run \`pnpm install:ubuntu\`."
require_file \
  "$installed_extension_dir/metadata.json" \
  "Installed GNOME extension is missing metadata.json. Re-run \`pnpm install:ubuntu\`."
require_file \
  "$installed_extension_dir/stylesheet.css" \
  "Installed GNOME extension is missing stylesheet.css. Re-run \`pnpm install:ubuntu\`."
require_file \
  "$installed_extension_dir/assets/claude-code-icon.png" \
  "Installed GNOME extension is missing claude-code-icon.png. Re-run \`pnpm install:ubuntu\`."
require_file \
  "$installed_extension_dir/assets/codex-icon.png" \
  "Installed GNOME extension is missing codex-icon.png. Re-run \`pnpm install:ubuntu\`."

if [[ -f "$repo_root/apps/gnome-extension/assets/copilot-icon.png" ]]; then
  require_file \
    "$installed_extension_dir/assets/copilot-icon.png" \
    "Installed GNOME extension is missing copilot-icon.png. Re-run \`pnpm install:ubuntu\`."
fi

auth_help_text="$(agent-bar auth copilot --help 2>&1)"
doctor_json="$(agent-bar doctor --json)"
service_status_json="$(agent-bar service status --json)"
snapshot_json="$(agent-bar service snapshot --json)"
env_conf_text="$(cat "$systemd_override_path")"

node --input-type=module -e '
  const [authHelpRaw, doctorRaw, statusRaw, snapshotRaw, envConfRaw] = process.argv.slice(1);
  const doctor = JSON.parse(doctorRaw);
  const status = JSON.parse(statusRaw);
  const snapshot = JSON.parse(snapshotRaw);
  const envConf = envConfRaw;

  if (!authHelpRaw.includes("Authenticate Copilot via GitHub Device Flow")) {
    throw new Error("auth copilot command help did not expose the expected device-flow command");
  }

  if (!envConf.includes("[Service]")) {
    throw new Error("systemd env override is missing the [Service] section");
  }

  if (!envConf.includes("Environment=PATH=")) {
    throw new Error("systemd env override did not capture PATH");
  }

  if (!Array.isArray(doctor.checks) || doctor.checks.length === 0) {
    throw new Error("doctor report did not contain checks");
  }

  const requiredCheckIds = [
    "config",
    "secret-tool",
    "codex-cli",
    "claude-cli",
    "node-pty",
    "copilot-token",
    "systemd-env",
    "service-runtime",
  ];

  const checksById = new Map(doctor.checks.map((check) => [check.id, check]));

  for (const checkId of requiredCheckIds) {
    if (!checksById.has(checkId)) {
      throw new Error(`doctor report did not include expected check: ${checkId}`);
    }
  }

  if (doctor.runtime_mode !== "service") {
    throw new Error(`doctor runtime_mode should be service while the user service is active; got ${doctor.runtime_mode}`);
  }

  const nodePtyCheck = checksById.get("node-pty");
  if (nodePtyCheck?.status === "error") {
    throw new Error(`node-pty check failed: ${nodePtyCheck.message}`);
  }

  const systemdEnvCheck = checksById.get("systemd-env");
  if (systemdEnvCheck?.status === "error") {
    throw new Error(`systemd-env check failed: ${systemdEnvCheck.message}`);
  }

  if (typeof status.running !== "boolean") {
    throw new Error("service status did not include a running flag");
  }

  if (!status.running) {
    throw new Error("service status reported running=false");
  }

  if (!snapshot || typeof snapshot.schema_version !== "string" || !Array.isArray(snapshot.providers)) {
    throw new Error("service snapshot did not match the expected envelope shape");
  }
' "$auth_help_text" "$doctor_json" "$service_status_json" "$snapshot_json" "$env_conf_text"

echo "Verified agent-bar install, doctor contract, systemd env override, and installed GNOME extension payload from $repo_root"

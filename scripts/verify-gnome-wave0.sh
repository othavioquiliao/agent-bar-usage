#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
extension_src_dir="$repo_root/apps/gnome-extension"
provider_icons_source="$extension_src_dir/utils/provider-icons.js"
installed_extension_dir="${HOME}/.local/share/gnome-shell/extensions/agent-bar-ubuntu@othavio.dev"

usage() {
  echo "Usage: $0 --source-only|--post-install" >&2
  exit 1
}

fail() {
  echo "Wave 0 preflight failed: $1" >&2
  exit 1
}

require_command() {
  local command_name="$1"
  local remediation="$2"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    fail "missing \`$command_name\`. $remediation"
  fi
}

require_file() {
  local file_path="$1"
  local remediation="$2"

  if [[ ! -f "$file_path" ]]; then
    fail "missing file: $file_path. $remediation"
  fi
}

check_provider_icon_source() {
  require_file \
    "$provider_icons_source" \
    "Restore the packaged provider identity helper before running Wave 0 verification."

  if rg -n "qbar/" "$provider_icons_source" >/dev/null 2>&1; then
    fail "provider icon helper still references a repo-relative qbar/ path. Load icons from the packaged extension assets instead."
  fi
}

verify_source_only() {
  require_command \
    "pnpm" \
    "Install pnpm and rerun \`bash scripts/verify-gnome-wave0.sh --source-only\` before moving to install-time GNOME checks."

  require_file \
    "$extension_src_dir/stylesheet.css" \
    "Add the packaged extension stylesheet before Phase 7 visual verification."
  require_file \
    "$extension_src_dir/assets/claude-code-icon.png" \
    "Copy the Claude provider icon into apps/gnome-extension/assets/."
  require_file \
    "$extension_src_dir/assets/codex-icon.png" \
    "Copy the Codex provider icon into apps/gnome-extension/assets/."

  check_provider_icon_source

  echo "Wave 0 source-only preflight passed."
}

verify_post_install() {
  require_command \
    "pnpm" \
    "Install pnpm so \`pnpm install:ubuntu\` can refresh the installed extension payload."
  require_command \
    "gjs" \
    "Install GJS before attempting post-install GNOME verification."
  require_command \
    "gnome-shell" \
    "Install GNOME Shell 46-compatible binaries or run the check on the target Ubuntu GNOME host."
  require_command \
    "gnome-extensions" \
    "Install the GNOME extensions CLI before running the manual verification checkpoint."

  require_file \
    "$installed_extension_dir/stylesheet.css" \
    "Run \`pnpm install:ubuntu\` so the packaged stylesheet is copied into the installed extension directory."
  require_file \
    "$installed_extension_dir/assets/claude-code-icon.png" \
    "Run \`pnpm install:ubuntu\` so the Claude asset is copied into the installed extension directory."
  require_file \
    "$installed_extension_dir/assets/codex-icon.png" \
    "Run \`pnpm install:ubuntu\` so the Codex asset is copied into the installed extension directory."

  check_provider_icon_source

  echo "Wave 0 post-install verification passed."
}

main() {
  if [[ $# -ne 1 ]]; then
    usage
  fi

  case "$1" in
    --source-only)
      verify_source_only
      ;;
    --post-install)
      verify_post_install
      ;;
    *)
      usage
      ;;
  esac
}

main "$@"

#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backend_entry="$repo_root/apps/backend/dist/cli.js"
node_binary="${NODE_BINARY:-}"
install_dir="${HOME}/.local/bin"
systemd_dir="${HOME}/.config/systemd/user"
wrapper_path="${install_dir}/agent-bar"
unit_path="${systemd_dir}/agent-bar.service"
gnome_ext_src="$repo_root/apps/gnome-extension"
gnome_ext_uuid="agent-bar-ubuntu@othavio.dev"
gnome_ext_dir="${HOME}/.local/share/gnome-shell/extensions/${gnome_ext_uuid}"

if [[ -z "${node_binary}" ]]; then
  node_binary="$(command -v node || true)"
fi

if [[ -z "${node_binary}" ]]; then
  echo "node is required to run agent-bar." >&2
  exit 1
fi

pnpm --dir "$repo_root" build:backend

if [[ ! -f "$backend_entry" ]]; then
  echo "Backend build output not found at $backend_entry." >&2
  exit 1
fi

mkdir -p "$install_dir" "$systemd_dir"

cat > "$wrapper_path" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec "$node_binary" "$backend_entry" "\$@"
EOF
chmod +x "$wrapper_path"

cp "$repo_root/packaging/systemd/user/agent-bar.service" "$unit_path"

# Protect the runtime socket directory from tmpfiles-clean.
tmpfiles_user_dir="${HOME}/.config/user-tmpfiles.d"
mkdir -p "$tmpfiles_user_dir"
cp "$repo_root/packaging/tmpfiles.d/agent-bar.conf" "$tmpfiles_user_dir/agent-bar.conf"
systemd-tmpfiles --user --create "$tmpfiles_user_dir/agent-bar.conf" 2>/dev/null || true

# Capture the interactive shell environment so the user service can resolve CLIs and secrets.
override_dir="${systemd_dir}/agent-bar.service.d"
override_path="${override_dir}/env.conf"
mkdir -p "$override_dir"

env_vars_to_capture=(
  PATH
  GITHUB_TOKEN
  GH_TOKEN
  COPILOT_TOKEN
  COPILOT_API_TOKEN
  ANTHROPIC_API_KEY
  DBUS_SESSION_BUS_ADDRESS
)

{
  echo "[Service]"
  for var_name in "${env_vars_to_capture[@]}"; do
    var_value="${!var_name:-}"
    if [[ -n "$var_value" ]]; then
      echo "Environment=${var_name}=${var_value}"
    fi
  done
} > "$override_path"

echo "Wrote systemd environment override to $override_path"

systemctl --user daemon-reload
systemctl --user enable agent-bar.service
systemctl --user restart agent-bar.service

echo "Installed agent-bar to $wrapper_path"
echo "Enabled agent-bar.service in the user systemd session"

# --- GNOME Shell extension ---
mkdir -p "$gnome_ext_dir"

# Copy extension source files (excluding tests, node_modules, and dev configs)
for item in extension.js metadata.json stylesheet.css assets panel services state utils; do
  if [[ -e "$gnome_ext_src/$item" ]]; then
    cp -r "$gnome_ext_src/$item" "$gnome_ext_dir/"
  fi
done

# Enable the extension (--quiet avoids error if already enabled)
gnome-extensions enable "$gnome_ext_uuid" 2>/dev/null || true

echo "Installed GNOME extension to $gnome_ext_dir"
echo "Note: you may need to restart GNOME Shell (log out/in) for the extension to appear."

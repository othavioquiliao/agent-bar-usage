#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backend_entry="$repo_root/apps/backend/dist/cli.js"
node_binary="${NODE_BINARY:-}"
install_dir="${HOME}/.local/bin"
systemd_dir="${HOME}/.config/systemd/user"
wrapper_path="${install_dir}/agent-bar"
unit_path="${systemd_dir}/agent-bar.service"

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

systemctl --user daemon-reload
systemctl --user enable --now agent-bar.service

echo "Installed agent-bar to $wrapper_path"
echo "Enabled agent-bar.service in the user systemd session"

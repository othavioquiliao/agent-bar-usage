#!/usr/bin/env bash
set -euo pipefail

# ===========================================================================
#  Agent Bar Ubuntu — Smart Installer
#  Detects missing dependencies, offers to install them, then runs the
#  existing build+install pipeline, finishing with post-install validation.
#  Safe to run multiple times (idempotent).
# ===========================================================================

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

# ── Helper functions ──────────────────────────────────────────────────────

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No color

step_ok()   { printf "${GREEN}[ok]${NC}   %s\n" "$*"; }
step_warn() { printf "${YELLOW}[!!]${NC}   %s\n" "$*"; }
step_fail() { printf "${RED}[FAIL]${NC} %s\n" "$*"; }

# Prompt user for confirmation.  Returns 0 on yes, 1 on no.
# Usage: confirm_install "Install Node.js via nvm?"
confirm_install() {
  local prompt="$1"
  local answer
  printf "${BOLD}%s [Y/n]${NC} " "$prompt"
  read -r answer </dev/tty
  case "${answer,,}" in
    n|no) return 1 ;;
    *)    return 0 ;;
  esac
}

# ── Pre-flight checks ────────────────────────────────────────────────────

echo ""
echo "=========================================="
echo "  Agent Bar Ubuntu — Smart Installer"
echo "=========================================="
echo ""

# Check we are running on a Linux system
if [[ "$(uname -s)" != "Linux" ]]; then
  step_fail "Este instalador requer Linux."
  exit 1
fi

# Check Ubuntu / GNOME Shell
if command -v lsb_release >/dev/null 2>&1; then
  distro="$(lsb_release -d -s 2>/dev/null || echo "desconhecida")"
  step_ok "Distribuicao: $distro"
else
  step_warn "lsb_release nao encontrado — nao foi possivel verificar a distribuicao."
fi

if command -v gnome-shell >/dev/null 2>&1; then
  gnome_ver="$(gnome-shell --version 2>/dev/null || echo "desconhecida")"
  step_ok "GNOME Shell: $gnome_ver"
else
  step_warn "gnome-shell nao encontrado — a extensao GNOME pode nao funcionar."
fi

echo ""

# ── Dependency auto-detection & install ───────────────────────────────────

# --- Node.js ---
if command -v node >/dev/null 2>&1; then
  node_ver="$(node --version 2>/dev/null || echo "?")"
  step_ok "Node.js encontrado: $node_ver"
else
  step_warn "Node.js nao encontrado."
  if confirm_install "Instalar Node.js via nvm?"; then
    echo "Baixando e instalando nvm..."
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    if [[ ! -d "$NVM_DIR" ]]; then
      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    fi
    # shellcheck source=/dev/null
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    nvm install --lts
    nvm use --lts
    step_ok "Node.js instalado via nvm: $(node --version)"
  else
    step_warn "Node.js pulado — a instalacao pode falhar."
  fi
fi

# --- pnpm ---
if command -v pnpm >/dev/null 2>&1; then
  pnpm_ver="$(pnpm --version 2>/dev/null || echo "?")"
  step_ok "pnpm encontrado: $pnpm_ver"
else
  step_warn "pnpm nao encontrado."
  if confirm_install "Instalar pnpm via corepack?"; then
    corepack enable
    corepack prepare pnpm@latest --activate
    step_ok "pnpm instalado: $(pnpm --version)"
  else
    step_warn "pnpm pulado — a instalacao pode falhar."
  fi
fi

# --- libsecret-tools ---
if command -v secret-tool >/dev/null 2>&1; then
  step_ok "libsecret-tools encontrado."
else
  step_warn "libsecret-tools nao encontrado (necessario para armazenamento seguro de credenciais)."
  if confirm_install "Instalar libsecret-tools via apt? (requer sudo)"; then
    sudo apt install -y libsecret-tools
    step_ok "libsecret-tools instalado."
  else
    step_warn "libsecret-tools pulado — armazenamento de credenciais pode nao funcionar."
  fi
fi

# --- Claude CLI ---
if command -v claude >/dev/null 2>&1; then
  claude_ver="$(claude --version 2>/dev/null || echo "?")"
  step_ok "Claude CLI encontrado: $claude_ver"
else
  step_warn "Claude CLI nao encontrado."
  if confirm_install "Instalar Claude CLI via npm?"; then
    npm install -g @anthropic-ai/claude-code
    step_ok "Claude CLI instalado: $(claude --version 2>/dev/null || echo "ok")"
  else
    step_warn "Claude CLI pulado — o provider Claude nao funcionara."
  fi
fi

# --- Codex CLI ---
if command -v codex >/dev/null 2>&1; then
  codex_ver="$(codex --version 2>/dev/null || echo "?")"
  step_ok "Codex CLI encontrado: $codex_ver"
else
  step_warn "Codex CLI nao encontrado."
  if confirm_install "Instalar Codex CLI via npm?"; then
    npm install -g @openai/codex
    step_ok "Codex CLI instalado: $(codex --version 2>/dev/null || echo "ok")"
  else
    step_warn "Codex CLI pulado — o provider Codex nao funcionara."
  fi
fi

echo ""

# ── Build & Install (existing logic) ─────────────────────────────────────

echo "=========================================="
echo "  Build & Install"
echo "=========================================="
echo ""

# Resolve node binary
if [[ -z "${node_binary}" ]]; then
  node_binary="$(command -v node || true)"
fi

if [[ -z "${node_binary}" ]]; then
  step_fail "node e necessario para executar o agent-bar."
  exit 1
fi

step_ok "Usando node: $node_binary"

# Build backend
echo "Compilando backend..."
pnpm --dir "$repo_root" build:backend

if [[ ! -f "$backend_entry" ]]; then
  step_fail "Saida do build nao encontrada em $backend_entry."
  exit 1
fi
step_ok "Backend compilado."

# Create directories
mkdir -p "$install_dir" "$systemd_dir"

# Install CLI wrapper
cat > "$wrapper_path" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec "$node_binary" "$backend_entry" "\$@"
EOF
chmod +x "$wrapper_path"
step_ok "Wrapper CLI instalado em $wrapper_path"

# Install systemd unit
cp "$repo_root/packaging/systemd/user/agent-bar.service" "$unit_path"
step_ok "Unidade systemd copiada."

# Protect the runtime socket directory from tmpfiles-clean.
tmpfiles_user_dir="${HOME}/.config/user-tmpfiles.d"
mkdir -p "$tmpfiles_user_dir"
cp "$repo_root/packaging/tmpfiles.d/agent-bar.conf" "$tmpfiles_user_dir/agent-bar.conf"
systemd-tmpfiles --user --create "$tmpfiles_user_dir/agent-bar.conf" 2>/dev/null || true
step_ok "Configuracao tmpfiles criada."

# --- Capture user environment for the systemd service ---
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

step_ok "Override de ambiente systemd escrito em $override_path"

# Reload and enable systemd service
systemctl --user daemon-reload
systemctl --user enable agent-bar.service
systemctl --user restart agent-bar.service
step_ok "agent-bar.service habilitado e iniciado."

# --- GNOME Shell extension ---
mkdir -p "$gnome_ext_dir"

# Copy extension source files (excluding tests, node_modules, and dev configs)
for item in extension.js metadata.json panel services state utils; do
  if [[ -e "$gnome_ext_src/$item" ]]; then
    cp -r "$gnome_ext_src/$item" "$gnome_ext_dir/"
  fi
done

# Enable the extension (--quiet avoids error if already enabled)
gnome-extensions enable "$gnome_ext_uuid" 2>/dev/null || true
step_ok "Extensao GNOME instalada em $gnome_ext_dir"

echo ""

# ── Post-install validation ──────────────────────────────────────────────

echo "=========================================="
echo "  Validacao pos-instalacao"
echo "=========================================="
echo ""

# Run agent-bar doctor
if command -v agent-bar >/dev/null 2>&1; then
  echo "Executando agent-bar doctor..."
  echo ""
  if agent-bar doctor; then
    step_ok "agent-bar doctor concluido com sucesso."
  else
    step_warn "agent-bar doctor reportou problemas (veja acima)."
  fi
else
  step_fail "agent-bar nao encontrado no PATH apos instalacao."
  echo "  Verifique se ${install_dir} esta no seu PATH."
fi

echo ""

# Check for Copilot token
copilot_token="${COPILOT_TOKEN:-${COPILOT_API_TOKEN:-}}"
if [[ -z "$copilot_token" ]]; then
  step_warn "Token do Copilot nao detectado."
  echo ""
  echo "  Para configurar o provider Copilot, defina uma das variaveis:"
  echo ""
  echo "    export COPILOT_TOKEN=ghp_..."
  echo "    export COPILOT_API_TOKEN=ghp_..."
  echo ""
  echo "  Em seguida, reinstale para capturar a variavel no systemd:"
  echo ""
  echo "    pnpm install:ubuntu"
  echo ""
else
  step_ok "Token do Copilot detectado."
fi

echo ""
echo "=========================================="
echo "  Instalacao concluida!"
echo "=========================================="
echo "  Talvez seja necessario reiniciar o GNOME Shell (logout/login)"
echo "  para que a extensao apareca no painel."
echo ""

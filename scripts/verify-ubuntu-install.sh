#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step_ok()   { printf "${GREEN}[ok]${NC}   %s\n" "$*"; }
step_warn() { printf "${YELLOW}[!!]${NC}   %s\n" "$*"; }
step_fail() { printf "${RED}[FAIL]${NC} %s\n" "$*"; }

errors=0

echo ""
echo "=========================================="
echo "  Agent Bar Ubuntu — Verificacao"
echo "=========================================="
echo ""

# --- agent-bar on PATH ---
if command -v agent-bar >/dev/null 2>&1; then
  step_ok "agent-bar encontrado no PATH."
else
  step_fail "agent-bar nao esta no PATH."
  errors=$((errors + 1))
fi

# --- systemd service active ---
if systemctl --user is-active --quiet agent-bar.service 2>/dev/null; then
  step_ok "agent-bar.service esta ativo."
else
  step_fail "agent-bar.service nao esta ativo."
  systemctl --user status agent-bar.service --no-pager 2>&1 || true
  errors=$((errors + 1))
fi

# --- Claude CLI ---
if command -v claude >/dev/null 2>&1; then
  claude_ver="$(claude --version 2>/dev/null || echo "?")"
  step_ok "Claude CLI encontrado: $claude_ver"
else
  step_warn "Claude CLI nao encontrado — provider Claude nao funcionara."
fi

# --- Codex CLI ---
if command -v codex >/dev/null 2>&1; then
  codex_ver="$(codex --version 2>/dev/null || echo "?")"
  step_ok "Codex CLI encontrado: $codex_ver"
else
  step_warn "Codex CLI nao encontrado — provider Codex nao funcionara."
fi

# --- agent-bar doctor ---
if command -v agent-bar >/dev/null 2>&1; then
  echo ""
  echo "Executando agent-bar doctor..."
  if doctor_json="$(agent-bar doctor --json 2>/dev/null)"; then
    step_ok "agent-bar doctor executou com sucesso."

    # Parse doctor exit status from the JSON checks
    fail_count="$(echo "$doctor_json" | node -e '
      const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
      const fails = (data.checks || []).filter(c => c.status === "fail");
      process.stdout.write(String(fails.length));
    ' 2>/dev/null || echo "?")"

    if [[ "$fail_count" == "0" ]]; then
      step_ok "Todos os checks do doctor passaram."
    else
      step_warn "doctor reportou $fail_count check(s) com falha."
    fi
  else
    step_fail "agent-bar doctor falhou ao executar."
    errors=$((errors + 1))
  fi
fi

# --- Deep validation (existing checks) ---
echo ""
echo "Executando validacao detalhada..."

if command -v agent-bar >/dev/null 2>&1; then
  doctor_json="$(agent-bar doctor --json 2>/dev/null || echo "{}")"
  service_status_json="$(agent-bar service status --json 2>/dev/null || echo "{}")"
  snapshot_json="$(agent-bar service snapshot --json 2>/dev/null || echo "{}")"

  validation_result="$(node --input-type=module -e '
    const [doctorRaw, statusRaw, snapshotRaw] = process.argv.slice(1);
    try {
      const doctor = JSON.parse(doctorRaw);
      const status = JSON.parse(statusRaw);
      const snapshot = JSON.parse(snapshotRaw);

      const issues = [];

      if (!Array.isArray(doctor.checks) || doctor.checks.length === 0) {
        issues.push("doctor report nao contem checks");
      }

      if (typeof status.running !== "boolean") {
        issues.push("service status nao incluiu flag running");
      }

      if (!snapshot || typeof snapshot.schema_version !== "string" || !Array.isArray(snapshot.providers)) {
        issues.push("service snapshot nao corresponde ao formato esperado");
      }

      if (issues.length > 0) {
        process.stdout.write("WARN:" + issues.join("; "));
      } else {
        process.stdout.write("OK");
      }
    } catch (e) {
      process.stdout.write("FAIL:" + e.message);
    }
  ' "$doctor_json" "$service_status_json" "$snapshot_json" 2>/dev/null || echo "FAIL:node error")"

  case "$validation_result" in
    OK)
      step_ok "Validacao detalhada passou (doctor, service status, snapshot)."
      ;;
    WARN:*)
      step_warn "Validacao detalhada: ${validation_result#WARN:}"
      ;;
    FAIL:*)
      step_fail "Validacao detalhada: ${validation_result#FAIL:}"
      errors=$((errors + 1))
      ;;
  esac
else
  step_fail "agent-bar nao encontrado — validacao detalhada pulada."
  errors=$((errors + 1))
fi

echo ""

if [[ "$errors" -gt 0 ]]; then
  step_fail "Verificacao concluida com $errors erro(s)."
  exit 1
else
  step_ok "Verificacao concluida — tudo ok!"
  echo "  Verificado agent-bar install de $repo_root"
  exit 0
fi

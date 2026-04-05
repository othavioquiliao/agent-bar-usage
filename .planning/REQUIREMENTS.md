# Requirements: v2.1 Stability & Hardening

## Security

- [ ] **SEC-01**: Fix shell injection em auth-command.ts — substituir exec(xdg-open) por Bun.spawn array
- [ ] **SEC-02**: Fix silent error swallowing em service-server.ts — adicionar logging nos .catch()

## Stability

- [ ] **STAB-01**: Fix memory leak no GNOME indicator — destroy() actors antes de limpar
- [ ] **STAB-02**: Fix race condition no snapshot-cache — atomic write (temp+rename no mesmo diretorio)
- [ ] **STAB-03**: Adicionar global error handlers no service runtime (unhandledRejection/uncaughtException)
- [ ] **STAB-04**: Adicionar timeout ao subprocess do GNOME extension backend-client (GLib.timeout_add + force_exit)
- [ ] **STAB-05**: Adicionar timeout global ao backend coordinator (Promise.race)
- [ ] **STAB-06**: Adicionar timeout ao Codex appserver subprocess

## Quality Gate

- [x] **QUAL-01**: Ativar Biome rules estritas (noExplicitAny, noNonNullAssertion, useNodejsImportProtocol)
- [x] **QUAL-02**: Criar .editorconfig para consistencia de formatacao

## Production Hardening

- [x] **HARD-01**: Hardening do systemd service (MemoryMax, TasksMax, StartLimitBurst, log routing)
- [x] **HARD-02**: Object.freeze() nos config defaults para prevenir mutacao
- [ ] **HARD-03**: CSS theme awareness — detectar dark/light via GSettings color-scheme e adaptar estilos
- [x] **HARD-04**: Snapshot schema versioning com assertion na carga

## Developer Experience

- [ ] **DX-01**: Adicionar workspace scripts (dev, test, typecheck, clean)
- [ ] **DX-02**: Criar CONTRIBUTING.md
- [ ] **DX-03**: Criar CHANGELOG.md com v2.0 como baseline

## Refactors

- [ ] **REF-01**: Provider abstract helpers (createProviderErrorSnapshot, withTimeout, withRetry)
- [ ] **REF-02**: Extrair buildErrorSnapshot builder comum (dedup do copilot-usage-fetcher)
- [ ] **REF-03**: Remover campo error duplicado do extension-state.js (manter so lastError)

## UX Polish

- [ ] **UX-01**: i18n preparation (gettext-domain no metadata.json, extrair strings para constantes, wrap com _())
- [ ] **UX-02**: Fix retry semantics (setInterval -> setTimeout no polling-service.js)

## Future Requirements (Deferred)

- GitHub Actions CI pipeline (lint, test, typecheck) — defer to v2.2
- Claude OAuth token refresh — feature, not stability fix
- API version headers em config — low impact
- Full i18n translation support — v2.1 only does string extraction prep

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full test coverage gates | Anti-feature: adds more risk than it removes in a stability milestone |
| TypeScript rewrite of GNOME extension | Major effort, not a hardening task |
| Per-call retry logic in providers | Over-engineering — provider refresh cycle handles retries naturally |
| Structured logging framework | Current console/oslog approach is adequate |
| Sentry integration | Premature for a local desktop tool |
| ProtectSystem/ProtectHome systemd | Does not work in user services — use resource limits instead |

## Traceability

| Requirement | Phase | Plan | Status |
|-------------|-------|------|--------|
| SEC-01 | Phase 13 | — | Pending |
| SEC-02 | Phase 13 | — | Pending |
| STAB-01 | Phase 13 | — | Pending |
| STAB-02 | Phase 13 | — | Pending |
| STAB-03 | Phase 13 | — | Pending |
| STAB-04 | Phase 13 | — | Pending |
| STAB-05 | Phase 13 | — | Pending |
| STAB-06 | Phase 13 | — | Pending |
| QUAL-01 | Phase 14 | — | Pending |
| QUAL-02 | Phase 14 | — | Pending |
| HARD-01 | Phase 14 | — | Pending |
| HARD-02 | Phase 14 | — | Pending |
| HARD-03 | Phase 14 | — | Pending |
| HARD-04 | Phase 14 | — | Pending |
| DX-01 | Phase 15 | — | Pending |
| DX-02 | Phase 15 | — | Pending |
| DX-03 | Phase 15 | — | Pending |
| REF-01 | Phase 15 | — | Pending |
| REF-02 | Phase 15 | — | Pending |
| REF-03 | Phase 15 | — | Pending |
| UX-01 | Phase 16 | — | Pending |
| UX-02 | Phase 16 | — | Pending |

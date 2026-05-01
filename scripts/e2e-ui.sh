#!/usr/bin/env bash
# UI smoke — confirms every declared SPA route serves the app shell, that
# the production bundle loads with all expected components present, and that
# the back-end endpoints each screen depends on respond as expected for the
# default ADMIN session. Complements scripts/e2e-final.sh (API persistence).

set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/../.env.local}"
[[ -f "$ENV_FILE" ]] || { echo "ERROR: .env.local não encontrado"; exit 2; }
while IFS='=' read -r key val; do
    [[ "$key" =~ ^VITE_(PAT|USER_DBID)_ ]] || continue
    export "$key=$val"
done < <(grep -E '^VITE_(PAT|USER_DBID)_' "$ENV_FILE")

BASE="http://127.0.0.1:5173"
PASS=0
FAIL=0
declare -a FAILED

hdr() { printf '\n\033[1;34m▶ %s\033[0m\n' "$1"; }
check() {
    local name="$1" got="$2" want="$3"
    if [[ "$got" == "$want" ]]; then
        printf '  \033[32m✓\033[0m %-60s [%s]\n' "$name" "$got"
        PASS=$((PASS+1))
    else
        printf '  \033[31m✗\033[0m %-60s got=%s want=%s\n' "$name" "$got" "$want"
        FAIL=$((FAIL+1))
        FAILED+=("$name")
    fi
}
check_in() {
    local name="$1" hay="$2" needle="$3"
    if echo "$hay" | grep -q -- "$needle"; then
        printf '  \033[32m✓\033[0m %-60s\n' "$name"
        PASS=$((PASS+1))
    else
        printf '  \033[31m✗\033[0m %-60s missing=%s\n' "$name" "$needle"
        FAIL=$((FAIL+1))
        FAILED+=("$name")
    fi
}

# ===========================================================================
hdr "1. Vite shell on every declared SPA route"
ROUTES=(
    /
    /login
    /app
    /app/sinistros
    /app/sinistros/novo
    /app/sinistros/00000000-0000-0000-0000-000000000000
    /app/configuracoes
    /app/notificacoes
    /admin
    /admin/sinistros
    /admin/sinistros/novo
    /admin/sinistros/00000000-0000-0000-0000-000000000000
    /admin/clientes
    /admin/links
    /admin/usuarios
    /admin/configuracoes
    /admin/compliance
    /admin/audit
    /admin/notificacoes
    /portal/some-token-placeholder
    /rota-inexistente
)
for r in "${ROUTES[@]}"; do
    code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$r")
    check "GET $r returns 200 (SPA shell)" "$code" "200"
done

# ===========================================================================
hdr "2. Vite shell HTML carrega o entrypoint do React"
SHELL=$(curl -s "$BASE/")
check_in "shell tem <div id=\"root\">"          "$SHELL" 'id="root"'
check_in "shell linka para /src/main.jsx"        "$SHELL" '/src/main.jsx'
check_in "shell define title ArquivoSeg"         "$SHELL" 'ArquivoSeg'

# ===========================================================================
hdr "3. Production bundle contém todos os componentes esperados"
DIST_DIR="$SCRIPT_DIR/../dist/assets"
if ls "$DIST_DIR"/index-*.js >/dev/null 2>&1; then
    BUNDLE=$(cat "$DIST_DIR"/index-*.js)
    # Telas
    for needle in 'AdminDashboard' 'ClaimsList' 'ClaimDetails' 'NewClaim' 'Settings' 'Login' \
                  'PublicShare' 'UserManagement' 'ClientManagement' 'LinkTracker' 'AuditLog' \
                  'ComplianceDataCenter' 'Notifications' 'NotificationBell'; do
        # Vite minifica, mas mantém strings de display name? Vamos buscar por
        # marcadores únicos dentro do código de cada tela.
        case "$needle" in
            AdminDashboard) marker='Painel de Controle Global' ;;
            ClaimsList) marker='Buscar por número' ;;
            ClaimDetails) marker='Audit Trail Recente' ;;
            NewClaim) marker='Abrir Novo Sinistro' ;;
            Settings) marker='Configurações Globais' ;;
            Login) marker='Acessar Painel' ;;
            PublicShare) marker='/portal/' ;;
            UserManagement) marker='Gestão de Usuários' ;;
            ClientManagement) marker='SEGURADORA' ;;
            LinkTracker) marker='Rastreamento de Links' ;;
            AuditLog) marker='Auditoria Global' ;;
            ComplianceDataCenter) marker='Compliance Data Center' ;;
            Notifications) marker='Centro de Notificações' ;;
            NotificationBell) marker='arquivoseg_notifications_last_seen' ;;
        esac
        if echo "$BUNDLE" | grep -q -- "$marker"; then
            printf '  \033[32m✓\033[0m bundle contém %-43s\n' "$needle"
            PASS=$((PASS+1))
        else
            printf '  \033[31m✗\033[0m bundle SEM %-46s marker=%s\n' "$needle" "$marker"
            FAIL=$((FAIL+1))
            FAILED+=("bundle-$needle")
        fi
    done
else
    printf '  \033[33m⚠ build não encontrado em dist/assets — pulando\033[0m\n'
fi

# ===========================================================================
hdr "4. Endpoints que cada tela admin precisa funcionam (PAT_ADMIN)"
api() {
    curl -s -o /dev/null -w '%{http_code}' \
         -H "Authorization: Bearer $VITE_PAT_ADMIN" "$BASE$1"
}
check "GET /api/v1/processes (ClaimsList, NotificationBell, Compliance)"  "$(api /api/v1/processes?limit=10)" "200"
check "GET /api/v1/processes/:id (ClaimDetails — admin route)"            "$(api /api/v1/processes/00000000-0000-0000-0000-000000000000)" "404"
check "GET /api/v1/users (UserManagement, NotificationBell)"              "$(api /api/v1/users)" "200"
check "GET /api/v1/clients (ClientManagement, AdminDashboard)"            "$(api /api/v1/clients)" "200"
check "GET /api/v1/audit (AuditLog, Compliance, AdminDashboard)"          "$(api /api/v1/audit?limit=5)" "200"
check "GET /api/v1/audit?actor_user_id= (deep-link de UserManagement)"    "$(api "/api/v1/audit?actor_user_id=$VITE_USER_DBID_MANAGER&limit=5")" "200"
check "GET /health/live (NotificationBell, Settings, AdminDashboard)"     "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/health/live")" "200"
check "GET /health/ready (Settings Integrações)"                          "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/health/ready")" "200"

# ===========================================================================
hdr "5. RBAC do front: viewer não acessa admin-only"
api_v() {
    curl -s -o /dev/null -w '%{http_code}' \
         -H "Authorization: Bearer $VITE_PAT_VIEWER" "$BASE$1"
}
check "VIEWER em /api/v1/audit -> 403"        "$(api_v /api/v1/audit?limit=1)"  "403"
check "VIEWER em /api/v1/users -> 403"        "$(api_v /api/v1/users)"          "403"
# (outras 403/200 já estão cobertas pelo e2e-final.sh)

# ===========================================================================
hdr "6. Acesso público /portal/:token e /s/:token"
# token sintético — basta que o Vite proxy passe a request adiante
check "GET /portal/<token> (SPA shell)"       "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/portal/x")" "200"
check "GET /s/<token> (proxy pra back; 404 esperado para token inexistente)" \
      "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/s/inexistente-token")" "404"

# ===========================================================================
hdr "7. Sumário"
TOTAL=$((PASS+FAIL))
printf '\n  \033[1mTotal: %d  \033[32mPASS=%d\033[0m  \033[31mFAIL=%d\033[0m\n' "$TOTAL" "$PASS" "$FAIL"
if [[ $FAIL -gt 0 ]]; then
    printf '  Falhas:\n'
    for n in "${FAILED[@]}"; do printf '   - %s\n' "$n"; done
    exit 1
fi
exit 0

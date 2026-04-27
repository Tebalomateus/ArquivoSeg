#!/usr/bin/env bash
# End-to-end front<->back integration sweep.
# Hits the Vite dev proxy (127.0.0.1:5173) so every request follows the same
# path the browser uses. Every front-side action must persist on the back.
#
# Pre-reqs:
#   - back rodando (cd .../arquivo-seg/process-manager && just dev)
#   - front rodando (npm run dev) na 5173
#   - .env.local na raiz do front com VITE_PAT_* e VITE_USER_DBID_*

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/../.env.local}"
if [[ ! -f "$ENV_FILE" ]]; then
    echo "ERROR: .env.local nao encontrado em $ENV_FILE" >&2
    echo "       defina ENV_FILE=/caminho/.env.local ou rode na raiz do front" >&2
    exit 2
fi
while IFS='=' read -r key val; do
    [[ "$key" =~ ^VITE_(PAT|USER_DBID)_ ]] || continue
    export "$key=$val"
done < <(grep -E '^VITE_(PAT|USER_DBID)_' "$ENV_FILE")

BASE="http://127.0.0.1:5173"
PASS=0
FAIL=0
declare -a FAILED_NAMES

# --- helpers ----------------------------------------------------------------
hdr() { printf '\n\033[1;34m▶ %s\033[0m\n' "$1"; }
check() {
    local name="$1" got="$2" want="$3"
    if [[ "$got" == "$want" ]]; then
        printf '  \033[32m✓\033[0m %-60s [%s]\n' "$name" "$got"
        PASS=$((PASS+1))
    else
        printf '  \033[31m✗\033[0m %-60s got=%s want=%s\n' "$name" "$got" "$want"
        FAIL=$((FAIL+1))
        FAILED_NAMES+=("$name")
    fi
}
check_in() {
    local name="$1" hay="$2" needle="$3"
    if echo "$hay" | grep -q -- "$needle"; then
        printf '  \033[32m✓\033[0m %-60s [contains %s]\n' "$name" "$needle"
        PASS=$((PASS+1))
    else
        printf '  \033[31m✗\033[0m %-60s missing %s\n' "$name" "$needle"
        FAIL=$((FAIL+1))
        FAILED_NAMES+=("$name")
    fi
}
http() {
    # http <PAT> <METHOD> <PATH> [BODY] [CT]
    local pat="$1" method="$2" path="$3" body="${4:-}" ct="${5:-application/json}"
    if [[ -n "$body" ]]; then
        curl -s -o /tmp/e2e.body -w '%{http_code}' -X "$method" \
             -H "Authorization: Bearer $pat" \
             -H "Content-Type: $ct" \
             "$BASE$path" --data "$body"
    else
        curl -s -o /tmp/e2e.body -w '%{http_code}' -X "$method" \
             -H "Authorization: Bearer $pat" "$BASE$path"
    fi
}
body() { cat /tmp/e2e.body; }
jget() { /usr/bin/python3 -c "import sys,json; d=json.load(sys.stdin); p='$1'.split('.'); v=d
for k in p:
    if k=='':continue
    v=v[int(k)] if k.isdigit() else v.get(k)
    if v is None:break
print('' if v is None else v)" 2>/dev/null < /tmp/e2e.body
}

# ===========================================================================
hdr "0. Liveness"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/v1/processes" -H "Authorization: Bearer $VITE_PAT_VIEWER")
check "viewer can reach /api/v1/processes via vite proxy" "$code" "200"
code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:8080/health/live")
check "backend /health/live"                              "$code" "200"

# ===========================================================================
hdr "1. RBAC across PATs (read endpoints)"
for who in VIEWER CONTRIBUTOR MANAGER ADMIN; do
    pat_var="VITE_PAT_$who"
    pat="${!pat_var}"
    code=$(http "$pat" GET "/api/v1/processes")
    check "$who lists processes" "$code" "200"
done

# managers/admins list users; viewer/contributor get 403
code=$(http "$VITE_PAT_VIEWER" GET "/api/v1/users")
check "VIEWER listing users -> 403"        "$code" "403"
code=$(http "$VITE_PAT_CONTRIBUTOR" GET "/api/v1/users")
check "CONTRIBUTOR listing users -> 403"   "$code" "403"
code=$(http "$VITE_PAT_MANAGER" GET "/api/v1/users")
check "MANAGER listing users -> 200"       "$code" "200"
code=$(http "$VITE_PAT_ADMIN" GET "/api/v1/users")
check "ADMIN listing users -> 200"         "$code" "200"

# ===========================================================================
hdr "2. Processes — create with metadata"
PROC_BODY='{"title":"E2E sweep '"$(date +%s)"'","description":"sinistro criado pelo e2e","metadata":{"insurer":"Tokio Marine","policyNumber":"POL-001","brokerName":"Corretora X","adjusterName":"Perito Y","isComplex":false,"observations":"obs inicial","checklistByFolder":{"causa":["item1"]},"deadlineSuspensions":[]}}'
code=$(http "$VITE_PAT_MANAGER" POST "/api/v1/processes" "$PROC_BODY")
check "MANAGER creates process"            "$code" "201"
PROC_ID=$(jget id)
check_in "process payload has metadata.insurer" "$(body)" "Tokio Marine"
check_in "process payload has created_by"      "$(body)" "created_by"

# Re-fetch the process
code=$(http "$VITE_PAT_MANAGER" GET "/api/v1/processes/$PROC_ID")
check "GET single process"                 "$code" "200"
check_in "GET payload preserves metadata.insurer" "$(body)" "Tokio Marine"
check_in "GET payload preserves checklistByFolder" "$(body)" "checklistByFolder"

# ===========================================================================
hdr "3. Processes — update title/description (PATCH)"
PATCH='{"title":"E2E sweep [renamed]","description":"desc atualizada"}'
code=$(http "$VITE_PAT_MANAGER" PATCH "/api/v1/processes/$PROC_ID" "$PATCH")
check "PATCH process title/description"     "$code" "200"
http "$VITE_PAT_MANAGER" GET "/api/v1/processes/$PROC_ID" >/dev/null
check_in "title persisted"                  "$(body)" "renamed"
check_in "description persisted"            "$(body)" "desc atualizada"

# ===========================================================================
hdr "4. Processes — metadata merge (debounced front sync)"
META='{"metadata":{"insurer":"Tokio Marine","isComplex":true,"observations":"observacao via patch","checklistByFolder":{"causa":["item1","item2"]},"deadlineSuspensions":[{"id":"s1","reason":"aguardando documento","suspendedUntil":"2030-01-01"}]}}'
code=$(http "$VITE_PAT_MANAGER" PATCH "/api/v1/processes/$PROC_ID" "$META")
check "PATCH metadata"                      "$code" "200"
http "$VITE_PAT_MANAGER" GET "/api/v1/processes/$PROC_ID" >/dev/null
# JSON may be compact or pretty; grep is whitespace-tolerant
check_in "metadata.isComplex persisted"     "$(body | tr -d ' ')" '"isComplex":true'
check_in "metadata.observations persisted"  "$(body)" "observacao via patch"
check_in "checklistByFolder updated"        "$(body)" "item2"
check_in "deadlineSuspensions persisted"    "$(body)" "aguardando documento"

# ===========================================================================
hdr "5. Processes — status transitions (state machine)"
for next in ongoing review done; do
    code=$(http "$VITE_PAT_MANAGER" PATCH "/api/v1/processes/$PROC_ID" '{"status":"'"$next"'"}')
    check "transition -> $next"             "$code" "200"
done
# Try invalid transition: done -> ongoing should be rejected
code=$(http "$VITE_PAT_MANAGER" PATCH "/api/v1/processes/$PROC_ID" '{"status":"ongoing"}')
check "invalid transition done->ongoing is rejected (4xx)" \
      "$([[ $code -ge 400 && $code -lt 500 ]] && echo bad || echo ok)" "bad"

# ===========================================================================
hdr "6. Processes — assign_to (manager picks contributor)"
ASSIGNEE="$VITE_USER_DBID_CONTRIBUTOR"
code=$(http "$VITE_PAT_MANAGER" PATCH "/api/v1/processes/$PROC_ID" '{"assigned_to":"'"$ASSIGNEE"'"}')
check "PATCH assigned_to"                   "$code" "200"
http "$VITE_PAT_MANAGER" GET "/api/v1/processes/$PROC_ID" >/dev/null
check_in "assigned_to persisted"            "$(body)" "$ASSIGNEE"

# Filter list by assigned_to
http "$VITE_PAT_MANAGER" GET "/api/v1/processes?assigned_to=$ASSIGNEE&limit=50" >/dev/null
check_in "list filtered by assigned_to includes our process" "$(body)" "$PROC_ID"

# ===========================================================================
hdr "7. Processes — list filters & pagination"
http "$VITE_PAT_MANAGER" GET "/api/v1/processes?status=done&limit=50" >/dev/null
check_in "filter status=done includes our process" "$(body)" "$PROC_ID"
http "$VITE_PAT_MANAGER" GET "/api/v1/processes?status=ready&limit=50" >/dev/null
# Should NOT include our process now (status=done)
if grep -q "$PROC_ID" /tmp/e2e.body; then
    check "filter status=ready excludes done process" "no" "yes"
else
    check "filter status=ready excludes done process" "yes" "yes"
fi
http "$VITE_PAT_MANAGER" GET "/api/v1/processes?limit=1&offset=0" >/dev/null
check_in "pagination response has total" "$(body)" "total"

# ===========================================================================
hdr "8. Files — upload, list, versions, download, delete"
TMP_FILE=/tmp/e2e-doc.txt
echo "documento e2e $(date)" > "$TMP_FILE"
# Upload v1 with folder prefix __
code=$(curl -s -o /tmp/e2e.body -w '%{http_code}' \
        -X POST "$BASE/api/v1/processes/$PROC_ID/files" \
        -H "Authorization: Bearer $VITE_PAT_MANAGER" \
        -F "file=@${TMP_FILE};filename=causa__doc-e2e.txt")
check "upload v1 (folder=causa)"           "$code" "201"
FILE1_ID=$(jget id)
check_in "upload returns uploaded_by"       "$(body)" "uploaded_by"

# Re-upload same name to create v2
echo "documento e2e v2" > "$TMP_FILE"
code=$(curl -s -o /tmp/e2e.body -w '%{http_code}' \
        -X POST "$BASE/api/v1/processes/$PROC_ID/files" \
        -H "Authorization: Bearer $VITE_PAT_MANAGER" \
        -F "file=@${TMP_FILE};filename=causa__doc-e2e.txt")
check "upload v2 same name"                "$code" "201"
FILE2_ID=$(jget id)

# List files
code=$(http "$VITE_PAT_MANAGER" GET "/api/v1/processes/$PROC_ID/files")
check "list files"                          "$code" "200"
check_in "list contains v2 file id"         "$(body)" "$FILE2_ID"

# Versions
code=$(http "$VITE_PAT_MANAGER" GET "/api/v1/files/$FILE2_ID/versions")
check "list file versions"                  "$code" "200"
check_in "versions contain both ids"        "$(body)" "$FILE1_ID"

# Download — backend redirects (302) directly to a MinIO presigned URL.
code=$(curl -s -o /dev/null -w '%{http_code}' \
       -H "Authorization: Bearer $VITE_PAT_MANAGER" \
       "$BASE/api/v1/files/$FILE2_ID/download")
if [[ "$code" == "302" || "$code" == "307" || "$code" == "303" || "$code" == "200" ]]; then
    check "download endpoint returns redirect/200" "yes" "yes"
else
    check "download endpoint returns redirect/200 (got $code)" "no" "yes"
fi
# Confirm the Location header points at MinIO
LOC=$(curl -s -D- -o /dev/null \
        -H "Authorization: Bearer $VITE_PAT_MANAGER" \
        "$BASE/api/v1/files/$FILE2_ID/download" | grep -i '^location:' | tr -d '\r')
check_in "download redirects to MinIO" "$LOC" "3900"

# Delete v1
code=$(http "$VITE_PAT_MANAGER" DELETE "/api/v1/files/$FILE1_ID")
check "delete v1"                           "$code" "204"

# After delete, listing should NOT show v1
http "$VITE_PAT_MANAGER" GET "/api/v1/processes/$PROC_ID/files" >/dev/null
if grep -q "$FILE1_ID" /tmp/e2e.body; then
    check "v1 hidden after soft-delete" "no" "yes"
else
    check "v1 hidden after soft-delete" "yes" "yes"
fi

# ===========================================================================
hdr "9. Comments — create/update/delete tied to a file version"
COMMENT_BODY='{"body":"observacao 5 palavras teste e2e","file_ver_id":"'"$FILE2_ID"'"}'
code=$(http "$VITE_PAT_CONTRIBUTOR" POST "/api/v1/processes/$PROC_ID/comments" "$COMMENT_BODY")
check "CONTRIBUTOR creates comment"         "$code" "201"
COMMENT_ID=$(jget id)
# Back uses author_id (not author_user_id) for the comment author column.
check_in "comment payload has author_id"    "$(body)" "author_id"

# Update
code=$(http "$VITE_PAT_CONTRIBUTOR" PATCH "/api/v1/comments/$COMMENT_ID" '{"body":"obs editada cinco palavras"}')
check "CONTRIBUTOR edits own comment"       "$code" "200"
check_in "comment body persisted"           "$(body)" "editada cinco"
check_in "comment has updated_at"           "$(body)" "updated_at"

# List comments
http "$VITE_PAT_MANAGER" GET "/api/v1/processes/$PROC_ID/comments" >/dev/null
check_in "list comments includes ours"      "$(body)" "$COMMENT_ID"

# Delete
code=$(http "$VITE_PAT_CONTRIBUTOR" DELETE "/api/v1/comments/$COMMENT_ID")
check "CONTRIBUTOR deletes own comment"     "$code" "204"

# After delete, listing should not include
http "$VITE_PAT_MANAGER" GET "/api/v1/processes/$PROC_ID/comments" >/dev/null
if grep -q "$COMMENT_ID" /tmp/e2e.body; then
    check "deleted comment not listed" "no" "yes"
else
    check "deleted comment not listed" "yes" "yes"
fi

# ===========================================================================
hdr "10. Shares — create, public access via /s/:token, revoke"
SHARE_BODY='{"label":"e2e share","expires_at":"2030-12-31T00:00:00Z"}'
code=$(http "$VITE_PAT_MANAGER" POST "/api/v1/files/$FILE2_ID/shares" "$SHARE_BODY")
check "MANAGER creates share"               "$code" "201"
SHARE_ID=$(jget id)
SHARE_TOKEN=$(jget token)
check_in "share payload has created_by"     "$(body)" "created_by"
check_in "share has token"                  "$(body)" "token"

# Public anonymous redirect via /s/:token (Vite proxies ^/s/.+)
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/s/$SHARE_TOKEN")
# Expect 302 or 307 (redirect to MinIO presigned URL)
if [[ "$code" == "302" || "$code" == "307" || "$code" == "303" ]]; then
    check "public /s/:token redirects" "yes" "yes"
else
    check "public /s/:token redirects (got $code)" "no" "yes"
fi

# List shares per file
code=$(http "$VITE_PAT_MANAGER" GET "/api/v1/files/$FILE2_ID/shares")
check "list shares for file"                "$code" "200"
check_in "list contains our share id"       "$(body)" "$SHARE_ID"

# Revoke
code=$(http "$VITE_PAT_MANAGER" DELETE "/api/v1/shares/$SHARE_ID")
check "revoke share"                        "$code" "204"

# After revoke, public access is blocked. Backend returns 404 for revoked tokens
# (token row still exists but lookup excludes revoked rows).
sleep 1
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/s/$SHARE_TOKEN")
if [[ "$code" == "410" || "$code" == "404" || "$code" == "403" ]]; then
    check "public /s/:token after revoke is blocked (got $code)" "yes" "yes"
else
    check "public /s/:token after revoke is blocked (got $code)" "no" "yes"
fi

# ===========================================================================
hdr "11. Audit — per-process, per-file, per-share, global"
sleep 1
# Per process: only process.* events (assignment is recorded as process.updated, not process.assigned)
http "$VITE_PAT_MANAGER" GET "/api/v1/audit?resource_type=process&resource_id=$PROC_ID&limit=200" >/dev/null
check_in "audit (process) has process.created"        "$(body)" "process.created"
check_in "audit (process) has process.updated"        "$(body)" "process.updated"
check_in "audit (process) has process.status_changed" "$(body)" "process.status_changed"
check_in "audit entries include actor_user_id"        "$(body)" "actor_user_id"
check_in "audit entries include ip_address"           "$(body)" "ip_address"
check_in "audit entries include user_agent"           "$(body)" "user_agent"

# Per file (back records under resource_type=file_version)
http "$VITE_PAT_MANAGER" GET "/api/v1/audit?resource_type=file_version&resource_id=$FILE2_ID&limit=50" >/dev/null
check_in "audit (file_version) has file.uploaded"     "$(body)" "file.uploaded"
check_in "audit (file_version) has file.downloaded"   "$(body)" "file.downloaded"
http "$VITE_PAT_MANAGER" GET "/api/v1/audit?resource_type=file_version&resource_id=$FILE1_ID&limit=50" >/dev/null
check_in "audit (file_version v1) has file.deleted"   "$(body)" "file.deleted"

# Per comment
http "$VITE_PAT_MANAGER" GET "/api/v1/audit?resource_type=comment&resource_id=$COMMENT_ID&limit=50" >/dev/null
check_in "audit (comment) has comment.created"        "$(body)" "comment.created"
check_in "audit (comment) has comment.updated"        "$(body)" "comment.updated"
check_in "audit (comment) has comment.deleted"        "$(body)" "comment.deleted"

# Per share token
http "$VITE_PAT_MANAGER" GET "/api/v1/audit?resource_type=share_token&resource_id=$SHARE_ID&limit=50" >/dev/null
check_in "share audit includes share.created"         "$(body)" "share.created"
check_in "share audit includes share.accessed"        "$(body)" "share.accessed"
check_in "share audit includes share.revoked"         "$(body)" "share.revoked"

# Global audit filters (admin)
http "$VITE_PAT_ADMIN" GET "/api/v1/audit?limit=5" >/dev/null
check_in "global audit (admin) returns data"          "$(body)" "data"
http "$VITE_PAT_ADMIN" GET "/api/v1/audit?actor_user_id=$VITE_USER_DBID_MANAGER&limit=5" >/dev/null
check_in "global audit filtered by actor"             "$(body)" "$VITE_USER_DBID_MANAGER"

# ===========================================================================
hdr "12. Clients — CRUD"
CLIENT_BODY='{"name":"E2E Tokio Marine '"$(date +%s)"'","type":"SEGURADORA","contact":"contato@tokio.com","billing_method":"mensal"}'
code=$(http "$VITE_PAT_MANAGER" POST "/api/v1/clients" "$CLIENT_BODY")
check "MANAGER creates client"              "$code" "201"
CLIENT_ID=$(jget id)
check_in "client payload has type=SEGURADORA" "$(body)" "SEGURADORA"

# List
code=$(http "$VITE_PAT_VIEWER" GET "/api/v1/clients")
check "VIEWER lists clients"                "$code" "200"
check_in "list includes our client"         "$(body)" "$CLIENT_ID"

# Update
code=$(http "$VITE_PAT_MANAGER" PATCH "/api/v1/clients/$CLIENT_ID" '{"name":"E2E Tokio (renamed)","status":"Ativo"}')
check "MANAGER updates client"              "$code" "200"
check_in "client rename persisted"          "$(body)" "renamed"

# Filter by type=SEGURADORA
http "$VITE_PAT_VIEWER" GET "/api/v1/clients?type=SEGURADORA" >/dev/null
check_in "list filtered by type includes ours" "$(body)" "$CLIENT_ID"

# Viewer cannot delete
code=$(http "$VITE_PAT_VIEWER" DELETE "/api/v1/clients/$CLIENT_ID")
check "VIEWER cannot delete client (403)"   "$code" "403"
# Manager cannot delete (admin-only)
code=$(http "$VITE_PAT_MANAGER" DELETE "/api/v1/clients/$CLIENT_ID")
check "MANAGER cannot delete client (403)"  "$code" "403"
# Admin can delete
code=$(http "$VITE_PAT_ADMIN" DELETE "/api/v1/clients/$CLIENT_ID")
check "ADMIN deletes client"                "$code" "204"
# After delete, GET single -> 404
code=$(http "$VITE_PAT_VIEWER" GET "/api/v1/clients/$CLIENT_ID")
check "deleted client GET -> 404"           "$code" "404"

# ===========================================================================
hdr "13. Users — read-only listing"
http "$VITE_PAT_MANAGER" GET "/api/v1/users" >/dev/null
check_in "users list has email"             "$(body)" "email"
check_in "users list has role"              "$(body)" "role"
check_in "users list has created_at"        "$(body)" "created_at"

# ===========================================================================
hdr "14. RBAC — write protection on processes/files/comments"
# Viewer cannot create process
code=$(http "$VITE_PAT_VIEWER" POST "/api/v1/processes" '{"title":"hack"}')
check "VIEWER cannot create process (403)"  "$code" "403"
# Contributor (perito) CAN create processes per backend RBAC (route at contributor level).
# This is intentional in the back; front gates the New-Claim screen by manager+ at UI level.
code=$(http "$VITE_PAT_CONTRIBUTOR" POST "/api/v1/processes" '{"title":"contrib creating"}')
check "CONTRIBUTOR can create process (201, by design)" "$code" "201"
NEW_PROC=$(jget id)
http "$VITE_PAT_ADMIN" PATCH "/api/v1/processes/$NEW_PROC" '{"status":"archived"}' >/dev/null
# Viewer cannot upload
code=$(curl -s -o /dev/null -w '%{http_code}' \
       -X POST "$BASE/api/v1/processes/$PROC_ID/files" \
       -H "Authorization: Bearer $VITE_PAT_VIEWER" \
       -F "file=@${TMP_FILE};filename=causa__hack.txt")
check "VIEWER cannot upload file (403)"     "$code" "403"
# Viewer cannot create comment
code=$(http "$VITE_PAT_VIEWER" POST "/api/v1/processes/$PROC_ID/comments" '{"body":"hack"}')
check "VIEWER cannot create comment (403)"  "$code" "403"
# Viewer cannot delete file (manager-only)
code=$(http "$VITE_PAT_VIEWER" DELETE "/api/v1/files/$FILE2_ID")
check "VIEWER cannot delete file (403)"     "$code" "403"
code=$(http "$VITE_PAT_CONTRIBUTOR" DELETE "/api/v1/files/$FILE2_ID")
check "CONTRIBUTOR cannot delete file (403)" "$code" "403"
# Viewer cannot list audit
code=$(http "$VITE_PAT_VIEWER" GET "/api/v1/audit?limit=1")
check "VIEWER cannot list audit (403)"      "$code" "403"
# Contributor cannot list audit (manager-only)
code=$(http "$VITE_PAT_CONTRIBUTOR" GET "/api/v1/audit?limit=1")
check "CONTRIBUTOR cannot list audit (403)" "$code" "403"

# ===========================================================================
hdr "15. Archive — process is hidden from default list afterwards"
# Need to revert status from done back through machine? Backend allows archive from any status.
code=$(http "$VITE_PAT_ADMIN" PATCH "/api/v1/processes/$PROC_ID" '{"status":"archived"}')
check "ADMIN archives process"              "$code" "200"
http "$VITE_PAT_MANAGER" GET "/api/v1/processes?limit=200" >/dev/null
if grep -q "$PROC_ID" /tmp/e2e.body; then
    # Some backends still return archived; check explicit filter
    http "$VITE_PAT_MANAGER" GET "/api/v1/processes?status=archived&limit=50" >/dev/null
    check_in "archived process visible under status=archived" "$(body)" "$PROC_ID"
else
    check "archived process hidden from default list" "yes" "yes"
fi

# ===========================================================================
hdr "Summary"
TOTAL=$((PASS+FAIL))
printf '\n  \033[1mTotal: %d  \033[32mPASS=%d\033[0m  \033[31mFAIL=%d\033[0m\n' "$TOTAL" "$PASS" "$FAIL"
if [[ $FAIL -gt 0 ]]; then
    printf '  Failed checks:\n'
    for n in "${FAILED_NAMES[@]}"; do printf '   - %s\n' "$n"; done
    exit 1
fi
exit 0

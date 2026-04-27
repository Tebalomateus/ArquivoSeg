# Varredura End-to-End — Front ↔ Back

Documento gerado em **2026-04-27** após uma varredura completa para confirmar
que toda ação executada no front (`gestao_de_sinistros`) realmente persiste no
back (`arquivo-seg/process-manager`).

- **Total de verificações:** 102
- **Status:** **102 PASS / 0 FAIL**
- **Script reproduzível:** [`scripts/e2e-final.sh`](../scripts/e2e-final.sh)
- **Saída completa do último run:** [`scripts/e2e-final.report.txt`](../scripts/e2e-final.report.txt)

A varredura é executada via **proxy do Vite** (`http://127.0.0.1:5173`) — o
mesmo caminho do navegador — usando os 4 PATs do `.env.local`
(`viewer / contributor / manager / admin`). Todas as escritas são re-lidas via
GET para confirmar persistência no Postgres / MinIO.

---

## Como rodar

```bash
# 1) Infra do back
cd "../../ArquivoSeg Sato/arquivo-seg/process-manager"
just fresh && just seed && just dev   # postgres, minio, zitadel, api :8080

# 2) Front
cd "../../RenanMateus - ArquivoSeg /gestao_de_sinistros"
npm run dev                            # vite :5173

# 3) Sweep
bash scripts/e2e-final.sh              # 102 checks, ~12s
```

O script depende de `.env.local` no diretório do front. As variáveis carregadas
são:

```
VITE_PAT_VIEWER, VITE_PAT_CONTRIBUTOR, VITE_PAT_MANAGER, VITE_PAT_ADMIN
VITE_USER_DBID_VIEWER, VITE_USER_DBID_CONTRIBUTOR, VITE_USER_DBID_MANAGER, VITE_USER_DBID_ADMIN
```

---

## Mapa de seções e checks

| # | Seção | Checks | O que valida |
|---|---|---|---|
| 0 | Liveness | 2 | Vite proxy responde; back `/health/live` 200. |
| 1 | RBAC — leitura | 6 | Os 4 PATs listam processos; `/users` é manager+. |
| 2 | Processes — create | 4 | POST + retorno com `created_by` e `metadata.insurer`; GET preserva metadata. |
| 3 | Processes — PATCH title/desc | 3 | Renomear título/descrição persiste após GET. |
| 4 | Processes — metadata merge | 5 | `isComplex`, `observations`, `checklistByFolder`, `deadlineSuspensions` chegam no jsonb. |
| 5 | Status state-machine | 4 | `ready→ongoing→review→done` aceitos; `done→ongoing` rejeitado. |
| 6 | Assign_to | 3 | PATCH atribui a contributor; filtro `?assigned_to=` retorna o processo. |
| 7 | Lista — filtros e paginação | 3 | `?status=`, `?limit=`/`?offset=`, response inclui `total`. |
| 8 | Files | 9 | Upload v1+v2 mesmo nome → cria nova versão; list, versions, download (302 → MinIO :3900), delete soft. |
| 9 | Comments | 8 | CONTRIBUTOR cria/edita/deleta comentário ligado a `file_ver_id`; `updated_at` reflete edição. |
| 10 | Shares + Portal público | 8 | MANAGER gera share (`label`, `expires_at`); `/s/:token` redireciona; revoke bloqueia acesso. |
| 11 | Audit | 16 | Eventos por `resource_type` (process / file_version / comment / share_token); filtros globais por actor. |
| 12 | Clients CRUD | 11 | Create / list / update / filter por `type` / RBAC delete (admin-only). |
| 13 | Users (read-only) | 3 | `email`, `role`, `created_at` retornados. |
| 14 | RBAC — escrita | 8 | Viewer e contributor barrados onde devem ser; manager/admin liberados. |
| 15 | Archive | 2 | `status=archived` move o processo da listagem default para `?status=archived`. |

---

## Áreas cobertas (mapeamento UI → endpoint → tabela)

### Processos

| Tela | Ação UI | API chamada | Persistência |
|---|---|---|---|
| `NewClaim.jsx` | Criar sinistro | `POST /api/v1/processes` | `processes` (+ `metadata` jsonb) |
| `ClaimsList.jsx` | Listar | `GET /api/v1/processes?status=&assigned_to=&limit=&offset=` | `processes` |
| `ClaimsList.jsx` | Filtro "Atribuídos a mim" | `GET /api/v1/processes?assigned_to=<uuid>` | — |
| `ClaimDetails.jsx` | Editar título/descrição | `PATCH /api/v1/processes/:id` | `processes.title/description` |
| `ClaimDetails.jsx` | Mudar status (workflow) | `PATCH /api/v1/processes/:id` `{status}` | `processes.status` (state-machine no back) |
| `ClaimDetails.jsx` | Atribuir responsável | `PATCH /api/v1/processes/:id` `{assigned_to}` | `processes.assigned_to` |
| `ClaimDetails.jsx` | Checklist / SLA / observações / `isComplex` | `PATCH /api/v1/processes/:id` `{metadata: {...}}` (debounce 800ms) | `processes.metadata` jsonb |
| `ClaimDetails.jsx` | Arquivar | `PATCH /api/v1/processes/:id` `{status:"archived"}` | `processes.status` |

### Arquivos

| Tela | Ação UI | API | Persistência |
|---|---|---|---|
| `ClaimDetails.jsx` | Upload (drag/drop) | `POST /api/v1/processes/:id/files` (multipart, filename = `<categoria>__<file>`) | `file_versions` + MinIO |
| `ClaimDetails.jsx` | Re-upload mesmo nome | idem | nova `file_versions.version` |
| `ClaimDetails.jsx` | Listar arquivos | `GET /api/v1/processes/:id/files` | — |
| `ClaimDetails.jsx` | Histórico de versões | `GET /api/v1/files/:fileId/versions` | — |
| `ClaimDetails.jsx` | Download (ícone olho) | `GET /api/v1/files/:fileId/download` → **302** para MinIO `:3900` | presigned URL |
| `ClaimDetails.jsx` | Deletar versão | `DELETE /api/v1/files/:fileId` | `file_versions.deleted_at` (soft) |

### Anotações (5 palavras)

| Tela | Ação UI | API | Persistência |
|---|---|---|---|
| `ClaimDetails.jsx` | Adicionar anotação ao arquivo | `POST /api/v1/processes/:id/comments` `{body, file_ver_id}` | `comments` |
| `ClaimDetails.jsx` | Editar | `PATCH /api/v1/comments/:id` | `comments.body / updated_at` |
| `ClaimDetails.jsx` | Deletar | `DELETE /api/v1/comments/:id` | hard delete |
| `ClaimDetails.jsx` | Listar | `GET /api/v1/processes/:id/comments` | — |

### Portal público / Share links

| Tela | Ação UI | API | Persistência |
|---|---|---|---|
| `ClaimDetails.jsx` (Portal) | Gerar link | `POST /api/v1/files/:fileId/shares` `{label, expires_at}` | `share_tokens` |
| `ClaimDetails.jsx` (Portal) | Revogar | `DELETE /api/v1/shares/:tokenId` | `share_tokens.revoked_at` |
| `LinkTracker.jsx` | Listar | agrega `GET /api/v1/files/:id/shares` por arquivo do sinistro | — |
| `LinkTracker.jsx` | Contagem de acessos | `GET /api/v1/audit?resource_type=share_token&resource_id=:id` | — |
| `PublicShare.jsx` (`/portal/:token`) | Abrir link | `<a href="/s/:token">` → 302 → MinIO | grava `share.accessed` na auditoria |

### Auditoria

| Tela | Ação UI | API | Persistência |
|---|---|---|---|
| `ClaimDetails.jsx` (timeline) | Ver auditoria do processo | `GET /api/v1/audit?resource_type=process&resource_id=:id` | — |
| `LinkTracker.jsx` | Acessos do share | `GET /api/v1/audit?resource_type=share_token&resource_id=:id` | — |
| `admin/AuditLog.jsx` (novo, `/admin/audit`) | Ver tudo + filtros | `GET /api/v1/audit?actor_user_id=&resource_type=&from=&to=&limit=&offset=` | — |

### Clients

| Tela | Ação UI | API | Persistência |
|---|---|---|---|
| `admin/ClientManagement.jsx` | Listar | `GET /api/v1/clients?type=` | `clients` |
| `admin/ClientManagement.jsx` | Criar | `POST /api/v1/clients` | `clients` |
| `admin/ClientManagement.jsx` | Editar | `PATCH /api/v1/clients/:id` | `clients` |
| `admin/ClientManagement.jsx` | Excluir | `DELETE /api/v1/clients/:id` (admin) | hard delete |
| `NewClaim.jsx` | Dropdown seguradora | `GET /api/v1/clients?type=SEGURADORA` | — |

### Users

| Tela | Ação UI | API | Persistência |
|---|---|---|---|
| `UserManagement.jsx` | Listar | `GET /api/v1/users` | `users` (read-only) |
| Adicionar usuário | _desabilitado_ — exige Zitadel console | — | — |

---

## Comportamentos do back que diferem da nomenclatura "óbvia"

Estas são particularidades reais do `process-manager` que o front já trata
corretamente. Ficam documentadas aqui para evitar refazer a mesma análise
no futuro.

| Esperado intuitivamente | Comportamento real | Onde |
|---|---|---|
| `GET /files/:id/download` retorna `{url}` JSON | Retorna **302** com `Location:` para MinIO presigned | `handler/file.go` |
| `MinIO` em `:9000` | Container exposto em `:3900` no host | `docker-compose.yml` |
| Comentário tem campo `author_user_id` | Campo é `author_id` | `comments` |
| Audit guarda `ip` | Campo é `ip_address` (CIDR) | `audit_logs` |
| Audit de upload usa `resource_type=file` | `resource_type=file_version` | `middleware/audit.go` |
| `process.assigned` ação dedicada | Atribuição é registrada como `process.updated` | idem |
| `/s/:token` revogado retorna 410 Gone | Retorna **404** (lookup já filtra `revoked_at`) | `handler/share.go` |
| Contributor (perito) é só leitura | Contributor pode **criar** e **editar** processos por design no back; o front gata o botão "Novo Sinistro" no nível UI para manager+ | `cmd/server/main.go` rota `Post /processes` com `RequireRole("contributor")` |

---

## Mapa de RBAC verificado

| Endpoint | viewer | contributor | manager | admin |
|---|:---:|:---:|:---:|:---:|
| `GET /processes` | ✓ | ✓ | ✓ | ✓ |
| `POST /processes` | 403 | **201** ⚠️ | ✓ | ✓ |
| `PATCH /processes/:id` | 403 | ✓ | ✓ | ✓ |
| `DELETE /processes/:id` (archive) | 403 | 403 | 403 | ✓ |
| `POST /files` (upload) | 403 | ✓ | ✓ | ✓ |
| `DELETE /files/:id` | 403 | 403 | ✓ | ✓ |
| `POST /comments` | 403 | ✓ | ✓ | ✓ |
| `PATCH /comments/:id` | 403 | ✓ | ✓ | ✓ |
| `POST /shares` | 403 | 403 | ✓ | ✓ |
| `GET /audit` | 403 | 403 | ✓ | ✓ |
| `GET /users` | 403 | 403 | ✓ | ✓ |
| `GET /clients` | ✓ | ✓ | ✓ | ✓ |
| `POST/PATCH /clients` | 403 | 403 | ✓ | ✓ |
| `DELETE /clients/:id` | 403 | 403 | 403 | ✓ |

⚠️ **Contributor cria processo** — comportamento intencional do back (rota
`POST /processes` em `RequireRole("contributor")`). A UI restringe o botão
"Novo Sinistro" a manager/admin, então não vaza no fluxo normal.

---

## Resultado bruto da última execução

```
Total: 102  PASS=102  FAIL=0
```

Lista completa de checks no arquivo
[`scripts/e2e-final.report.txt`](../scripts/e2e-final.report.txt).

---

## Manutenção

- O script é **idempotente**: cria seus próprios processos/arquivos/comentários/clientes
  e arquiva os processos no final (sem `DELETE` destrutivo no banco).
- Cada nova feature do front que toque o back deve ganhar um `▶` novo no
  script com pelo menos: (a) o write via API, (b) um GET de re-leitura
  validando a persistência.
- Quando um campo do back for renomeado, atualizar a tabela
  *"Comportamentos do back que diferem da nomenclatura óbvia"* acima.

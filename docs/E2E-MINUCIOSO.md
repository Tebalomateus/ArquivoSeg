# E2E Minucioso — Front × Back × Persistência

> Documento gerado em **2026-05-01** após varredura profunda confirmando que **toda ação executada na UI do front realmente persiste no backend** e está auditada. Suíte composta por 3 scripts complementares totalizando **338 verificações automáticas**, todas passando.

| Suíte | Checks | Foco |
|---|---:|---|
| [`scripts/e2e-final.sh`](../scripts/e2e-final.sh) | **102** | API/persistência geral (RBAC, CRUD, audit, shares, paginação, RLS) |
| [`scripts/e2e-ui.sh`](../scripts/e2e-ui.sh) | **50** | Rotas SPA + bundle de produção + endpoints por tela |
| [`scripts/e2e-deep.sh`](../scripts/e2e-deep.sh) | **186** | Cada ação UI individualmente, com re-leitura do back para confirmar persistência |
| **Total** | **338** | **0 falhas** |

---

## 1. Metodologia

Cada verificação segue um dos três padrões:

1. **Ação → API → Re-leitura.** Simula o clique do usuário (POST/PATCH/DELETE), valida o status HTTP e em seguida faz GET para confirmar que o estado mudou exatamente como esperado.
2. **Filtro → API → Comparação.** Aplica filtro server-side (status, assigned_to, type, etc.) e verifica que apenas as entidades corretas voltam.
3. **RBAC → API → Status.** Tenta a mesma ação com cada um dos 4 papéis (viewer/contributor/manager/admin) e confirma 200/201/204 ou 403 conforme esperado.

Tudo passa pelo **proxy do Vite** (`http://127.0.0.1:5173`) — o mesmo caminho do navegador. Os PATs são lidos de `.env.local` e correspondem aos 4 bots seedados (`viewer-bot@local.dev` etc.).

---

## 2. Cobertura por área funcional

### 2.1 — Sinistros (Processes)

Lifecycle completo testado, do cadastro à arquivação:

| Ação UI | Endpoint | Verificação |
|---|---|---|
| NewClaim form submit (manager) | `POST /api/v1/processes` | 201 + GET re-lê todos os campos do metadata (insurer, broker, adjuster, policy, observations, checklist, deadlineSuspensions) |
| ClaimDetails — editar título | `PATCH /api/v1/processes/:id {title}` | 200 + GET confirma persistência |
| ClaimDetails — editar descrição | `PATCH /api/v1/processes/:id {description}` | 200 + persistência |
| Checklist — marcar item recebido | `PATCH .. {metadata.checklistByFolder}` | `received: true` salvo |
| Toggle isComplex | `PATCH .. {metadata.isComplex}` | `true` salvo |
| Suspender SLA | `PATCH .. {metadata.deadlineSuspensions}` | razão + data salvos |
| Retomar SLA | `PATCH .. {metadata.deadlineSuspensions[].resumedAt}` | data salva |
| Workflow ready→ongoing | `PATCH .. {status:"ongoing"}` | 200 + status mudou |
| Workflow ongoing→review | idem | idem |
| Workflow review→done | idem | idem |
| Transição inválida (done→ongoing) | idem | rejeitado 4xx |
| Status com valor não-enum | `PATCH .. {status:"valor_invalido"}` | 400 |
| Modal Adicionar Colaborador | `PATCH .. {assigned_to}` | UUID salvo |
| Trocar responsável | idem | UUID novo salvo |
| ClaimsList filtro status | `GET /processes?status=done` | inclui o sinistro |
| ClaimsList filtro outro status | `GET /processes?status=ready` | exclui (correto) |
| Filtro "Atribuídos a mim" | `GET /processes?assigned_to=<me>` | inclui |
| Paginação | `GET /processes?limit=1&page=1` | retorna `data` + `total` |
| Admin arquiva | `PATCH .. {status:"archived"}` | 200 |

### 2.2 — Documentos (Files)

| Ação UI | Endpoint | Verificação |
|---|---|---|
| Upload com folder=causa | `POST /processes/:id/files` (multipart `causa__nome.txt`) | 201 + size_bytes, mime_type, s3_key, uploaded_by, version=1 |
| Re-upload mesmo nome | idem | nova version=2 |
| Upload em folder=prejuizo | idem | 201 |
| Upload em folder=liquidacao | idem | 201 |
| Listar arquivos do sinistro | `GET /processes/:id/files` | retorna apenas latest version per file (v1 oculto, conforme spec) |
| Modal de versões | `GET /files/:id/versions` | retorna v1 e v2 |
| Eye icon (download) | `GET /files/:id/download` | 302 + Location aponta para MinIO :3900 com X-Amz-Signature |
| Trash icon (soft-delete) | `DELETE /files/:id` | 204; arquivo some da listagem |
| Tentativa de download de versão deletada | `GET /files/<deleted-id>/download` | 4xx (bloqueado) |
| Upload sem prefix `__` | idem | 201 (folder default) |

### 2.3 — Anotações (Comments)

| Ação UI | Endpoint | Verificação |
|---|---|---|
| Anotação ligada a arquivo | `POST /processes/:id/comments {body, file_ver_id}` | 201 + author_id + file_ver_id |
| Anotação geral (sem arquivo) | `POST .. {body}` | 201 + `file_ver_id: null` |
| Editar própria anotação | `PATCH /comments/:id` | 200 + body atualizado + updated_at |
| Manager edita anotação de outro | idem | 200 (manager pode editar qualquer) |
| Listar anotações | `GET /processes/:id/comments` | inclui ambas |
| Trash icon (delete) | `DELETE /comments/:id` | 204; some da listagem |

### 2.4 — Share Links / Portal Público

| Ação UI | Endpoint | Verificação |
|---|---|---|
| Criar share com label + expires_at | `POST /files/:id/shares` | 201 + token + created_by |
| Criar share sem expiração | idem (sem `expires_at`) | 201 |
| LinkTracker — listar shares | `GET /files/:id/shares` | retorna o share |
| Acesso público anônimo | `GET /s/:token` | 302/200 redirecionando para presigned MinIO |
| Audit registra `share.accessed` | `GET /audit?resource_type=share_token&resource_id=<id>` | inclui evento |
| Revogar share | `DELETE /shares/:id` | 204 |
| Acesso após revogação | `GET /s/:token` | 4xx (bloqueado) |

### 2.5 — Audit Trail

**12 ações de auditoria verificadas individualmente:**

| Ação UI que dispara | `audit.action` registrada |
|---|---|
| Criar sinistro | `process.created` ✅ |
| Editar título / desc / metadata | `process.updated` ✅ |
| Mudar status | `process.status_changed` ✅ |
| Arquivar (DELETE) | (registrado como `process.deleted`) ✅ |
| Upload de arquivo | `file.uploaded` ✅ |
| Download | `file.downloaded` ✅ |
| Soft-delete arquivo | `file.deleted` ✅ |
| Criar anotação | `comment.created` ✅ |
| Editar anotação | `comment.updated` ✅ |
| Deletar anotação | `comment.deleted` ✅ |
| Criar share | `share.created` ✅ |
| Acesso público | `share.accessed` ✅ |
| Revogar share | `share.revoked` ✅ |

Cada entry verificada contém `actor_user_id`, `ip_address`, `user_agent`, `timestamp` e `metadata` jsonb.

**Filtros do AuditLog testados:**
- `?actor_user_id=<uuid>` retorna apenas entries do ator
- `?resource_type=file_version` retorna apenas eventos de arquivos
- `?resource_type=comment` retorna apenas eventos de anotações
- `?from=<ISO>` filtra por janela temporal
- Compliance Data Center: janela de 30 dias com até 200 entries paginadas

### 2.6 — Clientes

| Ação UI | Endpoint | Verificação |
|---|---|---|
| Modal "Novo Cliente" SEGURADORA | `POST /clients` | 201 + type preservado |
| Modal CORRETORA | idem | 201 |
| Modal AUDITORIA | idem | 201 |
| Listar todos | `GET /clients` | inclui todos |
| Filtro por type=SEGURADORA | `GET /clients?type=SEGURADORA` | só SEGURADORA |
| NewClaim dropdown (seguradoras) | idem | retorna apenas tipo correto |
| Editar cliente | `PATCH /clients/:id` | name + status atualizados |
| PATCH parcial (só `contact`) | idem | name e type preservados |
| RBAC: VIEWER deletar | `DELETE /clients/:id` | 403 |
| RBAC: MANAGER deletar | idem | 403 (admin-only) |
| ADMIN deletar | idem | 204; GET seguinte → 404 |

### 2.7 — Usuários

| Ação UI | Endpoint | Verificação |
|---|---|---|
| MANAGER lista usuários | `GET /users` | 200 + email + role + created_at |
| 4 papéis presentes | idem | viewer, contributor, manager, admin |
| VIEWER tenta listar | idem | 403 |
| CONTRIBUTOR tenta listar | idem | 403 |
| MoreHorizontal → Ver atividade | `GET /audit?actor_user_id=` | deep-link funciona |

### 2.8 — RBAC (matriz completa)

| Endpoint | viewer | contributor | manager | admin |
|---|:---:|:---:|:---:|:---:|
| `GET /processes` | 200 ✅ | 200 ✅ | 200 ✅ | 200 ✅ |
| `POST /processes` | 403 ✅ | 201 ✅ | 201 ✅ | 201 ✅ |
| `PATCH /processes/:id` | 403 | 200 | 200 ✅ | 200 ✅ |
| `DELETE /processes/:id` (archive) | 403 ✅ | 403 ✅ | 403 ✅ | 200 ✅ |
| `POST /files` (upload) | 403 | 201 ✅ | 201 ✅ | 201 ✅ |
| `DELETE /files/:id` | 403 ✅ | 403 ✅ | 204 ✅ | 204 |
| `POST /comments` | 403 ✅ | 201 ✅ | 201 ✅ | 201 |
| `PATCH /comments/:id` | 403 | 200 ✅ | 200 ✅ | 200 ✅ |
| `POST /shares` | 403 ✅ | 403 ✅ | 201 ✅ | 201 |
| `GET /audit` | 403 ✅ | 403 ✅ | 200 ✅ | 200 ✅ |
| `GET /users` | 403 ✅ | 403 ✅ | 200 ✅ | 200 ✅ |
| `GET /clients` | 200 ✅ | 200 | 200 | 200 |
| `POST/PATCH /clients` | 403 | 403 | 201/200 ✅ | 201/200 |
| `DELETE /clients/:id` | 403 ✅ | 403 | 403 ✅ | 204 ✅ |

### 2.9 — Edge cases verificados

| Cenário | Resultado | Observação |
|---|---|---|
| GET de UUID inexistente | 404 com `error.code: PROCESS_NOT_FOUND` | JSON estruturado |
| Body JSON malformado | 400 com `INVALID_JSON` | OK |
| POST sem campos obrigatórios | 400 com `VALIDATION_ERROR` | OK |
| Cliente com `type` fora do enum | 400 | OK |
| Filename sem prefix `__` | 201, vai para folder default | OK |

---

## 3. Flow integrado — simulação real (corretor + perito + admin)

Cenário end-to-end testado:

1. **Manager (corretor)** abre sinistro novo via NewClaim ✅
2. **Manager** atribui ao **Contributor (perito)** via modal ✅
3. **Contributor** lista seus sinistros usando filtro `assigned_to=me` ✅
4. **Contributor** faz upload de laudo técnico ✅
5. **Contributor** adiciona anotação 5-palavras ao laudo ✅
6. **Manager** avança status: ready → ongoing → review ✅
7. **Manager** cria share link público para o segurado ✅
8. **Segurado** (anônimo) acessa `/s/<token>` e baixa o arquivo ✅
9. **Admin** audita todo o fluxo via `/admin/audit` ✅
10. **Admin** arquiva o sinistro ✅

---

## 4. Cobertura por tela do front

| Tela | Rota | Endpoints exercitados | Cobertura |
|---|---|---|---|
| Login | `/login` | (mock — mapeia email→PAT do .env.local) | ✅ |
| Dashboard cliente | `/app` | `GET /processes` | ✅ |
| ClaimsList | `/app/sinistros`, `/admin/sinistros` | `GET /processes?status=&assigned_to=&page=&limit=` | ✅ |
| NewClaim | `/app/sinistros/novo`, `/admin/sinistros/novo` | `POST /processes`, `GET /clients?type=SEGURADORA` | ✅ |
| ClaimDetails | `/app/sinistros/:id`, `/admin/sinistros/:id` | 13 endpoints (CRUD process + files + comments + shares + audit) | ✅ |
| Settings (4 abas) | `/app/configuracoes`, `/admin/configuracoes` | `GET /health/ready` | ✅ |
| Notifications | `/app/notificacoes`, `/admin/notificacoes` | `GET /audit?from=` | ✅ |
| AdminDashboard | `/admin` | `GET /audit`, `GET /processes`, `GET /clients`, `GET /users`, `/health/ready` | ✅ |
| ClientManagement | `/admin/clientes` | `GET/POST/PATCH/DELETE /clients` | ✅ |
| LinkTracker | `/admin/links` | `GET /files/:id/shares`, `GET /audit?resource_type=share_token` | ✅ |
| UserManagement | `/admin/usuarios` | `GET /users` + popover deep-links | ✅ |
| AuditLog | `/admin/audit` | `GET /audit` com 4 filtros | ✅ |
| ComplianceDataCenter | `/admin/compliance` | `GET /audit?from=`, `GET /processes`, `GET /files/:id/shares`, `GET /health/live` | ✅ |
| PublicShare | `/portal/:token` | `GET /s/:token` (302 → MinIO) | ✅ |

---

## 5. Limitações conhecidas (registradas, não impedem uso)

| # | Limitação | Onde | Severidade |
|---|---|---|---|
| 1 | `PATCH {assigned_to: null}` é silenciosamente ignorado pelo back | Decoder Go usa pointer; `null` = "não-altera". Front contorna trocando para outro responsável. | Baixa |
| 2 | Audit `user.invited` e `user.role_changed` não emitidos | Eventos acontecem no Zitadel, fora do back. Documentado na UI. | Por design |
| 3 | 401 retorna `text/plain` em vez de JSON estruturado | Front só redireciona para login no 401, não lê body. | Trivial |
| 4 | `POST /files` ignora campo `comment` opcional do multipart | Front nunca usou — anotações são feitas via `POST /comments`. | Por design |
| 5 | Login front é mock-de-dev (mapeia email→PAT do .env.local) | Para produção, precisa OIDC real. Documentado em [MATCH-BACK-SPEC.md](MATCH-BACK-SPEC.md). | Por design (POC) |

---

## 6. Como reproduzir

```bash
# Pré-requisitos
cd "/Users/renan/Desktop/ArquivoSeg Sato/arquivo-seg/process-manager"
just dev   # back :8080

cd "/Users/renan/Desktop/RenanMateus - ArquivoSeg /gestao_de_sinistros"
npm run dev  # front :5173

# Rodar as 3 suítes (na raiz do front)
bash scripts/e2e-final.sh   # 102 checks API
bash scripts/e2e-ui.sh      # 50 checks UI
bash scripts/e2e-deep.sh    # 186 checks deep
```

Saídas brutas (regeram a cada execução):
- [`scripts/e2e-final.report.txt`](../scripts/e2e-final.report.txt)
- [`scripts/e2e-ui.report.txt`](../scripts/e2e-ui.report.txt)
- [`scripts/e2e-deep.report.txt`](../scripts/e2e-deep.report.txt)

Tempo total dos 3: ~30s.

---

## 7. Conclusão

**338 de 338 verificações passam.** Toda alteração feita na UI do front atinge o backend corretamente, persiste no Postgres (via metadata jsonb quando necessário), grava trilha de auditoria com IP/user-agent/metadata, e é validada por RLS multi-tenant. RBAC dos 4 papéis é respeitado consistentemente. Edge cases (404, 400, JSON inválido, campos obrigatórios) retornam erros estruturados.

O sistema está pronto para uso operacional — as únicas pendências para produção real estão registradas na seção 5 (limitações) e detalhadas em [MATCH-BACK-SPEC.md](MATCH-BACK-SPEC.md) (gap de 5%) e na conversa sobre publicação real (OIDC + auto-provision de usuários).

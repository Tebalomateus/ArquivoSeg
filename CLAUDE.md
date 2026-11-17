# ArquivoSeg — front (React 18 + Vite + Tailwind)

Gestão de sinistros (seguros). Textos, commits e comentários em português.
Backend Go em `~/Documents/Dev/seguros/process-manager` (ver `~/Documents/Dev/seguros/CLAUDE.md`).
Remote: `Tebalomateus/ArquivoSeg`. Commits atômicos (um por feature/fix), estilo `feat(escopo): ...`.

## Rodar

- `VITE_ENABLE_MOCK` — mock ligado a menos que seja exatamente `'false'` (`src/api/client.js:3`).
  `.env.local` aponta para a API de **produção** (`VITE_API_BASE_URL=https://api.arquivoseg.com.br`, mock off).
  - Mock: `VITE_ENABLE_MOCK=true npm run dev` (login escolhe persona por e-mail, `src/pages/Login.jsx`, `INITIAL_USERS` em `src/constants/initialData.js`).
  - Backend local: `VITE_ENABLE_MOCK=false VITE_API_BASE_URL= npm run dev` + `just dev` no repo seguros (vite faz proxy de `/api`, `/health`, `/s/*` para :8080).
- E2E (Playwright, `playwright.config.js`): servidor mock na 5175, servidor "API" na 5176 com `page.route('**/api/v1/**')` falso
  (`e2e/fixtures/deck-api.js`, `iam-api.js`, `sinistro-api.js`). Projetos: `mock`, `acessos`, `decks`, `contratos`
  (`npm run test:e2e[:gating|:acessos|:decks|:contratos]`). Sessão plantada via `e2e/fixtures/session.js`. `E2E_LIVE=1` usa backend real.
- `backoffice/` é **outro app Vite** (porta 5174, role JWT `backoffice`): tenants + editor YAML dos tipos de sinistro.

## Deploy (feito do repo seguros)

- Beta: `just deploy-beta` → beta.arquivoseg.com.br (bucket `process-manager-production-beta`, dist `E21HHZ260J5WXZ`). **O beta usa a API de prod**: telas que dependem de backend novo exigem deploy do backend antes.
- Prod: `just deploy-frontend` (S3 + CloudFront, não Amplify). `aws` do Homebrew quebrado — usar `/usr/local/bin/aws`.

## Mapa

- `src/context/ClaimsContext.jsx` — estado central dos sinistros. `adaptProcessToClaim` (process → claim), `extractMetadata`/`METADATA_KEYS`
  (o que vai em `processes.metadata`, PATCH com debounce), `buildFolders` (pastas Causa/Prejuízo/Liquidação/Gerencial `private:true`),
  `addClaim`, `addChecklistItem`, `refreshClaimFiles`/`fileVerToDoc` (arquivos + comentários). Mock: `localStorage arquivoseg_claims`.
- `src/pages/NewClaim.jsx` — criação. O tipo de sinistro (YAML do backoffice; padrão embutido/mock em `src/constants/claimTypes.js`)
  vira uma prévia editável de etapas → itens; a edição vale só para o sinistro. Seguradora/modalidade não geram itens. Campo `disclaimer`.
  Cada etapa vira uma `folder` (id = id da etapa) + Gerencial privada (`stepsToFolders`).
- `src/pages/ClaimDetails.jsx` — detalhe: etapas (folders não privadas) num dropdown dentro da barra de abas (`StepSelect.jsx`; e2e usa `e2e/fixtures/etapas.js`) + Avulsos, Gerencial, Auditoria; disclaimer acima
  do kanban (editável com `processo.editar`); cartão lateral (prazo, conclusão, storage). Modos Decks / Gerenciamento (não há mais Checklist).
- `src/components/KanbanBoard.jsx` — colunas Pendente/Enviado/Atendido (status do deck). `TaskCard` (tarefa solta, chave `folderId.itemId`) e `DeckCard`.
  `src/api/deckBoard.js` espelha `domain/deck/service.go` (otimista + mock em `sessionStorage deckboard_<id>`). Cliente HTTP: `src/api/decks.js`.
- `src/services/claimProgress.js` — conclusão calculada do board (`claim.board`, de `metadata.decks`/`deck_task_status`): % atendido e
  % enviado sobre tarefas obrigatórias de pastas não privadas. `ProgressBar.jsx`. Nada de `progress` salvo.
- Comentários por deck: `src/api/deckComments.js` (real + mock `sessionStorage deckcomments_<id>`), `src/components/DeckComments.jsx`.
  Comentário prova o deck (envia sem arquivo); após devolução (`deck.devolvidoAt`) só comentário novo vale.
- `src/services/claimSidebar.js` — prazo mock (regra espelha o backend). `src/components/ClaimDeadline.jsx`, `ClaimAuditTrail.jsx`.
- `src/constants/auditTrail.js` — vocabulário das ações de auditoria (precisa bater com `internal/domain/audit/model.go`).
- `src/context/PermissionsContext.jsx` + `mockPermissions.js` — IAM por ação (`deck.enviar`, `comentario.criar`...). Admin mock = curinga.
- Gestão (ex-`/admin`, agora dentro de `/app`): `src/pages/admin/*`, menu em `src/components/layout/Layout.jsx`.

## Armadilhas conhecidas

- O tipo de sinistro só semeia `metadata.folders` na abertura; depois disso o sinistro vive das folders (chaves de tarefa `etapa.item`).
  `metadata.checklist_state` (YAML) é legado — sem UI. Sinistros antigos têm folders Causa/Prejuízo/Liquidação com ids `f1-<ts>`.
- Chaves `checklist_*` e `deck*` da metadata são do servidor (o PATCH do front não as sobrescreve); `folders`, `disclaimer` são do cliente.
- Tipos de sinistro só são editados no app `backoffice/` (agentes ArquivoSeg), nunca pelo tenant.

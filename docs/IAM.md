# IAM — permissões customizáveis

O desenho completo da migração de RBAC fixo (`viewer/contributor/manager/admin`) para um
modelo estilo AWS IAM vive no repositório do backend, para ficar junto do catálogo de
ações que é a fonte de verdade:

**`seguros/process-manager/docs/iam/`**

| Doc | Conteúdo |
|---|---|
| `README.md` | Índice e TL;DR |
| `01-estado-atual.md` | O que existe hoje e o que quebra — inclui a lista completa de call-sites no frontend |
| `02-catalogo-de-acoes.md` | As 59 ações nomeadas, com descrição |
| `03-arquitetura.md` | Modelo de dados, resolução, cache, fronteira com o Zitadel |
| `04-registry-e-middleware.md` | `Register` / `Require` / `WithPermissionTo` |
| `05-api.md` | Endpoints novos e depreciações |
| **`06-frontend.md`** | **Mudanças neste repositório** |
| `07-decisoes-e-questoes-abertas.md` | Decisões, alternativas descartadas, pendências |

Resumo do que muda aqui: `PermissionsContext` + `useCan()` + `<Can action="...">` no
lugar de todo `currentUser.role === 'ADMIN'`; `src/api/auth.js` perde o mapa
`ADMIN`/`CORRETOR`/`PERITO`/`ANALISTA`; e entra a área `/admin/acessos`, com abas de
usuários e de grupos/papéis, evoluindo `src/pages/UserManagement.jsx`.

Toda a gestão de acessos fica **neste app** — o `backoffice/` não recebe nada. É a única
área gated por `isAdmin` (papel `admin` do Zitadel, lido do claim) em vez de por
permissão, para que um erro de configuração de IAM nunca tranque o admin para fora da
tela que conserta o IAM.

## Testes end-to-end

`npm run test:e2e` — Playwright, a única suíte automatizada deste repositório. Na
primeira vez, `npx playwright install chromium`.

Sobem dois dev servers, um por perfil, porque as duas metades da feature falham de
formas diferentes:

| Alvo | O que roda | Como |
|---|---|---|
| `npm run test:e2e:gating` | `permissoes-ui`, `nao-admin` | modo mock, sem backend nenhum; testa quais controles existem para qual conjunto de permissões |
| `npm run test:e2e:acessos` | `acessos-*`, `anti-lockout` | `VITE_ENABLE_MOCK=false` com o Playwright fazendo o papel da API (`e2e/fixtures/iam-api.js`) |

A API falsa guarda estado entre requisições e implementa as três recusas que só existem
como resposta do servidor — `ROLE_IN_USE`, `SELF_DEMOTION` e `LAST_ADMIN`. As asserções
batem no estado que ela guardou, não só no que a tela desenhou.

Contra o stack real: `E2E_LIVE=1 npm run test:e2e:acessos`, com `VITE_API_BASE_URL`
apontando para o backend e o seed aplicado. A fixture sai da frente e as mesmas specs
exercitam os 409 de verdade.

Enquanto o shim de papéis legados existir (`src/context/legacyPermissions.js`), o perfil
`mock` exercita o conjunto que ele devolve. As asserções não mudam quando ele sair: o que
elas afirmam é "quem pode `processo.criar` vê Novo Sinistro", não de onde a permissão veio.

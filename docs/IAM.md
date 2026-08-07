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

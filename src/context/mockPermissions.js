// The permission sets of the demo personas.
//
// This is the mock mode's answer to GET /me/permissions: with no backend to
// ask, the four personas in INITIAL_USERS need somewhere to get an access set
// from, or the demo comes up empty. It is not a fallback for the real app —
// when the API is the source, only the API decides.
//
// The sets started as the old role ladder, which is why they nest; keep them
// only as rich as the demo needs. Nothing here is enforced anywhere: the server
// is still the authority on every request that leaves the browser.

// What every persona can do: read the process and its files.
const LEITURA = [
    'processo.listar',
    'processo.ver',
    'arquivo.listar',
    'arquivo.listarVersoes',
    'arquivo.baixar',
    'comentario.listar',
    'checklist.listarTipos',
    'checklist.verDefinicao',
    'deck.listar',
    'deck.baixarArquivos',
    'compartilhamento.acessarInterno',
    'cliente.listar',
    'cliente.ver',
];

// The analista reviews what the perito sends. deck.analisar is the whole
// difference between the two sides of the board, and it is the analista's, not
// the perito's — the demo has one login per side, no in-board switch.
const ANALISTA = [
    ...LEITURA,
    'deck.analisar',
];

const PERITO = [
    ...LEITURA,
    'processo.criar',
    'processo.editar',
    'processo.alterarStatus',
    'arquivo.subir',
    'comentario.criar',
    'comentario.editarProprio',
    'comentario.excluirProprio',
    'checklist.atualizarEstado',
    'checklist.adicionarItem',
    'checklist.removerItem',
    'deck.criar',
    'deck.anexarArquivo',
    'deck.removerArquivo',
    'deck.anexarTarefa',
    'deck.desanexarTarefa',
    'deck.enviar',
];

// Note what the corretor does NOT get: usuario.listar. The tenant's user list
// belongs to the admin.
const CORRETOR = [
    ...PERITO,
    'processo.verGerencial',
    'processo.verAuditoria',
    'arquivo.excluir',
    'comentario.editarQualquer',
    'comentario.excluirQualquer',
    'deck.analisar',
    'compartilhamento.listar',
    'compartilhamento.criar',
    'compartilhamento.revogar',
    'cliente.criar',
    'cliente.editar',
    'auditoria.listar',
    'auditoria.ver',
];

const BY_PERSONA = {
    ANALISTA,
    PERITO,
    CORRETOR,
    // ADMIN is not listed: it resolves through isAdmin, which is an implicit
    // wildcard. Spelling out the set would be a second place to keep in step.
};

/**
 * permissionsForMockUser returns the set a demo persona logs in with. An
 * unknown persona gets the empty set, not the smallest one — guessing wide is
 * how a stand-in turns into a hole.
 */
export function permissionsForMockUser(user) {
    return new Set(BY_PERSONA[user?.role] || []);
}

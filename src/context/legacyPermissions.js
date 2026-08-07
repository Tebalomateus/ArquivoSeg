// Shim: the legacy role ladder translated into permission sets.
//
// It exists so the gating call-sites can be rewritten in terms of permissions
// before the backend serves /me/permissions, and so the app keeps working if
// that call fails. It is a mirror of internal/domain/iam/systemroles.go in the
// backend, and it comes out in step 12 of the migration together with the
// legacy role column — nothing new should be added here.
//
// The sets nest exactly like the ladder they came from: viewer ⊂ contributor ⊂
// manager ⊂ admin, which is why each one is written as the previous plus its
// own additions.

const VIEWER = [
    'processo.listar',
    'processo.ver',
    'arquivo.listar',
    'arquivo.listarVersoes',
    'arquivo.baixar',
    'comentario.listar',
    'checklist.listarTipos',
    'checklist.verDefinicao',
    'deck.listar',
    'compartilhamento.acessarInterno',
    'cliente.listar',
    'cliente.ver',
];

const CONTRIBUTOR = [
    ...VIEWER,
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

// Note what manager does NOT get: usuario.listar. The tenant's user list is the
// admin's, which is the one behaviour change of this migration.
const MANAGER = [
    ...CONTRIBUTOR,
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

const BY_ROLE = {
    viewer: VIEWER,
    contributor: CONTRIBUTOR,
    manager: MANAGER,
    // admin is not listed: it resolves through isAdmin, which is an implicit
    // wildcard. Spelling out the set would be a second place to keep in step.
};

/**
 * permissionsForLegacyRole returns the permission set a legacy backend role
 * used to imply. An unknown role gets the empty set, not the viewer set —
 * guessing wide is how a shim turns into a hole.
 */
export function permissionsForLegacyRole(backRole) {
    return new Set(BY_ROLE[backRole] || []);
}

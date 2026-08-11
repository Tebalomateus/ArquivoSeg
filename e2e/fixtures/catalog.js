/**
 * A slice of the real action catalog, in the shape the API serves it.
 *
 * It is deliberately a slice and not a copy of all 59 actions: the specs assert
 * on grouping, wildcards and effective access, none of which get truer with more
 * rows, and a copy would be a second catalog to keep in step with
 * internal/authz/actions. The names here are real ones, so a rename upstream
 * shows up as a failing spec rather than as a passing lie.
 */
export const CATALOG = [
    {
        group: 'processo',
        actions: [
            { name: 'processo.listar', label: 'Listar sinistros', description: 'Ver a lista de sinistros do tenant.' },
            { name: 'processo.ver', label: 'Ver sinistro', description: 'Abrir um sinistro e seus dados.' },
            { name: 'processo.criar', label: 'Criar sinistro', description: 'Abrir um novo sinistro.' },
            { name: 'processo.editar', label: 'Editar sinistro', description: 'Alterar os dados de um sinistro.' },
            { name: 'processo.arquivar', label: 'Arquivar sinistro', description: 'Encerrar e arquivar um sinistro.' },
        ],
    },
    {
        group: 'arquivo',
        actions: [
            { name: 'arquivo.listar', label: 'Listar arquivos', description: 'Ver os documentos de um sinistro.' },
            { name: 'arquivo.subir', label: 'Subir arquivo', description: 'Anexar documentos a um sinistro.' },
            { name: 'arquivo.excluir', label: 'Excluir arquivo', description: 'Remover um documento do sinistro.' },
        ],
    },
    {
        group: 'auditoria',
        actions: [
            { name: 'auditoria.listar', label: 'Listar auditoria', description: 'Ler a trilha de auditoria do tenant.' },
            { name: 'auditoria.ver', label: 'Ver evento', description: 'Abrir um evento de auditoria.' },
        ],
    },
    {
        group: 'iam',
        actions: [
            { name: 'iam.listarPapeis', label: 'Listar papéis', description: 'Ver os papéis do tenant.' },
            { name: 'iam.gerenciarPapeis', label: 'Gerenciar papéis', description: 'Criar, editar e excluir papéis.' },
            { name: 'iam.gerenciarGrupos', label: 'Gerenciar grupos', description: 'Criar, editar e excluir grupos.' },
            { name: 'iam.atribuir', label: 'Atribuir acessos', description: 'Dar e tirar papéis e permissões de pessoas.' },
        ],
    },
];

export const ALL_ACTIONS = CATALOG.flatMap((g) => g.actions.map((a) => a.name));

/** The same matching rule the backend applies: exact, `grupo.*`, or `*`. */
export function matches(pattern, action) {
    if (pattern === '*') return true;
    if (pattern === action) return true;
    return pattern.endsWith('.*') && action.startsWith(pattern.slice(0, -1));
}

/**
 * Tipos de sinistro → etapas do sinistro.
 *
 * Um tipo de sinistro (YAML no S3, editado no backoffice) tem etapas
 * (`stages`) e cada etapa tem itens. Na abertura do sinistro a definição vira
 * um rascunho editável (`defToSteps`) e, ao criar, cada etapa vira uma pasta
 * de `metadata.folders` (`stepsToFolders`) — é o que o kanban mostra, uma
 * etapa por vez.
 */

// Igual a seguros/scripts/checklists-seed/padrao.yaml — mantenha os dois
// iguais. Vale quando a empresa ainda não tem tipos cadastrados (ou no mock).
export const DEFAULT_CLAIM_TYPE = {
    type: 'padrao',
    title: 'Padrão',
    version: '2026.11',
    stages: [
        {
            id: 'causa', title: 'Causa', items: [
                { id: 'apolice', label: 'Apólice de Seguro', required: true },
                { id: 'aviso_sinistro', label: 'Aviso de Sinistro', required: true },
                { id: 'identificacao_segurado', label: 'Documentos de Identificação do Segurado', required: true },
                { id: 'procuracao', label: 'Procuração / Carta de Preposto', required: false },
                { id: 'boletim_ocorrencia', label: 'Boletim de Ocorrência', required: true },
                { id: 'fotos_local', label: 'Fotos do Local', required: true },
                { id: 'laudo_tecnico', label: 'Laudo Técnico / Pericial', required: false },
            ],
        },
        {
            id: 'prejuizo', title: 'Prejuízo', items: [
                { id: 'planilha_prejuizos', label: 'Planilha de Prejuízos', required: true },
                { id: 'notas_fiscais', label: 'Notas Fiscais dos Bens', required: true },
                { id: 'orcamentos', label: 'Orçamentos de Reparo (3x)', required: true },
            ],
        },
        {
            id: 'liquidacao', title: 'Liquidação', items: [
                { id: 'dados_bancarios', label: 'Dados Bancários do Segurado', required: true },
                { id: 'termo_quitacao', label: 'Termo de Quitação / Recibo de Indenização', required: true },
            ],
        },
    ],
};

// Tipos do modo mock: o padrão e um segundo, para dar o que trocar na tela.
export const MOCK_CLAIM_TYPES = [
    DEFAULT_CLAIM_TYPE,
    {
        type: 'incendio',
        title: 'Incêndio',
        version: '2026.11',
        stages: [
            {
                id: 'aviso', title: 'Aviso', items: [
                    { id: 'aviso_sinistro', label: 'Aviso de Sinistro', required: true },
                    { id: 'apolice', label: 'Apólice de Seguro', required: true },
                ],
            },
            {
                id: 'causa', title: 'Causa', items: [
                    { id: 'laudo_bombeiros', label: 'Laudo do Corpo de Bombeiros', required: true },
                    { id: 'boletim_ocorrencia', label: 'Boletim de Ocorrência', required: true },
                    { id: 'fotos_local', label: 'Fotos do Local', required: true },
                ],
            },
            {
                id: 'prejuizo', title: 'Prejuízo', items: [
                    { id: 'planilha_bens', label: 'Planilha de Bens Danificados', required: true },
                    { id: 'notas_fiscais', label: 'Notas Fiscais dos Bens', required: true },
                    { id: 'orcamentos', label: 'Orçamentos de Reparo (3x)', required: false },
                ],
            },
            { id: 'liquidacao', title: 'Liquidação', items: [] },
        ],
    },
];

// Slug sem título (servidor antigo, que só manda `data`): "rcg_eventos" → "Rcg Eventos".
export const prettifySlug = (slug) => String(slug || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

let seq = 0;
// Chave local para linhas criadas na tela (não é o id que vai para o servidor).
export const draftKey = () => `d${Date.now().toString(36)}${(seq++).toString(36)}`;

/**
 * Definição do tipo → rascunho editável. `required` omitido vale true, como no
 * servidor. Cada linha leva uma chave local (`key`) para o React e o id da
 * definição (`id`), que vira o id da pasta/tarefa.
 */
export function defToSteps(def) {
    return (def?.stages || []).map(st => ({
        key: draftKey(),
        id: st.id,
        title: st.title || st.id || '',
        items: (st.items || []).map(it => ({
            key: draftKey(),
            id: it.id,
            label: it.label || '',
            required: it.required !== false,
        })),
    }));
}

const slug = (s) => String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// Ids que uma etapa não pode ter: o da pasta privada e o da aba de avulsos.
const RESERVED_FOLDER_IDS = new Set(['gerencial', 'avulsos']);

const uniqueId = (wanted, taken, fallback) => {
    const base = slug(wanted) || fallback;
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}_${n}`;
    taken.add(id);
    return id;
};

/**
 * Rascunho das etapas → `metadata.folders` do sinistro: uma pasta por etapa,
 * na ordem, mais a Gerencial privada. A pasta usa o id da etapa (as tarefas
 * ficam com a chave "etapa.item", a mesma do tipo no servidor) e a categoria
 * igual ao id, que é o prefixo dos arquivos da pasta.
 */
export function stepsToFolders(steps, now = new Date()) {
    const createdAt = now.toISOString();
    const folderIds = new Set(RESERVED_FOLDER_IDS);
    const folders = (steps || []).map((st, si) => {
        const id = uniqueId(st.id || st.title, folderIds, `etapa_${si + 1}`);
        const itemIds = new Set();
        return {
            id,
            name: (st.title || '').trim() || `Etapa ${si + 1}`,
            category: id,
            completion: 0,
            documents: [],
            checklist: (st.items || [])
                .filter(it => (it.label || '').trim())
                .map((it, ii) => ({
                    id: uniqueId(it.id || it.label, itemIds, `item_${ii + 1}`),
                    name: it.label.trim(),
                    required: it.required !== false,
                    received: false,
                    createdAt,
                })),
        };
    });
    folders.push({ id: 'gerencial', name: 'Gerencial', category: 'gerencial', completion: 0, private: true, documents: [], checklist: [] });
    return folders;
}

// A trilha de auditoria do modo mock (VITE_ENABLE_MOCK): sem servidor, o
// sinistro de demonstração ganha uma história plausível — quatro pessoas e um
// acesso externo ao longo de duas semanas — para a tela ter o que mostrar.
// Mesma forma e mesmos filtros de listProcessAudit (api/processAudit.js).

const PEOPLE = {
    ricardo: { actor_user_id: 'mock-u-ricardo', actor_name: 'Ricardo Silva', actor_email: 'ricardo@corretora.com' },
    ana: { actor_user_id: 'mock-u-ana', actor_name: 'Ana Souza', actor_email: 'ana.souza@allianz.com' },
    maria: { actor_user_id: 'mock-u-maria', actor_name: 'Maria Costa', actor_email: 'analista@arquivoseg.com.br' },
    carlos: { actor_user_id: 'mock-u-carlos', actor_name: 'Carlos Sato', actor_email: 'sato@arquivoseg.com.br' },
    externo: { actor_user_id: null, actor_name: null, actor_email: null },
};

const H = 3600 * 1000;

// Do mais antigo ao mais novo; `h` é quantas horas atrás.
const SCRIPT = [
    [340, 'ricardo', 'process.created', 'process', {}],
    [339, 'ricardo', 'share.created', 'share_token', { file_name: 'causa__apolice-2026.pdf', label: 'Segurado' }],
    [316, 'ana', 'file.uploaded', 'file_version', { file_name: 'causa__boletim-ocorrencia.pdf', version: 1 }],
    [315, 'ana', 'file.uploaded', 'file_version', { file_name: 'causa__laudo-bombeiros.pdf', version: 1 }],
    [300, 'externo', 'share.accessed', 'share_token', { file_name: 'causa__apolice-2026.pdf', ip_address: '189.40.12.7' }],
    [290, 'ana', 'deck.created', 'deck', { codigo: 'DECK-01', tarefa_ids: ['causa.bo', 'causa.laudo'] }],
    [289, 'ana', 'deck.submitted', 'deck', { codigo: 'DECK-01', tarefas: ['causa.bo', 'causa.laudo'] }],
    [260, 'maria', 'file.downloaded', 'file_version', { file_name: 'causa__laudo-bombeiros.pdf' }],
    [258, 'maria', 'deck.returned', 'deck', { codigo: 'DECK-01', devolvidas: ['causa.laudo'], motivo: 'Laudo sem assinatura do responsável técnico.' }],
    [240, 'maria', 'comment.created', 'comment', { body: 'Falta a assinatura na página 3 do laudo.' }],
    [210, 'ana', 'file.uploaded', 'file_version', { file_name: 'causa__laudo-bombeiros.pdf', version: 2 }],
    [209, 'ana', 'deck.submitted', 'deck', { codigo: 'DECK-01', tarefas: ['causa.laudo'] }],
    [190, 'maria', 'deck.approved', 'deck', { codigo: 'DECK-01' }],
    [170, 'ricardo', 'process.deadline_started', 'process', { start_at: isoHoursAgo(170), due_at: isoHoursAgo(170 - 24 * 30), source: 'auto' }],
    [150, 'ricardo', 'process.status_changed', 'process', { old_status: 'ready', new_status: 'ongoing' }],
    [120, 'externo', 'canary.pinged', 'file_version', { file_name: 'prejuizo__planilha-bens.xlsx', ip_address: '177.92.3.201' }],
    [100, 'ana', 'file.uploaded', 'file_version', { file_name: 'prejuizo__planilha-bens.xlsx', version: 1 }],
    [96, 'ana', 'deck.created', 'deck', { codigo: 'DECK-02', tarefa_ids: ['prejuizo.planilha'] }],
    [72, 'carlos', 'process.deadline_adjusted', 'process', {
        field: 'due_at', from: isoHoursAgo(170 - 24 * 30), to: isoHoursAgo(170 - 24 * 45),
        justification: 'Segurado pediu prorrogação formal por e-mail (anexado na pasta Gerencial).',
    }],
    [70, 'carlos', 'share.revoked', 'share_token', { file_name: 'causa__apolice-2026.pdf' }],
    [48, 'ricardo', 'comment.created', 'comment', { body: 'Prorrogação aceita pela seguradora.' }],
    [30, 'ana', 'deck.submitted', 'deck', { codigo: 'DECK-02', tarefas: ['prejuizo.planilha'] }],
    [26, 'maria', 'file.downloaded', 'file_version', { file_name: 'prejuizo__planilha-bens.xlsx' }],
    [5, 'maria', 'deck.approved', 'deck', { codigo: 'DECK-02' }],
    [2, 'ricardo', 'file.deleted', 'file_version', { file_name: 'gerencial__rascunho-parecer.docx' }],
    [0.3, 'ricardo', 'process.updated', 'process', {}],
];

function isoHoursAgo(h) {
    return new Date(Date.now() - h * H).toISOString();
}

function buildEvents(processId) {
    return SCRIPT.map(([h, who, action, resource_type, metadata], i) => ({
        id: `mock-audit-${i + 1}`,
        timestamp: isoHoursAgo(h),
        action,
        resource_type,
        resource_id: resource_type === 'process' ? processId : `mock-${resource_type}-${i + 1}`,
        share_token_id: who === 'externo' && action === 'share.accessed' ? 'mock-share-1' : null,
        metadata,
        ...PEOPLE[who],
    })).reverse();
}

export async function mockListProcessAudit(processId, { page = 1, limit = 50, actorUserId, action } = {}) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const all = buildEvents(processId).filter((e) =>
        (!actorUserId || e.actor_user_id === actorUserId) && (!action || e.action === action));
    const start = (page - 1) * limit;
    return { data: all.slice(start, start + limit), total: all.length };
}

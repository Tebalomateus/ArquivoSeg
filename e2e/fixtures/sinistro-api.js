/**
 * API falsa da rodada 2 do sinistro: a trilha de auditoria por processo
 * (GET /processes/:id/audit) e o uso de armazenamento (GET /storage/usage,
 * GET /processes/:id/storage), com a forma dos contratos em src/api/
 * processAudit.js e src/api/storage.js. Mesma ideia de deck-api.js: um
 * page.route com estado, para o spec afirmar também o que o servidor recebeu.
 *
 * Com E2E_LIVE=1 nada é instalado.
 */

export const PROCESS_ID = '22222222-2222-4222-8222-222222222222';

export const USERS = {
    ana: { actor_user_id: 'u-ana', actor_name: 'Ana Souza', actor_email: 'ana.souza@allianz.com' },
    maria: { actor_user_id: 'u-maria', actor_name: 'Maria Costa', actor_email: 'analista@arquivoseg.com.br' },
    ricardo: { actor_user_id: 'u-ricardo', actor_name: null, actor_email: 'ricardo@corretora.com' },
};

const H = 3600 * 1000;

function event(id, hoursAgo, who, action, metadata = {}, extra = {}) {
    const actor = who ? USERS[who] : { actor_user_id: null, actor_name: null, actor_email: null };
    return {
        id,
        timestamp: new Date(Date.now() - hoursAgo * H).toISOString(),
        action,
        resource_type: action.split('.')[0],
        resource_id: `r-${id}`,
        share_token_id: null,
        metadata,
        ...actor,
        ...extra,
    };
}

/** A história padrão, mais novo primeiro — a ordem em que o servidor devolve. */
export function defaultAudit() {
    return [
        event('e9', 1, 'maria', 'deck.analyzed', { codigo: 'DECK-01', devolvidas: [] }),
        event('e8', 3, null, 'share.accessed', { file_name: 'causa__apolice.pdf' }, { share_token_id: 'st-1', ip_address: '10.0.0.9' }),
        event('e7', 5, 'ricardo', 'process.deadline_adjusted', {
            field: 'due_at', from: '2026-10-01T12:00:00Z', to: '2026-10-15T12:00:00Z', justification: 'Prorrogação pedida pelo segurado.',
        }),
        event('e6', 8, 'ana', 'deck.submitted', { codigo: 'DECK-01', tarefas: ['causa.bo'] }),
        event('e5', 9, 'ana', 'file.uploaded', { file_name: 'causa__laudo.pdf', version: 2 }),
        event('e4', 20, 'maria', 'deck.analyzed', { codigo: 'DECK-01', devolvidas: ['causa.bo'], motivo: 'Sem assinatura.' }),
        event('e3', 30, 'ana', 'file.uploaded', { file_name: 'causa__laudo.pdf', version: 1 }),
        event('e2', 40, 'ricardo', 'process.frobnicated', {}),
        event('e1', 50, 'ricardo', 'process.created', {}),
    ];
}

export function initialState() {
    return {
        permissions: ['processo.listar', 'processo.ver', 'processo.verAuditoria'],
        processes: [
            proc(PROCESS_ID, 'Incêndio galpão', { number: '2026-0101', insurer: 'Allianz', progress: 40 }),
            proc('33333333-3333-4333-8333-333333333333', 'Roubo de carga', { number: '2026-0102', insurer: 'Porto Seguro', progress: 75 }),
            proc('44444444-4444-4444-8444-444444444444', 'Alagamento loja', { number: '2026-0103', insurer: 'Tokio Marine', progress: 10 }),
        ],
        audit: defaultAudit(),
        storage: {
            total_bytes: 734_003_200 + 52_428_800 + 2048,
            file_count: 41,
            processes: [
                { process_id: '33333333-3333-4333-8333-333333333333', title: 'Roubo de carga', bytes: 734_003_200, file_count: 30 },
                { process_id: PROCESS_ID, title: 'Incêndio galpão', bytes: 52_428_800, file_count: 10 },
                { process_id: '44444444-4444-4444-8444-444444444444', title: 'Alagamento loja', bytes: 2048, file_count: 1 },
            ],
        },
        failAudit: null,    // { status, code, message }
        failStorage: null,  // { status, code, message }
        requests: [],
    };
}

function proc(id, title, metadata) {
    return {
        id, title, status: 'ongoing', created_at: '2026-09-01T12:00:00Z', updated_at: '2026-09-20T12:00:00Z',
        assigned_to: null, created_by: null, claim_type: null, metadata,
        // Prazo: o servidor manda os dois em todo processo; null = aguardando.
        deadline_start_at: null, deadline_due_at: null,
    };
}

const ok = (body) => ({ status: 200, body });
const fail = (f) => ({ status: f.status, body: { error: { code: f.code, message: f.message, request_id: 'e2e' } } });

function handle(state, method, seg, query) {
    const [a, b, c] = seg;
    if (method !== 'GET') return null;

    if (a === 'me' && b === 'permissions') {
        return ok({ data: { user_id: 'u-e2e', is_admin: false, permissions: state.permissions, policy_version: 1 } });
    }
    if (a === 'storage' && b === 'usage') {
        if (state.failStorage) return fail(state.failStorage);
        return ok({ data: state.storage });
    }
    if (a !== 'processes') return null;
    if (!b) return ok({ data: state.processes, total: state.processes.length });
    const p = state.processes.find((x) => x.id === b);
    if (!p) return null;
    if (!c) return ok(p);
    if (c === 'storage') {
        const row = state.storage.processes.find((x) => x.process_id === b);
        return ok({ data: { bytes: row?.bytes ?? 0, file_count: row?.file_count ?? 0 } });
    }
    if (c === 'audit') {
        if (state.failAudit) return fail(state.failAudit);
        const page = Number(query.get('page') || 1);
        const limit = Number(query.get('limit') || 50);
        const actor = query.get('actor_user_id');
        const action = query.get('action');
        const all = state.audit.filter((e) => (!actor || e.actor_user_id === actor) && (!action || e.action === action));
        return ok({ data: all.slice((page - 1) * limit, page * limit), total: all.length });
    }
    return null;
}

export async function installSinistroApi(page, mutate) {
    const state = initialState();
    if (mutate) mutate(state);
    if (process.env.E2E_LIVE === '1') return state;

    await page.route('**/api/v1/**', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const seg = url.pathname.replace(/^\/api\/v1\/?/, '').split('/').filter(Boolean);
        state.requests.push({ method: request.method(), path: url.pathname + url.search });
        // O que não está modelado responde vazio, como em deck-api.js.
        const res = handle(state, request.method(), seg, url.searchParams) || ok({ data: [], total: 0 });
        await route.fulfill({ status: res.status, contentType: 'application/json', body: JSON.stringify(res.body) });
    });
    return state;
}

/** Eventos em série, para os specs de paginação. */
export function manyEvents(n) {
    return Array.from({ length: n }, (_, i) =>
        event(`m${i + 1}`, i + 1, i % 2 ? 'ana' : 'maria', 'file.downloaded', { file_name: `causa__doc-${i + 1}.pdf` }));
}

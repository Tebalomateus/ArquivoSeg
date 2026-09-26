import { isMockEnabled, getToken } from '../api/client';
import { getProcessStorage } from '../api/storage';
import { listProcessAudit } from '../api/processAudit';
import { filesKey, persistKey } from '../api/deckBoard';
import { getDeadline, adjustDeadline } from '../api/deadline';

// Dados do cartão lateral do sinistro que não vêm no próprio processo:
// armazenamento, última atividade e prazo. Com API, cada um é uma rota; no modo mock
// (ou sem token) são derivados do que o navegador já guarda, para a demo
// mostrar o mesmo cartão.

const online = () => !isMockEnabled() && !!getToken();

function mockFiles(claim) {
    let stored = null;
    try { stored = JSON.parse(sessionStorage.getItem(filesKey(claim.id)) || 'null'); } catch { /* ignore */ }
    const boardFiles = Array.isArray(stored) ? stored : [];
    const folderDocs = (claim.folders || []).flatMap(f => f.documents || []);
    return { boardFiles, folderDocs };
}

// → { bytes, file_count }
export async function loadStorage(claim) {
    if (online()) {
        const res = await getProcessStorage(claim.id);
        const d = res?.data || res || {};
        return { bytes: Number(d.bytes) || 0, file_count: Number(d.file_count) || 0 };
    }
    const { boardFiles, folderDocs } = mockFiles(claim);
    const bytes = boardFiles.reduce((s, f) => s + (Number(f.tamanho) || 0), 0)
        + folderDocs.reduce((s, d) => s + (Number(d.size_bytes) || 0), 0);
    return { bytes, file_count: boardFiles.length + folderDocs.length };
}

// → { actor, action, timestamp } | null. `action` é o código do servidor;
// quem mostra traduz com actionLabel (constants/auditTrail), o mesmo
// vocabulário da aba de auditoria.
export async function loadLastActivity(claim) {
    if (online()) {
        const res = await listProcessAudit(claim.id, { limit: 1 });
        const e = Array.isArray(res?.data) ? res.data[0] : null;
        if (!e) return null;
        return {
            actor: e.actor_name || e.actor_email || (e.share_token_id ? 'Link público' : 'Sistema'),
            action: e.action,
            timestamp: e.timestamp,
            metadata: e.metadata || {},
        };
    }
    const a = (claim.activities || [])[0];
    if (!a) return null;
    return { actor: a.user, text: a.action, when: a.date };
}

// ── Prazo ──────────────────────────────────────────────────────────────────────
// Com API, GET/PUT /processes/:id/deadline. No mock o prazo fica no
// sessionStorage do sinistro e quem está logado faz as vezes de criador —
// can_adjust sempre true —, para a demo mostrar o ajuste e o histórico.

const DAY_MS = 86_400_000;
const deadlineKey = (id) => `deadline_${id}`;

// Sem nada guardado, parte do que o sinistro mock já traz (deadlineStartAt /
// deadlineDueAt), como o servidor devolveria na lista.
function readMockDeadline(claim) {
    let stored = null;
    try { stored = JSON.parse(sessionStorage.getItem(deadlineKey(claim.id)) || 'null'); } catch { /* ignore */ }
    if (stored) return stored;
    const start = claim.deadlineStartAt || null;
    const due = claim.deadlineDueAt || null;
    const autoDue = start ? new Date(Date.parse(start) + 30 * DAY_MS).toISOString() : null;
    return {
        start_at: start, start_source: start ? 'auto' : null, total_days: 30,
        due_at: due || autoDue, due_source: due && due !== autoDue ? 'manual' : (start ? 'auto' : null),
        history: [],
    };
}

const writeMockDeadline = (claim, dl) => {
    try { sessionStorage.setItem(deadlineKey(claim.id), JSON.stringify(dl)); } catch { /* ignore */ }
};

// A regra do servidor (deadline.AutoStart) sobre o que o mock guarda: os
// obrigatórios são os itens das pastas não gerenciais; cada um está cumprido
// se foi marcado (received / checklistState) ou se o deck da tarefa tem ao
// menos um arquivo. Lista vazia nunca inicia, e o início nunca é desfeito.
function mockRequirementsMet(claim) {
    const required = (claim.folders || [])
        .filter(f => f.category !== 'gerencial')
        .flatMap(f => (f.checklist || []).map(i => ({ key: `${f.id}.${i.id}`, received: !!i.received })));
    if (required.length === 0) return false;
    let board = null;
    try { board = JSON.parse(sessionStorage.getItem(persistKey(claim.id)) || 'null'); } catch { /* ignore */ }
    const withFile = new Set((board?.decks || [])
        .filter(d => (d.arquivos || []).length > 0)
        .flatMap(d => d.tarefaIds || []));
    const checked = claim.checklistState || {};
    return required.every(r => r.received || checked[r.key] || withFile.has(r.key));
}

function mockAutoStart(claim, dl) {
    if (dl.start_at || !mockRequirementsMet(claim)) return dl;
    const at = new Date().toISOString();
    dl.history.unshift({
        at, by: null, by_name: null, by_email: null,
        field: 'start_at', from: null, to: at, justification: '', source: 'auto',
    });
    dl.start_at = at;
    dl.start_source = 'auto';
    if (dl.due_source !== 'manual') {
        dl.due_at = new Date(Date.parse(at) + dl.total_days * DAY_MS).toISOString();
        dl.due_source = 'auto';
    }
    writeMockDeadline(claim, dl);
    return dl;
}

// → Deadline (ver api/deadline.js)
export async function loadDeadline(claim) {
    if (online()) {
        const res = await getDeadline(claim.id);
        return res?.data || res;
    }
    return { ...mockAutoStart(claim, readMockDeadline(claim)), can_adjust: true };
}

class MockDeadlineError extends Error {
    constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

// body: { start_at?, due_at?, justification }. Devolve o prazo já relido.
export async function saveDeadlineAdjust(claim, body, currentUser) {
    if (online()) {
        await adjustDeadline(claim.id, body);
        return loadDeadline(claim);
    }
    const justification = String(body.justification || '').trim();
    if (justification.length < 5) throw new MockDeadlineError(400, 'VALIDATION_ERROR', 'A justificativa precisa ter ao menos 5 caracteres.');
    if (!body.start_at && !body.due_at) throw new MockDeadlineError(400, 'VALIDATION_ERROR', 'Informe um novo início ou um novo vencimento.');
    const dl = readMockDeadline(claim);
    const start = body.start_at || dl.start_at;
    if (body.due_at && start && Date.parse(body.due_at) < Date.parse(start)) {
        throw new MockDeadlineError(400, 'VALIDATION_ERROR', 'O vencimento não pode ser anterior ao início.');
    }
    const push = (field, to) => dl.history.unshift({
        at: new Date().toISOString(),
        by: currentUser?.id ?? null,
        by_name: currentUser?.name || null,
        by_email: currentUser?.email || null,
        field, from: dl[field], to, justification, source: 'manual',
    });
    if (body.start_at) {
        push('start_at', body.start_at);
        dl.start_at = body.start_at;
        dl.start_source = 'manual';
        if (dl.due_source !== 'manual' && !body.due_at) {
            dl.due_at = new Date(Date.parse(body.start_at) + dl.total_days * DAY_MS).toISOString();
            dl.due_source = 'auto';
        }
    }
    if (body.due_at) {
        push('due_at', body.due_at);
        dl.due_at = body.due_at;
        dl.due_source = 'manual';
    }
    writeMockDeadline(claim, dl);
    return { ...dl, can_adjust: true };
}

// ── Prazo desatualizado ─────────────────────────────────────────────────────────
// O servidor inicia o prazo sozinho quando o último obrigatório é cumprido —
// marcado no checklist ou com arquivo no deck da tarefa. Quem muda uma dessas
// coisas avisa, e o cartão relê GET /deadline em vez de esperar o F5.
const STALE_EVENT = 'arquivoseg:deadline-stale';

export function markDeadlineStale(claimId) {
    window.dispatchEvent(new CustomEvent(STALE_EVENT, { detail: { claimId: String(claimId) } }));
}

export function onDeadlineStale(claimId, fn) {
    const handler = (e) => { if (e.detail?.claimId === String(claimId)) fn(); };
    window.addEventListener(STALE_EVENT, handler);
    return () => window.removeEventListener(STALE_EVENT, handler);
}

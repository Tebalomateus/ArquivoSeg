import { isMockEnabled, getToken } from '../api/client';
import { getProcessStorage } from '../api/storage';
import { listProcessAudit } from '../api/processAudit';
import { filesKey } from '../api/deckBoard';
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
// quem mostra traduz com ACTION_LABELS.
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

function readMockDeadline(claimId) {
    let stored = null;
    try { stored = JSON.parse(sessionStorage.getItem(deadlineKey(claimId)) || 'null'); } catch { /* ignore */ }
    return stored || {
        start_at: null, start_source: null, total_days: 30,
        due_at: null, due_source: null, history: [],
    };
}

// → Deadline (ver api/deadline.js)
export async function loadDeadline(claim) {
    if (online()) {
        const res = await getDeadline(claim.id);
        return res?.data || res;
    }
    return { ...readMockDeadline(claim.id), can_adjust: true };
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
    const dl = readMockDeadline(claim.id);
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
    try { sessionStorage.setItem(deadlineKey(claim.id), JSON.stringify(dl)); } catch { /* ignore */ }
    return { ...dl, can_adjust: true };
}

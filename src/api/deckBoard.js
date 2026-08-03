// Pure client-side board reducer — mirrors the Go domain in
// process-manager/internal/domain/deck/service.go. It powers two things:
//   1. optimistic updates (apply locally, then reconcile with the server response);
//   2. mock mode (VITE_ENABLE_MOCK), where there is no backend to call.
// Keeping the invariants here identical to the server keeps the demo honest.

export const STATUS = { PENDENTE: 'pendente', ENVIADO: 'enviado', ATENDIDO: 'atendido' };
export const DEFAULT_RETURN_REASON = 'Documento não comprova a tarefa. Reenvie.';

const randId = () => (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11));

export function emptyBoard() {
    return { decks: [], seq: 0, taskStatus: {}, taskReturns: {} };
}

// Normalize a server payload (or a stored board) into the working shape.
export function normalizeBoard(raw) {
    if (!raw) return emptyBoard();
    return {
        decks: Array.isArray(raw.decks) ? raw.decks : [],
        seq: raw.seq ?? raw.decks?.length ?? 0,
        taskStatus: raw.taskStatus || {},
        taskReturns: raw.taskReturns || {},
    };
}

const grupoFromKey = (itemKey) => (itemKey.includes('.') ? itemKey.slice(0, itemKey.indexOf('.')) : itemKey);
const clone = (b) => ({ decks: b.decks.map(d => ({ ...d, arquivos: [...d.arquivos], tarefaIds: [...d.tarefaIds] })), seq: b.seq, taskStatus: { ...b.taskStatus }, taskReturns: { ...b.taskReturns } });

// Remove itemKey from every deck; discard any deck left with no tasks.
function detachFromAll(b, itemKey, now) {
    for (const d of b.decks) {
        const i = d.tarefaIds.indexOf(itemKey);
        if (i >= 0) { d.tarefaIds.splice(i, 1); d.updatedAt = now; }
    }
    b.decks = b.decks.filter(d => d.tarefaIds.length > 0);
}

export function createDeck(board, { tarefaIds, arquivos = [] }, actor) {
    const b = clone(board);
    const now = new Date().toISOString();
    if (!tarefaIds || tarefaIds.length === 0) throw new Error('Selecione ao menos uma tarefa.');
    tarefaIds.forEach(k => detachFromAll(b, k, now));
    b.seq += 1;
    const deck = {
        id: randId(),
        codigo: `DECK-${String(b.seq).padStart(2, '0')}`,
        status: STATUS.PENDENTE,
        grupo: grupoFromKey(tarefaIds[0]),
        arquivos: dedupFiles(arquivos),
        tarefaIds: [...new Set(tarefaIds)],
        createdBy: actor || '',
        createdAt: now,
        updatedAt: now,
    };
    for (const k of deck.tarefaIds) { b.taskStatus[k] = STATUS.PENDENTE; delete b.taskReturns[k]; }
    b.decks.push(deck);
    return { board: b, deck };
}

export function addFiles(board, deckId, arquivos) {
    const b = clone(board);
    const d = b.decks.find(x => x.id === deckId);
    if (!d) throw new Error('Deck não encontrado.');
    d.arquivos = dedupFiles([...d.arquivos, ...arquivos]);
    d.updatedAt = new Date().toISOString();
    return { board: b };
}

export function removeFile(board, deckId, fileVerId) {
    const b = clone(board);
    const d = b.decks.find(x => x.id === deckId);
    if (!d) throw new Error('Deck não encontrado.');
    d.arquivos = d.arquivos.filter(f => f.fileVerId !== fileVerId);
    d.updatedAt = new Date().toISOString();
    return { board: b };
}

export function attachTasks(board, deckId, tarefaIds) {
    const b = clone(board);
    const now = new Date().toISOString();
    const target = b.decks.find(x => x.id === deckId);
    if (!target) throw new Error('Deck não encontrado.');
    if (target.status !== STATUS.PENDENTE) throw new Error('Só é possível juntar tarefas a um deck pendente.');
    tarefaIds.forEach(k => detachFromAll(b, k, now));
    const d = b.decks.find(x => x.id === deckId); // re-resolve after possible discards
    for (const k of [...new Set(tarefaIds)]) {
        if (!d.tarefaIds.includes(k)) d.tarefaIds.push(k);
        b.taskStatus[k] = STATUS.PENDENTE;
        delete b.taskReturns[k];
    }
    d.updatedAt = now;
    return { board: b };
}

export function detachTask(board, deckId, itemKey) {
    const b = clone(board);
    const d = b.decks.find(x => x.id === deckId);
    if (!d) throw new Error('Deck não encontrado.');
    const i = d.tarefaIds.indexOf(itemKey);
    if (i < 0) return { board: b, discarded: false };
    d.tarefaIds.splice(i, 1);
    d.updatedAt = new Date().toISOString();
    b.taskStatus[itemKey] = STATUS.PENDENTE;
    let discarded = false;
    if (d.tarefaIds.length === 0) { b.decks = b.decks.filter(x => x.id !== deckId); discarded = true; }
    return { board: b, discarded };
}

export function submitDeck(board, deckId) {
    const b = clone(board);
    const d = b.decks.find(x => x.id === deckId);
    if (!d) throw new Error('Deck não encontrado.');
    if (d.status !== STATUS.PENDENTE) throw new Error('Deck não está pendente.');
    if (d.arquivos.length === 0) throw new Error('Anexe ao menos um arquivo antes de enviar.');
    d.status = STATUS.ENVIADO;
    d.updatedAt = new Date().toISOString();
    for (const k of d.tarefaIds) b.taskStatus[k] = STATUS.ENVIADO;
    return { board: b };
}

export function analyzeDeck(board, deckId, devolvidas, motivo, actor) {
    const b = clone(board);
    const now = new Date().toISOString();
    const d = b.decks.find(x => x.id === deckId);
    if (!d) throw new Error('Deck não encontrado.');
    if (d.status !== STATUS.ENVIADO) throw new Error('Deck não está em análise.');
    const returnSet = new Set((devolvidas || []).filter(k => d.tarefaIds.includes(k)));
    const reason = (motivo || '').trim() || DEFAULT_RETURN_REASON;
    const kept = [];
    for (const k of d.tarefaIds) {
        if (returnSet.has(k)) {
            b.taskStatus[k] = STATUS.PENDENTE;
            b.taskReturns[k] = { motivo: reason, devolvidaBy: actor || '', devolvidaAt: now };
        } else {
            b.taskStatus[k] = STATUS.ATENDIDO;
            delete b.taskReturns[k];
            kept.push(k);
        }
    }
    if (kept.length === 0) { b.decks = b.decks.filter(x => x.id !== deckId); return { board: b, discarded: true }; }
    d.tarefaIds = kept;
    d.status = STATUS.ATENDIDO;
    d.updatedAt = now;
    return { board: b, discarded: false };
}

function dedupFiles(files) {
    const seen = new Set();
    const out = [];
    for (const f of files) {
        if (!f.fileVerId || !seen.has(f.fileVerId)) {
            if (f.fileVerId) seen.add(f.fileVerId);
            out.push(f);
        }
    }
    return out;
}

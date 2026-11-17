import * as commentsApi from './comments';

// Comentários de deck — a fila de cada deck do kanban. Um comentário preso a um
// deck vale como comprovação dele, como um arquivo (ver deck.CommentsProve em
// process-manager/internal/domain/deck/model.go), com duas ressalvas:
//   - depois de uma devolução (deck.devolvidoAt), só conta comentário criado
//     depois dela;
//   - deck desfeito sai do quadro: seus comentários ficam no histórico do
//     sinistro, buscáveis, marcados "desfeito", e não comprovam mais nada.
//
// Com API, as rotas /processes/:id/comments (deck_id e q). No mock, os
// comentários do sinistro ficam no sessionStorage deckcomments_<id>.

export const commentsKey = (claimId) => `deckcomments_${claimId}`;

const randId = () => (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11));

// O mesmo dobramento do servidor (comment.Fold): minúsculas e sem os acentos
// do português.
const ACCENT_FROM = 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç';
const ACCENT_TO = 'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc';
export function fold(s) {
    let out = '';
    for (const ch of String(s || '').toLowerCase()) {
        const i = ACCENT_FROM.indexOf(ch);
        out += i >= 0 ? ACCENT_TO[i] : ch;
    }
    return out;
}

// Resposta do servidor (snake_case) → forma da tela.
export function normalizeComment(raw) {
    if (!raw) return null;
    return {
        id: raw.id,
        deckId: raw.deck_id ?? raw.deckId ?? null,
        deckCodigo: raw.deck_codigo ?? raw.deckCodigo ?? null,
        deckDesfeito: !!(raw.deck_desfeito ?? raw.deckDesfeito),
        body: raw.body || '',
        authorId: raw.author_id ?? raw.authorId ?? null,
        authorName: raw.author_name ?? raw.authorName ?? null,
        authorEmail: raw.author_email ?? raw.authorEmail ?? null,
        createdAt: raw.created_at ?? raw.createdAt,
        updatedAt: raw.updated_at ?? raw.updatedAt,
    };
}

// O deck foi devolvido depois deste comentário? Então ele é da tentativa que o
// analista já recusou.
export function beforeReturn(comment, deck) {
    if (!deck?.devolvidoAt || !comment?.createdAt) return false;
    return Date.parse(comment.createdAt) <= Date.parse(deck.devolvidoAt);
}

// Espelho de deck.CommentsProve: stats = { count, lastAt }.
export function commentsProve(deck, stats) {
    if (!stats || !stats.count) return false;
    if (deck?.devolvidoAt && !(Date.parse(stats.lastAt) > Date.parse(deck.devolvidoAt))) return false;
    return true;
}

// Deck tem comprovação para ser enviado: arquivo, ou comentário que prove.
export function hasEvidence(deck, stats) {
    return (deck?.arquivos?.length || 0) > 0 || commentsProve(deck, stats);
}

// ── Mock ───────────────────────────────────────────────────────────────────────

function readMock(claimId) {
    try {
        const v = JSON.parse(sessionStorage.getItem(commentsKey(claimId)) || '[]');
        return Array.isArray(v) ? v : [];
    } catch { return []; }
}

function writeMock(claimId, list) {
    try { sessionStorage.setItem(commentsKey(claimId), JSON.stringify(list)); } catch { /* ignore */ }
}

// Contagem por deck, como o commentStats do quadro no servidor. Só os decks
// que ainda estão no quadro (decks) entram.
export function mockCommentStats(claimId, decks) {
    const onBoard = new Set((decks || []).map(d => d.id));
    const out = {};
    for (const c of readMock(claimId)) {
        if (!c.deckId || !onBoard.has(c.deckId)) continue;
        const s = out[c.deckId] || { count: 0, lastAt: c.createdAt };
        s.count += 1;
        if (Date.parse(c.createdAt) > Date.parse(s.lastAt)) s.lastAt = c.createdAt;
        out[c.deckId] = s;
    }
    return out;
}

class MockCommentError extends Error {
    constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

// ── API da tela ────────────────────────────────────────────────────────────────

// { deckId?, q? } → comentários do mais antigo ao mais novo. decks é o quadro
// atual, usado no mock para marcar os de deck desfeito (no servidor quem marca
// é ele).
export async function listDeckComments(claimId, { deckId, q } = {}, { online, decks } = {}) {
    if (online) {
        const res = await commentsApi.listComments(claimId, { deckId, q });
        return (Array.isArray(res?.data) ? res.data : []).map(normalizeComment);
    }
    const onBoard = new Set((decks || []).map(d => d.id));
    const needle = fold((q || '').trim());
    return readMock(claimId)
        .filter(c => !deckId || c.deckId === deckId)
        .filter(c => !needle || fold(c.body).includes(needle))
        .map(c => ({ ...c, deckDesfeito: !!c.deckId && !onBoard.has(c.deckId) }))
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export async function createDeckComment(claimId, deck, body, { online, currentUser } = {}) {
    if (online) {
        const raw = await commentsApi.createComment(claimId, body, null, deck.id);
        return normalizeComment(raw);
    }
    const now = new Date().toISOString();
    const c = {
        id: randId(), deckId: deck.id, deckCodigo: deck.codigo, deckDesfeito: false, body,
        authorId: currentUser?.id || null, authorName: currentUser?.name || null, authorEmail: currentUser?.email || null,
        createdAt: now, updatedAt: now,
    };
    writeMock(claimId, [...readMock(claimId), c]);
    return c;
}

export async function updateDeckComment(claimId, commentId, body, { online } = {}) {
    if (online) return normalizeComment(await commentsApi.updateComment(commentId, body));
    const list = readMock(claimId);
    const c = list.find(x => x.id === commentId);
    if (!c) throw new MockCommentError(404, 'COMMENT_NOT_FOUND', 'Comentário não encontrado.');
    c.body = body;
    c.updatedAt = new Date().toISOString();
    writeMock(claimId, list);
    return { ...c };
}

export async function deleteDeckComment(claimId, commentId, { online } = {}) {
    if (online) { await commentsApi.deleteComment(commentId); return; }
    writeMock(claimId, readMock(claimId).filter(x => x.id !== commentId));
}

// O comentário é de quem está logado? Com API o id do token (sub do Zitadel)
// não é o users.id do autor, então compara pelo e-mail.
export function isOwnComment(comment, currentUser) {
    if (!comment || !currentUser) return false;
    if (comment.authorEmail && currentUser.email) {
        return comment.authorEmail.toLowerCase() === String(currentUser.email).toLowerCase();
    }
    return !!comment.authorId && comment.authorId === currentUser.id;
}

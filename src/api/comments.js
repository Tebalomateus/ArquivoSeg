import { api } from './client';

// { fileVerId?, deckId?, q? } — deckId: a fila de um deck; q: busca no texto
// (o servidor ignora maiúsculas e acentos).
export function listComments(processId, { fileVerId, deckId, q } = {}) {
    const params = new URLSearchParams();
    if (fileVerId) params.set('file_ver_id', fileVerId);
    if (deckId) params.set('deck_id', deckId);
    if (q && q.trim()) params.set('q', q.trim());
    const qs = params.toString();
    return api.get(`/api/v1/processes/${processId}/comments${qs ? `?${qs}` : ''}`);
}

export function createComment(processId, body, fileVerId, deckId) {
    const payload = { body };
    if (fileVerId) payload.file_ver_id = fileVerId;
    if (deckId) payload.deck_id = deckId;
    return api.post(`/api/v1/processes/${processId}/comments`, payload);
}

export function updateComment(commentId, body) {
    return api.patch(`/api/v1/comments/${commentId}`, { body });
}

export function deleteComment(commentId) {
    return api.delete(`/api/v1/comments/${commentId}`);
}

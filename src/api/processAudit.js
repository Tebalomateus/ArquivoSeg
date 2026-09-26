import { api } from './client';

// Trilha de auditoria de um sinistro: eventos do próprio processo e dos
// arquivos, decks, comentários e links que pertencem a ele. access.denied fica
// de fora. Guardada por processo.verAuditoria.
//
// → { data: [{ id, timestamp, action, resource_type, resource_id,
//              actor_user_id, actor_name, actor_email, share_token_id, metadata }],
//     total }  // mais recentes primeiro
export function listProcessAudit(processId, { page = 1, limit = 50, actorUserId, action } = {}) {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (actorUserId) q.set('actor_user_id', actorUserId);
    if (action) q.set('action', action);
    return api.get(`/api/v1/processes/${processId}/audit?${q}`);
}

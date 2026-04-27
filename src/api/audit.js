import { api } from './client';

export function listAudit({ resourceType, resourceId, actorUserId, from, to, page = 1, limit = 50 } = {}) {
    const params = new URLSearchParams({ page, limit });
    if (resourceType) params.set('resource_type', resourceType);
    if (resourceId) params.set('resource_id', resourceId);
    if (actorUserId) params.set('actor_user_id', actorUserId);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return api.get(`/api/v1/audit?${params}`);
}

// PT-BR display labels for the actions defined in
// process-manager/internal/domain/audit/model.go.
export const ACTION_LABELS = {
    'process.created': 'Sinistro criado',
    'process.status_changed': 'Status alterado',
    'process.updated': 'Sinistro atualizado',
    'process.deleted': 'Sinistro arquivado',
    'file.uploaded': 'Documento enviado',
    'file.downloaded': 'Documento baixado',
    'file.deleted': 'Documento excluído',
    'comment.created': 'Anotação criada',
    'comment.updated': 'Anotação editada',
    'comment.deleted': 'Anotação removida',
    'share.created': 'Link público criado',
    'share.accessed': 'Link público acessado',
    'share.revoked': 'Link público revogado',
    'client.created': 'Cliente criado',
    'client.updated': 'Cliente atualizado',
    'client.deleted': 'Cliente excluído',
    'access.denied': 'Acesso negado',
    'resource.not_found': 'Recurso inexistente',
};

export function getAudit(id) {
    return api.get(`/api/v1/audit/${id}`);
}

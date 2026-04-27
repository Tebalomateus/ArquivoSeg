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

export function getAudit(id) {
    return api.get(`/api/v1/audit/${id}`);
}

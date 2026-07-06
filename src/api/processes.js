import { api } from './client';

export function listProcesses({ page = 1, limit = 50, status, assignedTo } = {}) {
    const params = new URLSearchParams({ page, limit });
    if (status) params.set('status', status);
    if (assignedTo) params.set('assigned_to', assignedTo);
    return api.get(`/api/v1/processes?${params}`);
}

export function getProcess(id) {
    return api.get(`/api/v1/processes/${id}`);
}

export function createProcess({ title, description, metadata, claim_type }) {
    const body = { title, description };
    if (metadata !== undefined) body.metadata = metadata;
    if (claim_type) body.claim_type = claim_type;
    return api.post('/api/v1/processes', body);
}

export function updateProcess(id, patch) {
    return api.patch(`/api/v1/processes/${id}`, patch);
}

export function archiveProcess(id) {
    return api.delete(`/api/v1/processes/${id}`);
}

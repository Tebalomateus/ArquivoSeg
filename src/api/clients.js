import { api } from './client';

export function listClients({ type, page = 1, limit = 100 } = {}) {
    const params = new URLSearchParams({ page, limit });
    if (type) params.set('type', type);
    return api.get(`/api/v1/clients?${params}`);
}

export function getClient(id) {
    return api.get(`/api/v1/clients/${id}`);
}

export function createClient(payload) {
    return api.post('/api/v1/clients', payload);
}

export function updateClient(id, patch) {
    return api.patch(`/api/v1/clients/${id}`, patch);
}

export function deleteClient(id) {
    return api.delete(`/api/v1/clients/${id}`);
}

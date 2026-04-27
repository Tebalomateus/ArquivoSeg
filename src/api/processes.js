import { api } from './client';

export function listProcesses({ page = 1, limit = 50, status } = {}) {
    const params = new URLSearchParams({ page, limit });
    if (status) params.set('status', status);
    return api.get(`/api/v1/processes?${params}`);
}

export function getProcess(id) {
    return api.get(`/api/v1/processes/${id}`);
}

export function createProcess({ title, description }) {
    return api.post('/api/v1/processes', { title, description });
}

export function updateProcess(id, patch) {
    return api.patch(`/api/v1/processes/${id}`, patch);
}

export function archiveProcess(id) {
    return api.delete(`/api/v1/processes/${id}`);
}

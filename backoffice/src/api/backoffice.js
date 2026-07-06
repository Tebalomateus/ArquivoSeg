import { api } from './client';

export function listTenants() {
    return api.get('/api/backoffice/tenants');
}

export function listChecklists(tenantId) {
    return api.get(`/api/backoffice/checklists/${tenantId}`);
}

export function getChecklistRaw(tenantId, type) {
    return api.get(`/api/backoffice/checklists/${tenantId}/${encodeURIComponent(type)}`);
}

export function putChecklist(tenantId, type, yamlContent) {
    return api.put(`/api/backoffice/checklists/${tenantId}/${encodeURIComponent(type)}`, yamlContent);
}

export function deleteChecklist(tenantId, type) {
    return api.delete(`/api/backoffice/checklists/${tenantId}/${encodeURIComponent(type)}`);
}

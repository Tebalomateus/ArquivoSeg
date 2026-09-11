import { api } from './client';

export function listChecklistTypes() {
    return api.get('/api/v1/checklists');
}

export function getChecklistDef(claimType) {
    return api.get(`/api/v1/checklists/${encodeURIComponent(claimType)}`);
}

export function updateChecklistState(processId, state) {
    return api.patch(`/api/v1/processes/${processId}/checklist`, state);
}

export function addChecklistItem(processId, { stageId, label }) {
    return api.post(`/api/v1/processes/${processId}/checklist/items`, { stageId, label });
}

export function removeChecklistItem(processId, itemKey, reason) {
    return api.post(`/api/v1/processes/${processId}/checklist/items/${encodeURIComponent(itemKey)}/remove`, { reason });
}

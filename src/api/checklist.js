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

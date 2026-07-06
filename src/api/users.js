import { api } from './client';

export function listUsers() {
    return api.get('/api/v1/users');
}

export function inviteUser(data) {
    return api.post('/api/v1/users/invite', data);
}

export function updateUserRole(id, role) {
    return api.patch(`/api/v1/users/${id}/role`, { role });
}

export function deactivateUser(id) {
    return api.delete(`/api/v1/users/${id}`);
}

export function resendInvite(id) {
    return api.post(`/api/v1/users/${id}/resend-invite`, {});
}

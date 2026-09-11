import { api } from './client';

export function listUsers() {
    return api.get('/api/v1/users');
}

// data is { email, first_name, last_name, role_ids }. Only email is required:
// an invite with no roles creates an account that can log in and see nothing,
// which is the right default when the access is still being decided.
export function inviteUser(data) {
    return api.post('/api/v1/users/invite', data);
}

export function deactivateUser(id) {
    return api.delete(`/api/v1/users/${id}`);
}

export function resendInvite(id) {
    return api.post(`/api/v1/users/${id}/resend-invite`, {});
}

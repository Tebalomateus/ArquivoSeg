import { api } from './client';

export function listUsers() {
    return api.get('/api/v1/users');
}

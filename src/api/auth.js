import { setToken } from './client';

export function logoutSession() {
    setToken(null);
}

export function actorLabelFromDbId(dbId, fallback = '—') {
    if (!dbId) return fallback;
    return `Usuário ${String(dbId).slice(0, 8)}`;
}

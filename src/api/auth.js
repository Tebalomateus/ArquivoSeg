import { setToken } from './client';

const BACK_TO_UI_ROLE = {
    admin: 'ADMIN',
    manager: 'CORRETOR',
    contributor: 'PERITO',
    viewer: 'ANALISTA',
};

const UI_TO_BACK_ROLE = {
    ADMIN: 'admin',
    CORRETOR: 'manager',
    PERITO: 'contributor',
    ANALISTA: 'viewer',
};

export function uiRoleFor(backRole) {
    return BACK_TO_UI_ROLE[backRole] || 'ANALISTA';
}

export function backRoleFor(uiRole) {
    return UI_TO_BACK_ROLE[uiRole] || 'viewer';
}

export function logoutSession() {
    setToken(null);
}

export function actorLabelFromDbId(dbId, fallback = '—') {
    if (!dbId) return fallback;
    return `Usuário ${String(dbId).slice(0, 8)}`;
}

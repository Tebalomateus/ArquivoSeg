import { setToken, isMockEnabled } from './client';

const ROLE_TO_BACK = {
    ADMIN: 'admin',
    CORRETOR: 'manager',
    PERITO: 'contributor',
    ANALISTA: 'viewer',
};

const ROLE_TO_PAT_VAR = {
    ADMIN: 'VITE_PAT_ADMIN',
    CORRETOR: 'VITE_PAT_MANAGER',
    PERITO: 'VITE_PAT_CONTRIBUTOR',
    ANALISTA: 'VITE_PAT_VIEWER',
};

export function backRoleFor(uiRole) {
    return ROLE_TO_BACK[uiRole] || null;
}

export function patFor(uiRole) {
    if (isMockEnabled()) return null;
    const envVar = ROLE_TO_PAT_VAR[uiRole];
    if (!envVar) return null;
    return import.meta.env[envVar] || null;
}

export function loginWithUiRole(uiRole) {
    const pat = patFor(uiRole);
    if (pat) setToken(pat);
    return { backRole: backRoleFor(uiRole), token: pat };
}

export function logoutSession() {
    setToken(null);
}

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

const DBID_TO_ROLE = (() => {
    const map = {};
    const pairs = [
        ['ADMIN', import.meta.env.VITE_USER_DBID_ADMIN],
        ['CORRETOR', import.meta.env.VITE_USER_DBID_MANAGER],
        ['PERITO', import.meta.env.VITE_USER_DBID_CONTRIBUTOR],
        ['ANALISTA', import.meta.env.VITE_USER_DBID_VIEWER],
    ];
    for (const [role, dbId] of pairs) {
        if (dbId) map[dbId] = role;
    }
    return map;
})();

export function actorLabelFromDbId(dbId, fallback = '—') {
    if (!dbId) return fallback;
    return DBID_TO_ROLE[dbId] || `Usuário ${String(dbId).slice(0, 8)}`;
}

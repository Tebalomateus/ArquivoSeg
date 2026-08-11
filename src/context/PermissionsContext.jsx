import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getMyPermissions } from '../api/iam';
import { getToken, isMockEnabled } from '../api/client';
import { permissionsForMockUser } from './mockPermissions';
import { useClaims } from './ClaimsContext';

/**
 * PermissionsContext holds what the signed-in user may do.
 *
 * UI gating is not access control — the backend is the authority. Hiding a
 * button only saves the user a click into a 403; forcing the route still gets
 * one. So when the API cannot answer, this keeps whatever it last knew and
 * grants nothing new: showing a control the server will refuse is a worse
 * failure than showing one control too few, and the admin is never locked out
 * either way — isAdmin comes from the token, not from here.
 */
const PermissionsContext = createContext(null);

const CACHE_KEY = 'arquivoseg_permissions';

// Where the answer came from, so screens can say so.
export const SOURCE_API = 'api';
export const SOURCE_MOCK = 'mock';
// Nothing answered yet, or the last attempt failed: whatever is in `permissions`
// is a leftover, never an authorization.
export const SOURCE_NONE = 'none';

function readCache() {
    try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed?.permissions)) return null;
        return parsed;
    } catch {
        return null;
    }
}

function writeCache(entry) {
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    } catch {
        // A full or unavailable sessionStorage costs a refetch, nothing more.
    }
}

export function clearPermissionsCache() {
    try {
        sessionStorage.removeItem(CACHE_KEY);
    } catch {
        // Nothing to clear.
    }
}

export function PermissionsProvider({ children }) {
    const { currentUser } = useClaims();
    // Straight from the Zitadel claim, never from the IAM tables: a mistake in
    // the tenant's own permission data must not be able to shut the admin out.
    const isAdmin = currentUser?.isAdmin === true;

    // Read once: this is the entry the session started with, and every later
    // render should be reading state, not storage.
    const cached = useRef(readCache()).current;
    const [permissions, setPermissions] = useState(() => new Set(cached?.permissions || []));
    const [policyVersion, setPolicyVersion] = useState(cached?.policyVersion ?? null);
    const [source, setSource] = useState(cached?.source || SOURCE_NONE);
    const [loading, setLoading] = useState(false);

    // No backend to ask: the demo personas carry their own set. Not cached —
    // it is derived, and caching it would only create a second copy to expire.
    const applyMock = useCallback((user) => {
        setPermissions(permissionsForMockUser(user));
        setPolicyVersion(null);
        setSource(SOURCE_MOCK);
        clearPermissionsCache();
    }, []);

    const refresh = useCallback(async () => {
        if (!currentUser) return;
        if (isMockEnabled() || !getToken()) {
            applyMock(currentUser);
            return;
        }

        setLoading(true);
        try {
            const res = await getMyPermissions();
            const data = res?.data || {};
            const next = new Set(data.permissions || []);
            setPermissions(next);
            setPolicyVersion(data.policy_version ?? null);
            setSource(SOURCE_API);
            writeCache({
                permissions: [...next],
                policyVersion: data.policy_version ?? null,
                source: SOURCE_API,
                userId: currentUser.id,
            });
        } catch {
            // A transient failure. Whatever the session already had stays — it
            // came from this same API — but it stops counting as an answer, so
            // a screen that cares can say the set may be stale. Nothing is
            // granted here that the API did not already grant.
            setSource(SOURCE_NONE);
        } finally {
            setLoading(false);
        }
    }, [currentUser, applyMock]);

    useEffect(() => {
        if (!currentUser) {
            setPermissions(new Set());
            setPolicyVersion(null);
            setSource(SOURCE_NONE);
            clearPermissionsCache();
            return;
        }
        // A cache belonging to whoever signed in before is worse than none.
        if (cached?.userId && cached.userId !== currentUser.id) {
            clearPermissionsCache();
            setPermissions(new Set());
        }
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.id]);

    const value = useMemo(() => {
        // Admin is an implicit wildcard, matching the backend. It is also the
        // anti-lockout guarantee: a mistake in the tenant's own IAM data must
        // never shut the admin out of the screen that fixes it.
        const can = (action) => isAdmin || permissions.has(action);
        return { permissions, isAdmin, policyVersion, source, loading, can, refresh };
    }, [permissions, isAdmin, policyVersion, source, loading, refresh]);

    return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
    const ctx = useContext(PermissionsContext);
    if (!ctx) throw new Error('usePermissions must be used inside a PermissionsProvider');
    return ctx;
}

/**
 * useCan returns the predicate itself, so a component can check several actions
 * without one hook call each.
 *
 *   const can = useCan();
 *   {can('deck.analisar') && <button>Analisar</button>}
 */
export function useCan() {
    return usePermissions().can;
}

/**
 * Can renders its children only when the action is allowed.
 *
 *   <Can action="arquivo.excluir"><DeleteButton /></Can>
 *   <Can action="deck.analisar" fallback={<Locked />}>…</Can>
 */
export function Can({ action, children, fallback = null }) {
    const can = useCan();
    return can(action) ? children : fallback;
}

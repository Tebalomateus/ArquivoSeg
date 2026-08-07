import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getMyPermissions } from '../api/iam';
import { getToken, isMockEnabled } from '../api/client';
import { permissionsForLegacyRole } from './legacyPermissions';
import { useClaims } from './ClaimsContext';

/**
 * PermissionsContext holds what the signed-in user may do.
 *
 * UI gating is not access control — the backend is the authority. Hiding a
 * button only saves the user a click into a 403; forcing the route still gets
 * one. That is why nothing here fails closed in a way that locks the app: when
 * the API cannot be reached the legacy role shim answers instead, which is what
 * the app did before permissions existed.
 */
const PermissionsContext = createContext(null);

const CACHE_KEY = 'arquivoseg_permissions';

// Where the answer came from, so screens can say so and so step 12 can find
// what still depends on the shim.
export const SOURCE_API = 'api';
export const SOURCE_LEGACY = 'legacy';

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
    // isAdmin comes straight from the Zitadel claim. The backRole comparison is
    // the fallback for a session opened before the callback started setting the
    // flag, and for the mock login; it goes away with backRole in step 12.
    const isAdmin = currentUser?.isAdmin ?? currentUser?.backRole === 'admin';

    // Read once: this is the entry the session started with, and every later
    // render should be reading state, not storage.
    const cached = useRef(readCache()).current;
    const [permissions, setPermissions] = useState(() => new Set(cached?.permissions || []));
    const [policyVersion, setPolicyVersion] = useState(cached?.policyVersion ?? null);
    const [source, setSource] = useState(cached?.source || SOURCE_LEGACY);
    const [loading, setLoading] = useState(false);

    // The shim is the starting point and the fallback, never an override: once
    // the API answers, its set replaces this one wholesale.
    const applyLegacy = useCallback((backRole) => {
        setPermissions(permissionsForLegacyRole(backRole));
        setPolicyVersion(null);
        setSource(SOURCE_LEGACY);
        clearPermissionsCache();
    }, []);

    const refresh = useCallback(async () => {
        if (!currentUser) return;
        if (isMockEnabled() || !getToken()) {
            applyLegacy(currentUser.backRole);
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
            // A backend that predates this endpoint, or a transient failure.
            // Falling back to the legacy role keeps the app usable and keeps the
            // decision where it belongs — with the API, on every request.
            applyLegacy(currentUser.backRole);
        } finally {
            setLoading(false);
        }
    }, [currentUser, applyLegacy]);

    useEffect(() => {
        if (!currentUser) {
            setPermissions(new Set());
            setPolicyVersion(null);
            setSource(SOURCE_LEGACY);
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

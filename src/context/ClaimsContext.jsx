import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { INITIAL_CLAIMS, INITIAL_USERS, INITIAL_CLIENTS } from '../constants/initialData';
import { claimsService } from '../services/claimsService';
import { logoutSession } from '../api/auth';
import { zitadel } from '../api/zitadel';
import { getToken, isMockEnabled, setToken } from '../api/client';
import { parseFolderFromFileName } from '../api/files';

const ClaimsContext = createContext();

const STATUS_BACK_TO_UI = {
    ready: 'Aberto',
    ongoing: 'Em Análise',
    review: 'Em Revisão',
    done: 'Concluído',
    archived: 'Arquivado',
};

// Mirrors backend's process.validTransitions — keeps the UI from offering
// transitions that the server will reject with INVALID_STATUS_TRANSITION.
export const VALID_NEXT_STATUS = {
    ready: ['ongoing', 'archived'],
    ongoing: ['review', 'archived'],
    review: ['done', 'archived'],
    done: ['archived'],
    archived: [],
};

// Short random id for purely client-side keys (checklist items, share tokens, folder slots).
const randId = () => (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 9)
    : Math.random().toString(36).slice(2, 11));

const buildFolders = (initialChecklist) => [
    { id: 'f1-' + Date.now(), name: 'Causa', category: 'causa', completion: 0, documents: [], checklist: (initialChecklist || []).filter(i => i.folder === 'Causa').map(i => ({ ...i, id: randId(), received: false })) },
    { id: 'f2-' + Date.now(), name: 'Prejuízo', category: 'prejuizo', completion: 0, documents: [], checklist: (initialChecklist || []).filter(i => i.folder === 'Prejuízo').map(i => ({ ...i, id: randId(), received: false })) },
    { id: 'f3-' + Date.now(), name: 'Liquidação', category: 'liquidacao', completion: 0, documents: [], checklist: (initialChecklist || []).filter(i => i.folder === 'Liquidação').map(i => ({ ...i, id: randId(), received: false })) },
    { id: 'f4-' + Date.now(), name: 'Gerencial', category: 'gerencial', completion: 0, private: true, documents: [], checklist: [] },
];

// Computes SLA from process.created_at + 30 (or 120 for complex) days, no persisted suspensions.
const computeDeadline = (createdAtISO, isComplex) => {
    const totalDays = isComplex ? 120 : 30;
    const created = createdAtISO ? new Date(createdAtISO) : new Date();
    const elapsedDays = Math.floor((Date.now() - created.getTime()) / 86_400_000);
    return {
        totalDays,
        remainingDays: Math.max(0, totalDays - elapsedDays),
        isSuspended: false,
        suspensionCount: 0,
        lastUpdated: Date.now(),
        history: [{ date: created.toLocaleDateString('pt-BR'), action: 'Início do prazo legal.' }],
    };
};

// Front-only fields that we serialize into process.metadata for cross-device persistence.
// Documents are excluded — they come from /processes/:id/files. Backend-owned fields
// (id, title, description, status, created_at, updated_at) are also excluded.
const METADATA_KEYS = [
    'number', 'insurer', 'insuredName', 'policyNumber', 'policyStartDate', 'policyEndDate',
    'retroactiveDate', 'modality', 'brokerName', 'brokerClaimId', 'adjusterName', 'adjusterClaimId',
    'occurrenceDate', 'occurrenceLocation', 'observations', 'isComplex', 'progress',
    'deadline', 'shareToken', 'activities',
];

const extractMetadata = (claim) => {
    const meta = {};
    for (const k of METADATA_KEYS) {
        if (claim[k] !== undefined) meta[k] = claim[k];
    }
    // folders without documents — checklist + completion only
    if (Array.isArray(claim.folders)) {
        meta.folders = claim.folders.map(({ documents, ...rest }) => rest);
    }
    return meta;
};

// Merges a backend process with its persisted metadata; cached localStorage entry serves as
// fallback for processes created before migration 004 (back returned no metadata).
const adaptProcessToClaim = (proc, cached) => {
    const created = proc.created_at ? new Date(proc.created_at) : new Date();
    const updated = proc.updated_at ? new Date(proc.updated_at) : created;
    const meta = (proc.metadata && Object.keys(proc.metadata).length > 0) ? proc.metadata : (cached || {});
    const isComplex = !!meta.isComplex;
    const baseFolders = Array.isArray(meta.folders) && meta.folders.length > 0
        ? meta.folders.map(f => ({ documents: [], ...f }))
        : buildFolders([]);

    return {
        // Backend-owned
        id: proc.id,
        title: proc.title,
        description: proc.description || meta.description || '',
        backStatus: proc.status,
        status: STATUS_BACK_TO_UI[proc.status] || proc.status,
        backCreatedAt: proc.created_at,
        backUpdatedAt: proc.updated_at,
        assignedTo: proc.assigned_to || null,
        backCreatedBy: proc.created_by || null,
        claimType: proc.claim_type || null,
        checklistState: meta.checklist_state || {},
        date: created.toLocaleDateString('pt-BR'),
        lastModified: updated.toLocaleDateString('pt-BR'),

        // From metadata (or cached fallback or defaults)
        number: meta.number || proc.title || proc.id.slice(0, 8),
        insurer: meta.insurer || '',
        insuredName: meta.insuredName || '',
        policyNumber: meta.policyNumber || '',
        policyStartDate: meta.policyStartDate || '',
        policyEndDate: meta.policyEndDate || '',
        retroactiveDate: meta.retroactiveDate || '',
        modality: meta.modality || '',
        brokerName: meta.brokerName || meta.broker || '',
        brokerClaimId: meta.brokerClaimId || '',
        adjusterName: meta.adjusterName || '',
        adjusterClaimId: meta.adjusterClaimId || '',
        occurrenceDate: meta.occurrenceDate || '',
        occurrenceLocation: meta.occurrenceLocation || '',
        observations: meta.observations || '',
        progress: meta.progress ?? 0,
        isComplex,
        deadline: meta.deadline || computeDeadline(proc.created_at, isComplex),
        activities: Array.isArray(meta.activities) ? meta.activities : [],
        folders: baseFolders,
        shareToken: meta.shareToken || randId(),
    };
};

export const ClaimsProvider = ({ children }) => {
    // Front-only cache keyed by backend process_id
    const [claimsCache, setClaimsCache] = useState(() => {
        try {
            const saved = localStorage.getItem('arquivoseg_claims_cache');
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    });

    const [claims, setClaims] = useState(() => {
        if (isMockEnabled()) {
            try {
                const saved = localStorage.getItem('arquivoseg_claims');
                return saved ? JSON.parse(saved) : INITIAL_CLAIMS;
            } catch { return INITIAL_CLAIMS; }
        }
        return [];
    });

    const [claimsLoading, setClaimsLoading] = useState(false);
    const [claimsError, setClaimsError] = useState(null);
    const [claimsTotal, setClaimsTotal] = useState(0);
    const [auditByClaim, setAuditByClaim] = useState({});

    // INITIAL_USERS is the *front-only* roster used by the Login screen to map
    // an email to a PAT in dev. It does not necessarily match the backend `users`
    // table (which holds the real seeded bots). When a manager+ logs in, we
    // overlay the real users on top via `backendUsers` so audit/UserManagement
    // see ground truth. This local list is never mutated at runtime.
    const users = (() => {
        try {
            const saved = localStorage.getItem('arquivoseg_users');
            return saved ? JSON.parse(saved) : INITIAL_USERS;
        } catch { return INITIAL_USERS; }
    })();
    const [usersLoading, setUsersLoading] = useState(false);
    const [backendUsers, setBackendUsers] = useState([]);

    const [clients, setClients] = useState(() => {
        if (isMockEnabled()) {
            try {
                const saved = localStorage.getItem('arquivoseg_clients');
                return saved ? JSON.parse(saved) : INITIAL_CLIENTS;
            } catch { return INITIAL_CLIENTS; }
        }
        return [];
    });
    const [clientsLoading, setClientsLoading] = useState(false);

    const [currentUser, setCurrentUser] = useState(() => {
        try {
            const auth = localStorage.getItem('arquivoseg_authenticated');
            const user = localStorage.getItem('arquivoseg_current_user');
            return auth === 'true' && user ? JSON.parse(user) : null;
        } catch { return null; }
    });

    const [settings, setSettings] = useState(() => {
        try {
            const saved = localStorage.getItem('arquivoseg_settings');
            return saved ? JSON.parse(saved) : { notificationInterval: '3h', weeklyReport: true };
        } catch { return { notificationInterval: '3h', weeklyReport: true }; }
    });

    // Persistence (mock-only data + cache + settings)
    useEffect(() => {
        if (isMockEnabled()) {
            localStorage.setItem('arquivoseg_claims', JSON.stringify(claims));
            localStorage.setItem('arquivoseg_clients', JSON.stringify(clients));
        }
        localStorage.setItem('arquivoseg_users', JSON.stringify(users));
        localStorage.setItem('arquivoseg_settings', JSON.stringify(settings));
        localStorage.setItem('arquivoseg_claims_cache', JSON.stringify(claimsCache));
        if (currentUser) {
            localStorage.setItem('arquivoseg_current_user', JSON.stringify(currentUser));
            localStorage.setItem('arquivoseg_authenticated', 'true');
        } else {
            localStorage.removeItem('arquivoseg_current_user');
            localStorage.removeItem('arquivoseg_authenticated');
        }
    }, [claims, users, clients, settings, currentUser, claimsCache]);

    // Re-establish API token on reload when session is still active
    useEffect(() => {
        if (!currentUser || getToken() || !zitadel) return;
        zitadel.userManager.getUser().then((oidcUser) => {
            if (oidcUser && !oidcUser.expired) {
                setToken(oidcUser.access_token);
            } else {
                setCurrentUser(null);
            }
        });
    }, [currentUser]);

    // Last filter passed to refreshClaims, so the auto-refetch on currentUser
    // change re-applies the user's selection (Status / Atribuído a mim).
    const [claimsFilter, setClaimsFilter] = useState({});

    // Fetch processes from backend whenever the user changes (login) OR the
    // current filter changes. Filters are pushed server-side via /processes
    // query params (status, assigned_to, page, limit).
    const refreshClaims = useCallback(async (filterOverride) => {
        if (isMockEnabled() || !currentUser || !getToken()) return;
        const opts = filterOverride !== undefined ? filterOverride : claimsFilter;
        if (filterOverride !== undefined) setClaimsFilter(filterOverride);
        setClaimsLoading(true);
        setClaimsError(null);
        try {
            const res = await claimsService.fetchAllClaims(opts);
            const procs = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            const total = typeof res?.total === 'number' ? res.total : procs.length;
            const merged = procs.map(p => adaptProcessToClaim(p, claimsCache[p.id]));
            setClaims(merged);
            setClaimsTotal(total);
        } catch (err) {
            console.error('[ClaimsContext] failed to fetch processes:', err);
            setClaimsError(err.message || 'Erro ao carregar sinistros do servidor.');
        } finally {
            setClaimsLoading(false);
        }
        // Intentionally not depending on claimsCache or claimsFilter to avoid loops.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser]);

    useEffect(() => {
        refreshClaims();
    }, [refreshClaims]);

    const logout = () => {
        logoutSession();
        setCurrentUser(null);
        localStorage.removeItem('arquivoseg_current_user');
        localStorage.removeItem('arquivoseg_authenticated');
        if (!isMockEnabled()) {
            setClaims([]);
            zitadel?.signout();
        }
    };

    const persistClaimMetadata = (claim) => {
        setClaimsCache(prev => ({ ...prev, [claim.id]: claim }));
    };

    // Debounced background sync of process metadata to the backend (PATCH /processes/:id).
    // We coalesce rapid updates (e.g. checklist clicks) into a single request per ~800ms.
    const syncTimers = useRef({});
    const scheduleMetadataSync = useCallback((claimId, claim) => {
        if (isMockEnabled() || !getToken()) return;
        if (!claimId || !claim) return;
        if (syncTimers.current[claimId]) clearTimeout(syncTimers.current[claimId]);
        syncTimers.current[claimId] = setTimeout(async () => {
            try {
                await claimsService.updateClaim(claimId, { metadata: extractMetadata(claim) });
            } catch (err) {
                console.error('[ClaimsContext] failed to sync metadata for', claimId, err);
            } finally {
                delete syncTimers.current[claimId];
            }
        }, 800);
    }, []);

    const addClaim = async (newClaim) => {
        const now = new Date();
        const title = newClaim.title || `Sinistro ${newClaim.number || ''}`.trim() || 'Novo sinistro';
        const description = newClaim.description || '';

        // Build the local claim shape first so we can derive the metadata payload.
        const draftClaim = {
            ...newClaim,
            title,
            description,
            progress: 0,
            isComplex: false,
            deadline: computeDeadline(now.toISOString(), false),
            activities: [{
                id: 'a-' + Date.now(),
                user: currentUser?.name || 'Sistema',
                action: 'criou o sinistro',
                date: now.toLocaleString('pt-BR'),
                type: 'CREATE',
            }],
            folders: buildFolders(newClaim.initialChecklist),
            shareToken: randId(),
        };

        let processId;
        let backCreatedAt = now.toISOString();
        let backStatus = 'ready';

        if (!isMockEnabled()) {
            const proc = await claimsService.createClaim({
                title,
                description,
                metadata: extractMetadata(draftClaim),
                claim_type: newClaim.claimType || null,
            });
            processId = proc.id;
            backCreatedAt = proc.created_at || backCreatedAt;
            backStatus = proc.status || backStatus;
        } else {
            processId = Date.now().toString();
        }

        const localClaim = {
            ...draftClaim,
            id: processId,
            backStatus,
            status: STATUS_BACK_TO_UI[backStatus] || backStatus,
            backCreatedAt,
            date: now.toLocaleDateString('pt-BR'),
            lastModified: now.toLocaleDateString('pt-BR'),
            deadline: computeDeadline(backCreatedAt, false),
        };

        setClaims(prev => [localClaim, ...prev]);
        persistClaimMetadata(localClaim);
        return localClaim.id;
    };

    const transitionStatus = async (claimId, nextStatus) => {
        if (isMockEnabled() || !getToken()) return;
        try {
            const proc = await claimsService.updateClaim(claimId, { status: nextStatus });
            setClaims(prev => prev.map(c => c.id === claimId
                ? { ...c, backStatus: proc.status, status: STATUS_BACK_TO_UI[proc.status] || proc.status, lastModified: new Date().toLocaleDateString('pt-BR') }
                : c));
        } catch (err) {
            alert(`Falha ao alterar status: ${err?.message || err}`);
            throw err;
        }
    };

    const archiveClaim = async (claimId) => {
        if (isMockEnabled() || !getToken()) return;
        try {
            await claimsService.archiveClaim(claimId);
            setClaims(prev => prev.map(c => c.id === claimId
                ? { ...c, backStatus: 'archived', status: STATUS_BACK_TO_UI.archived }
                : c));
        } catch (err) {
            alert(`Falha ao arquivar: ${err?.message || err}`);
            throw err;
        }
    };

    const updateClaimFields = async (claimId, patch) => {
        // Used to PATCH plain fields (title, description) directly on the
        // process row — bypasses the metadata jsonb path because these are
        // first-class columns the backend already validates.
        if (isMockEnabled() || !getToken()) return;
        try {
            const proc = await claimsService.updateClaim(claimId, patch);
            setClaims(prev => prev.map(c => c.id === claimId
                ? {
                    ...c,
                    title: proc.title ?? c.title,
                    description: proc.description ?? c.description,
                    lastModified: new Date().toLocaleDateString('pt-BR'),
                }
                : c));
        } catch (err) {
            alert(`Falha ao atualizar sinistro: ${err?.message || err}`);
            throw err;
        }
    };

    // Fallback fetch: when ClaimDetails is opened directly via URL the global
    // refreshClaims may not have finished yet (or this id isn't on the current
    // page of results). Pulls a single process and merges it into state so the
    // detail page never has to render "Sinistro não encontrado".
    const fetchSingleClaim = useCallback(async (claimId) => {
        if (isMockEnabled() || !getToken() || !claimId) return null;
        try {
            const proc = await claimsService.getClaim(claimId);
            const adapted = adaptProcessToClaim(proc, claimsCache[proc.id]);
            setClaims(prev => prev.some(c => c.id === proc.id)
                ? prev.map(c => c.id === proc.id ? adapted : c)
                : [adapted, ...prev]);
            return adapted;
        } catch (err) {
            console.error('[ClaimsContext] failed to fetch single process', claimId, err);
            return null;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const assignClaim = async (claimId, userId) => {
        if (isMockEnabled() || !getToken()) return;
        try {
            const proc = await claimsService.updateClaim(claimId, { assigned_to: userId });
            setClaims(prev => prev.map(c => c.id === claimId
                ? { ...c, assignedTo: proc.assigned_to, lastModified: new Date().toLocaleDateString('pt-BR') }
                : c));
        } catch (err) {
            alert(`Falha ao atribuir: ${err?.message || err}`);
            throw err;
        }
    };

    const updateClaimLocal = (claimId, updater, { syncToBack = true } = {}) => {
        setClaims(prev => prev.map(c => {
            if (c.id !== claimId) return c;
            const updated = updater(c);
            persistClaimMetadata(updated);
            if (syncToBack) scheduleMetadataSync(claimId, updated);
            return updated;
        }));
    };

    // Build a UI document record from a backend file_version, optionally enriched with comment metadata.
    const fileVerToDoc = (fv, comment) => {
        const { name } = parseFolderFromFileName(fv.file_name);
        const created = fv.created_at ? new Date(fv.created_at) : new Date();
        return {
            id: fv.id,
            backFileVerId: fv.id,
            backVersion: fv.version,
            backUploadedBy: fv.uploaded_by,
            name,
            mime_type: fv.mime_type,
            size_bytes: fv.size_bytes,
            date: created.toLocaleDateString('pt-BR'),
            createdAt: fv.created_at,
            user: comment?.user || '-',
            annotation: comment?.body || '',
            commentId: comment?.id || null,
            commentAuthorId: comment?.author_id || null,
            commentCreatedAt: comment?.created_at || null,
            commentUpdatedAt: comment?.updated_at || null,
            confidentiality: comment?.confidentiality || 'Geral',
        };
    };

    // Group backend files into the local folder structure by file_name prefix (causa__, prejuizo__, ...).
    // Files without a recognized prefix fall into "gerencial" (private folder).
    const groupFilesIntoFolders = (folders, files, commentByFileVerId = {}) => {
        const byCategory = { causa: [], prejuizo: [], liquidacao: [], gerencial: [] };
        for (const fv of files) {
            const { category } = parseFolderFromFileName(fv.file_name);
            const target = category && byCategory[category] !== undefined ? category : 'gerencial';
            byCategory[target].push(fileVerToDoc(fv, commentByFileVerId[fv.id]));
        }
        return folders.map(f => ({ ...f, documents: byCategory[f.category] || f.documents }));
    };

    const refreshClaimFiles = useCallback(async (claimId) => {
        if (isMockEnabled() || !getToken()) return;
        try {
            const [filesRes, commentsRes] = await Promise.all([
                claimsService.listFiles(claimId),
                claimsService.listComments(claimId).catch(() => ({ data: [] })),
            ]);
            const files = Array.isArray(filesRes?.data) ? filesRes.data : (Array.isArray(filesRes) ? filesRes : []);
            const comments = Array.isArray(commentsRes?.data) ? commentsRes.data : (Array.isArray(commentsRes) ? commentsRes : []);

            // Most recent comment per file_ver_id wins (good enough for the 5-word annotation flow).
            const commentByFileVerId = {};
            for (const c of comments) {
                if (!c.file_ver_id) continue;
                const existing = commentByFileVerId[c.file_ver_id];
                if (!existing || new Date(c.created_at) > new Date(existing.created_at)) {
                    commentByFileVerId[c.file_ver_id] = c;
                }
            }

            updateClaimLocal(
                claimId,
                c => ({ ...c, folders: groupFilesIntoFolders(c.folders, files, commentByFileVerId) }),
                { syncToBack: false } // documents aren't part of metadata; nothing to PATCH
            );
        } catch (err) {
            console.error('[ClaimsContext] failed to fetch files for', claimId, err);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const uploadFileToClaim = async (claimId, folderCategory, file, meta = {}) => {
        if (!file) return null;

        if (isMockEnabled()) {
            const docData = { name: file.name, annotation: meta.annotation || '', confidentiality: meta.confidentiality || 'Geral', user: currentUser?.name || 'Sistema' };
            updateClaimLocal(claimId, c => {
                const folder = c.folders.find(f => f.category === folderCategory) || c.folders[0];
                const folders = c.folders.map(f => f.id === folder.id ? { ...f, documents: [{ id: Date.now().toString(), ...docData, date: new Date().toLocaleDateString('pt-BR') }, ...f.documents] } : f);
                const activity = { id: Date.now().toString(), user: docData.user, action: `enviou o documento "${docData.name}"`, date: new Date().toLocaleString('pt-BR'), type: 'UPLOAD' };
                return { ...c, folders, activities: [activity, ...c.activities], lastModified: new Date().toLocaleDateString('pt-BR') };
            });
            return { id: Date.now().toString(), file_name: `${folderCategory}/${file.name}` };
        }

        const fileVer = await claimsService.uploadDocument(claimId, folderCategory, file);
        if (meta.annotation && fileVer?.id) {
            try {
                await claimsService.addComment(claimId, meta.annotation, fileVer.id);
            } catch (err) {
                console.error('[ClaimsContext] failed to attach comment after upload:', err);
            }
        }
        await refreshClaimFiles(claimId);
        updateClaimLocal(claimId, c => ({
            ...c,
            activities: [{ id: Date.now().toString(), user: currentUser?.name || 'Sistema', action: `enviou o documento "${file.name}"`, date: new Date().toLocaleString('pt-BR'), type: 'UPLOAD' }, ...c.activities],
            lastModified: new Date().toLocaleDateString('pt-BR'),
        }));
        return fileVer;
    };

    const addCommentToClaim = async (claimId, body) => {
        if (isMockEnabled()) {
            updateClaimLocal(claimId, c => ({
                ...c,
                activities: [{ id: Date.now().toString(), user: currentUser?.name || 'Sistema', action: `registrou observação`, date: new Date().toLocaleString('pt-BR'), type: 'COMMENT' }, ...c.activities],
            }));
            return;
        }
        if (!getToken()) return;
        await claimsService.addComment(claimId, body);
        updateClaimLocal(claimId, c => ({
            ...c,
            activities: [{ id: Date.now().toString(), user: currentUser?.name || 'Sistema', action: `registrou observação`, date: new Date().toLocaleString('pt-BR'), type: 'COMMENT' }, ...c.activities],
        }));
    };

    const documentDownloadHref = (fileId) => claimsService.downloadHref(fileId);

    const updateAnnotation = async (claimId, commentId, body) => {
        if (isMockEnabled() || !getToken() || !commentId) return;
        try {
            await claimsService.updateComment(commentId, body);
            await refreshClaimFiles(claimId);
        } catch (err) {
            alert(`Falha ao editar anotação: ${err?.message || err}`);
            throw err;
        }
    };

    const deleteAnnotation = async (claimId, commentId) => {
        if (isMockEnabled() || !getToken() || !commentId) return;
        try {
            await claimsService.deleteComment(commentId);
            await refreshClaimFiles(claimId);
        } catch (err) {
            alert(`Falha ao remover anotação: ${err?.message || err}`);
            throw err;
        }
    };

    const deleteDocument = async (claimId, fileVerId) => {
        if (isMockEnabled() || !getToken()) return;
        try {
            await claimsService.deleteDocument(fileVerId);
            await refreshClaimFiles(claimId);
        } catch (err) {
            alert(`Falha ao excluir documento: ${err?.message || err}`);
            throw err;
        }
    };

    const listFileVersions = useCallback(async (fileVerId) => {
        if (isMockEnabled() || !getToken() || !fileVerId) return [];
        try {
            const res = await claimsService.listFileVersions(fileVerId);
            return Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        } catch (err) {
            console.error('[ClaimsContext] failed to list versions for', fileVerId, err);
            return [];
        }
    }, []);

    const listFileShares = useCallback(async (fileVerId) => {
        if (isMockEnabled() || !getToken() || !fileVerId) return [];
        try {
            const res = await claimsService.listShares(fileVerId);
            return Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        } catch (err) {
            if (err?.status === 403) return [];
            console.error('[ClaimsContext] failed to list shares for', fileVerId, err);
            return [];
        }
    }, []);

    const createFileShare = useCallback(async (fileVerId, opts) => {
        if (isMockEnabled() || !getToken()) return null;
        return claimsService.createShare(fileVerId, opts);
    }, []);

    const revokeFileShare = useCallback(async (tokenId) => {
        if (isMockEnabled() || !getToken()) return null;
        return claimsService.revokeShare(tokenId);
    }, []);

    const countShareAccesses = useCallback(async (tokenId) => {
        if (isMockEnabled() || !getToken() || !tokenId) return 0;
        try {
            const res = await claimsService.listAuditByShareToken(tokenId);
            const entries = Array.isArray(res?.data) ? res.data : [];
            return entries.filter(e => e.action === 'share.accessed').length;
        } catch {
            return 0;
        }
    }, []);

    const fetchAudit = useCallback(async (claimId) => {
        if (!claimId) return [];
        if (isMockEnabled() || !getToken()) return [];
        try {
            const res = await claimsService.listAudit(claimId);
            const entries = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            setAuditByClaim(prev => ({ ...prev, [claimId]: entries }));
            return entries;
        } catch (err) {
            // 403 is expected for viewer/contributor — surface empty list.
            if (err?.status === 403) {
                setAuditByClaim(prev => ({ ...prev, [claimId]: null }));
                return null;
            }
            console.error('[ClaimsContext] failed to fetch audit for', claimId, err);
            return [];
        }
    }, []);

    const updateChecklistStatus = (claimId, folderId, itemId, received) => {
        updateClaimLocal(claimId, c => {
            const folders = c.folders.map(f => {
                if (f.id !== folderId) return f;
                const checklist = f.checklist.map(i => i.id === itemId ? { ...i, received } : i);
                const completion = checklist.length > 0 ? Math.round((checklist.filter(i => i.received).length / checklist.length) * 100) : 0;
                return { ...f, checklist, completion };
            });
            const totalComp = folders.reduce((acc, f) => acc + f.completion, 0);
            return { ...c, folders, progress: Math.round(totalComp / folders.length) };
        });
    };

    const logView = (claimId, docName) => {
        // Server-side audit (ActionFileDownloaded) já registra acesso real;
        // este log local alimenta a timeline visível na sidebar de quem é viewer
        // (que não tem permissão pra GET /audit).
        claimsService.logDocumentView?.(claimId, docName, currentUser?.name || 'Visitante');
        updateClaimLocal(claimId, c => ({
            ...c,
            activities: [{ id: Date.now().toString(), user: currentUser?.name || 'Visitante', action: `visualizou "${docName}"`, date: new Date().toLocaleString('pt-BR'), type: 'VIEW' }, ...c.activities],
        }));
    };

    const toggleDeadline = (claimId, reason) => {
        updateClaimLocal(claimId, c => {
            const isSuspended = !c.deadline.isSuspended;
            const entry = { date: new Date().toLocaleDateString('pt-BR'), action: isSuspended ? `Suspensão: ${reason}` : 'Retomada.' };
            return { ...c, deadline: { ...c.deadline, isSuspended, suspensionCount: isSuspended ? c.deadline.suspensionCount + 1 : c.deadline.suspensionCount, history: [entry, ...c.deadline.history] } };
        });
    };

    const setComplexStatus = (id, isComplex) => updateClaimLocal(id, c => ({ ...c, isComplex, deadline: { ...c.deadline, totalDays: isComplex ? 120 : 30 } }));

    const updateClaimObservations = (id, observations) => updateClaimLocal(id, c => ({ ...c, observations }));

    const refreshUsers = useCallback(async () => {
        if (isMockEnabled() || !getToken()) return;
        // GET /users requires manager+; gracefully degrade for viewer/contributor.
        if (currentUser?.backRole !== 'manager' && currentUser?.backRole !== 'admin') return;
        setUsersLoading(true);
        try {
            const res = await claimsService.listUsers();
            const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            setBackendUsers(data);
        } catch (err) {
            if (err?.status !== 403) console.error('[ClaimsContext] failed to fetch users:', err);
        } finally {
            setUsersLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        if (currentUser) refreshUsers();
    }, [currentUser, refreshUsers]);

    // UUID → friendly label (used by audit panel). Prefers the live `users` list
    // (manager+ only) and falls back to the static .env.local mapping.
    const resolveActorLabel = useCallback((dbId) => {
        if (!dbId) return null;
        const hit = backendUsers.find(u => u.id === dbId);
        if (hit) return hit.email || hit.role.toUpperCase();
        return null;
    }, [backendUsers]);

    const refreshClients = useCallback(async () => {
        if (isMockEnabled() || !getToken()) return;
        setClientsLoading(true);
        try {
            const res = await claimsService.listClients();
            const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            setClients(data);
        } catch (err) {
            console.error('[ClaimsContext] failed to fetch clients:', err);
        } finally {
            setClientsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (currentUser) refreshClients();
    }, [currentUser, refreshClients]);

    const addClientEntity = async (clientData) => {
        if (isMockEnabled()) {
            const newClient = { id: 'c-' + Date.now(), ...clientData };
            setClients(prev => [newClient, ...prev]);
            return newClient;
        }
        const created = await claimsService.createClient(clientData);
        setClients(prev => [created, ...prev]);
        return created;
    };

    const updateClientEntity = async (id, patch) => {
        if (isMockEnabled()) {
            setClients(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
            return;
        }
        const updated = await claimsService.updateClient(id, patch);
        setClients(prev => prev.map(c => c.id === id ? updated : c));
    };

    const deleteClientEntity = async (id) => {
        if (isMockEnabled()) {
            setClients(prev => prev.filter(c => c.id !== id));
            return;
        }
        await claimsService.deleteClient(id);
        setClients(prev => prev.filter(c => c.id !== id));
    };

    const inviteUserAction = async (data) => {
        const created = await claimsService.inviteUser(data);
        await refreshUsers();
        return created;
    };

    const updateUserRoleAction = async (id, role) => {
        await claimsService.updateUserRole(id, role);
        await refreshUsers();
    };

    const deactivateUserAction = async (id) => {
        await claimsService.deactivateUser(id);
        await refreshUsers();
    };

    const resendInviteAction = async (id) => {
        return claimsService.resendInvite(id);
    };

    const updateSettings = (newSettings) => setSettings(newSettings);

    const isGuestVerified = (token) => sessionStorage.getItem(`verified_guest_${token}`) === 'true';

    return (
        <ClaimsContext.Provider value={{
            currentUser, setCurrentUser, logout,
            claims, addClaim, updateChecklistStatus,
            transitionStatus, archiveClaim, assignClaim, updateClaimFields, fetchSingleClaim,
            toggleDeadline, logView, setComplexStatus, updateClaimObservations,
            uploadFileToClaim, addCommentToClaim, refreshClaimFiles, documentDownloadHref,
            deleteDocument, listFileVersions,
            updateAnnotation, deleteAnnotation,
            listFileShares, createFileShare, revokeFileShare, countShareAccesses,
            fetchAudit, auditByClaim,
            claimsLoading, claimsError, claimsTotal, refreshClaims, claimsFilter,
            users,
            backendUsers, usersLoading, refreshUsers, resolveActorLabel,
            inviteUser: inviteUserAction, updateUserRole: updateUserRoleAction,
            deactivateUser: deactivateUserAction, resendInvite: resendInviteAction,
            clients, clientsLoading, addClientEntity, updateClientEntity, deleteClientEntity, refreshClients,
            settings, updateSettings,
            isGuestVerified,
        }}>
            {children}
        </ClaimsContext.Provider>
    );
};

export const useClaims = () => useContext(ClaimsContext);

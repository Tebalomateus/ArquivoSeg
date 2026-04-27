import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { INITIAL_CLAIMS, INITIAL_USERS, INITIAL_CLIENTS, INITIAL_LINKS } from '../constants/initialData';
import { claimsService } from '../services/claimsService';
import { loginWithUiRole, logoutSession } from '../api/auth';
import { getToken, isMockEnabled } from '../api/client';
import { parseFolderFromFileName } from '../api/files';

const ClaimsContext = createContext();

const STATUS_BACK_TO_UI = {
    ready: 'Aberto',
    ongoing: 'Em Análise',
    review: 'Em Revisão',
    done: 'Concluído',
    archived: 'Arquivado',
};

const buildFolders = (initialChecklist) => [
    { id: 'f1-' + Date.now(), name: 'Causa', category: 'causa', completion: 0, documents: [], checklist: (initialChecklist || []).filter(i => i.folder === 'Causa').map(i => ({ ...i, id: Math.random().toString(36).substr(2, 9), received: false })) },
    { id: 'f2-' + Date.now(), name: 'Prejuízo', category: 'prejuizo', completion: 0, documents: [], checklist: (initialChecklist || []).filter(i => i.folder === 'Prejuízo').map(i => ({ ...i, id: Math.random().toString(36).substr(2, 9), received: false })) },
    { id: 'f3-' + Date.now(), name: 'Liquidação', category: 'liquidacao', completion: 0, documents: [], checklist: (initialChecklist || []).filter(i => i.folder === 'Liquidação').map(i => ({ ...i, id: Math.random().toString(36).substr(2, 9), received: false })) },
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

// Merges a backend process with cached front-only metadata (insurer, folders, checklist, etc.).
const adaptProcessToClaim = (proc, cached) => {
    const created = proc.created_at ? new Date(proc.created_at) : new Date();
    const updated = proc.updated_at ? new Date(proc.updated_at) : created;
    const baseFolders = cached?.folders || buildFolders([]);
    const isComplex = cached?.isComplex || false;

    return {
        // Backend-owned
        id: proc.id,
        title: proc.title,
        description: proc.description || cached?.description || '',
        backStatus: proc.status,
        status: STATUS_BACK_TO_UI[proc.status] || proc.status,
        backCreatedAt: proc.created_at,
        backUpdatedAt: proc.updated_at,
        date: created.toLocaleDateString('pt-BR'),
        lastModified: updated.toLocaleDateString('pt-BR'),

        // Front-only metadata (cached or defaulted)
        number: cached?.number || proc.title || proc.id.slice(0, 8),
        insurer: cached?.insurer || '',
        insuredName: cached?.insuredName || '',
        policyNumber: cached?.policyNumber || '',
        policyStartDate: cached?.policyStartDate || '',
        policyEndDate: cached?.policyEndDate || '',
        retroactiveDate: cached?.retroactiveDate || '',
        modality: cached?.modality || '',
        brokerName: cached?.brokerName || cached?.broker || '',
        brokerClaimId: cached?.brokerClaimId || '',
        adjusterName: cached?.adjusterName || '',
        adjusterClaimId: cached?.adjusterClaimId || '',
        occurrenceDate: cached?.occurrenceDate || '',
        occurrenceLocation: cached?.occurrenceLocation || '',
        observations: cached?.observations || '',
        progress: cached?.progress ?? 0,
        isComplex,
        deadline: cached?.deadline || computeDeadline(proc.created_at, isComplex),
        activities: cached?.activities || [],
        folders: baseFolders,
        shareToken: cached?.shareToken || Math.random().toString(36).substr(2, 9),
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

    const [users, setUsers] = useState(() => {
        try {
            const saved = localStorage.getItem('arquivoseg_users');
            return saved ? JSON.parse(saved) : INITIAL_USERS;
        } catch { return INITIAL_USERS; }
    });

    const [clients, setClients] = useState(() => {
        try {
            const saved = localStorage.getItem('arquivoseg_clients');
            return saved ? JSON.parse(saved) : INITIAL_CLIENTS;
        } catch { return INITIAL_CLIENTS; }
    });

    const [links, setLinks] = useState(() => {
        try {
            const saved = localStorage.getItem('arquivoseg_links');
            return saved ? JSON.parse(saved) : INITIAL_LINKS;
        } catch { return INITIAL_LINKS; }
    });

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
        }
        localStorage.setItem('arquivoseg_users', JSON.stringify(users));
        localStorage.setItem('arquivoseg_clients', JSON.stringify(clients));
        localStorage.setItem('arquivoseg_links', JSON.stringify(links));
        localStorage.setItem('arquivoseg_settings', JSON.stringify(settings));
        localStorage.setItem('arquivoseg_claims_cache', JSON.stringify(claimsCache));
        if (currentUser) {
            localStorage.setItem('arquivoseg_current_user', JSON.stringify(currentUser));
            localStorage.setItem('arquivoseg_authenticated', 'true');
        } else {
            localStorage.removeItem('arquivoseg_current_user');
            localStorage.removeItem('arquivoseg_authenticated');
        }
    }, [claims, users, clients, links, settings, currentUser, claimsCache]);

    // Re-establish API token on reload when session is still active
    useEffect(() => {
        if (currentUser && !getToken()) {
            loginWithUiRole(currentUser.role);
        }
    }, [currentUser]);

    // Fetch processes from backend whenever the user changes (login).
    const refreshClaims = useCallback(async () => {
        if (isMockEnabled() || !currentUser || !getToken()) return;
        setClaimsLoading(true);
        setClaimsError(null);
        try {
            const res = await claimsService.fetchAllClaims();
            const procs = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            const merged = procs.map(p => adaptProcessToClaim(p, claimsCache[p.id]));
            setClaims(merged);
        } catch (err) {
            console.error('[ClaimsContext] failed to fetch processes:', err);
            setClaimsError(err.message || 'Erro ao carregar sinistros do servidor.');
        } finally {
            setClaimsLoading(false);
        }
        // We intentionally do NOT depend on claimsCache to avoid refetch loops; cache merges reuse latest snapshot.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser]);

    useEffect(() => {
        refreshClaims();
    }, [refreshClaims]);

    const logout = () => {
        logoutSession();
        setCurrentUser(null);
        if (!isMockEnabled()) setClaims([]);
    };

    const persistClaimMetadata = (claim) => {
        setClaimsCache(prev => ({ ...prev, [claim.id]: claim }));
    };

    const addClaim = async (newClaim) => {
        const now = new Date();
        const title = newClaim.title || `Sinistro ${newClaim.number || ''}`.trim() || 'Novo sinistro';
        const description = newClaim.description || '';

        let processId;
        let backCreatedAt = now.toISOString();
        let backStatus = 'ready';

        if (!isMockEnabled()) {
            const proc = await claimsService.createClaim({ title, description });
            processId = proc.id;
            backCreatedAt = proc.created_at || backCreatedAt;
            backStatus = proc.status || backStatus;
        } else {
            processId = Date.now().toString();
        }

        const localClaim = {
            ...newClaim,
            id: processId,
            title,
            description,
            backStatus,
            status: STATUS_BACK_TO_UI[backStatus] || backStatus,
            backCreatedAt,
            date: now.toLocaleDateString('pt-BR'),
            lastModified: now.toLocaleDateString('pt-BR'),
            progress: 0,
            isComplex: false,
            deadline: computeDeadline(backCreatedAt, false),
            activities: [{
                id: 'a-' + Date.now(),
                user: currentUser?.name || 'Sistema',
                action: 'criou o sinistro',
                date: now.toLocaleString('pt-BR'),
                type: 'CREATE',
            }],
            folders: buildFolders(newClaim.initialChecklist),
            shareToken: Math.random().toString(36).substr(2, 9),
        };

        const newLink = {
            id: 'l-' + Date.now(),
            token: localClaim.shareToken,
            claimNumber: localClaim.number,
            createdBy: currentUser?.name || 'Sistema',
            createdAt: now.toLocaleDateString('pt-BR'),
            views: 0,
            status: 'Ativo',
        };

        setLinks(prev => [newLink, ...prev]);
        setClaims(prev => [localClaim, ...prev]);
        persistClaimMetadata(localClaim);
        return localClaim.id;
    };

    const updateClaimLocal = (claimId, updater) => {
        setClaims(prev => prev.map(c => {
            if (c.id !== claimId) return c;
            const updated = updater(c);
            persistClaimMetadata(updated);
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
            name,
            mime_type: fv.mime_type,
            size_bytes: fv.size_bytes,
            date: created.toLocaleDateString('pt-BR'),
            user: comment?.user || '-',
            annotation: comment?.body || '',
            confidentiality: comment?.confidentiality || 'Geral',
        };
    };

    // Group backend files into the local folder structure by file_name prefix (causa__, prejuizo__, ...).
    // Files without a recognized prefix fall into "gerencial" (private folder).
    const groupFilesIntoFolders = (folders, files) => {
        const byCategory = { causa: [], prejuizo: [], liquidacao: [], gerencial: [] };
        for (const fv of files) {
            const { category } = parseFolderFromFileName(fv.file_name);
            const target = category && byCategory[category] !== undefined ? category : 'gerencial';
            byCategory[target].push(fileVerToDoc(fv));
        }
        return folders.map(f => ({ ...f, documents: byCategory[f.category] || f.documents }));
    };

    const refreshClaimFiles = useCallback(async (claimId) => {
        if (isMockEnabled() || !getToken()) return;
        try {
            const res = await claimsService.listFiles(claimId);
            const files = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            updateClaimLocal(claimId, c => ({ ...c, folders: groupFilesIntoFolders(c.folders, files) }));
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

    // Backwards-compatible: addDocument is now a thin wrapper that ClaimDetails can keep using
    // for purely-local document additions. For real uploads, prefer uploadFileToClaim.
    const addDocument = (claimId, folderId, docData) => {
        updateClaimLocal(claimId, c => {
            const folders = c.folders.map(f => f.id === folderId ? { ...f, documents: [{ id: Date.now().toString(), ...docData, date: new Date().toLocaleDateString('pt-BR') }, ...f.documents] } : f);
            const activity = { id: Date.now().toString(), user: currentUser?.name || docData.user, action: `enviou o documento "${docData.name}"`, date: new Date().toLocaleString('pt-BR'), type: 'UPLOAD' };
            return { ...c, folders, activities: [activity, ...c.activities], lastModified: new Date().toLocaleDateString('pt-BR') };
        });
    };

    const documentDownloadHref = (fileId) => claimsService.downloadHref(fileId);

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

    const logView = (claimId, docName, token) => {
        claimsService.logDocumentView?.(claimId, docName, currentUser?.name || 'Visitante');
        updateClaimLocal(claimId, c => ({
            ...c,
            activities: [{ id: Date.now().toString(), user: currentUser?.name || 'Visitante', action: `visualizou "${docName}"`, date: new Date().toLocaleString('pt-BR'), type: 'VIEW' }, ...c.activities],
        }));
        if (token) {
            setLinks(prev => prev.map(l => l.token === token ? { ...l, views: l.views + 1, lastAccessed: new Date().toLocaleString('pt-BR') } : l));
        }
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

    const addUser = (userData) => setUsers(prev => [{ id: Date.now(), status: 'Ativo', ...userData }, ...prev]);
    const addClientEntity = (clientData) => setClients(prev => [{ id: 'c-' + Date.now(), ...clientData }, ...prev]);
    const updateSettings = (newSettings) => setSettings(newSettings);

    const isGuestVerified = (token) => sessionStorage.getItem(`verified_guest_${token}`) === 'true';

    return (
        <ClaimsContext.Provider value={{
            currentUser, setCurrentUser, logout,
            claims, addClaim, addDocument, updateChecklistStatus,
            toggleDeadline, logView, setComplexStatus, updateClaimObservations,
            uploadFileToClaim, refreshClaimFiles, documentDownloadHref,
            claimsLoading, claimsError, refreshClaims,
            users, addUser,
            clients, addClientEntity,
            links, setLinks,
            settings, updateSettings,
            isGuestVerified,
        }}>
            {children}
        </ClaimsContext.Provider>
    );
};

export const useClaims = () => useContext(ClaimsContext);

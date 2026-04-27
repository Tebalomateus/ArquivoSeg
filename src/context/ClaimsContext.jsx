import React, { createContext, useContext, useState, useEffect } from 'react';
import { INITIAL_CLAIMS, INITIAL_USERS, INITIAL_CLIENTS, INITIAL_LINKS } from '../constants/initialData';
import { claimsService } from '../services/claimsService';
import { loginWithUiRole, logoutSession } from '../api/auth';
import { getToken } from '../api/client';

const ClaimsContext = createContext();

export const ClaimsProvider = ({ children }) => {
    // STATE: Claims (Sinistros)
    const [claims, setClaims] = useState(() => {
        try {
            const saved = localStorage.getItem('arquivoseg_claims');
            return saved ? JSON.parse(saved) : INITIAL_CLAIMS;
        } catch (e) {
            console.error("Error loading claims:", e);
            return INITIAL_CLAIMS;
        }
    });

    // STATE: Users
    const [users, setUsers] = useState(() => {
        try {
            const saved = localStorage.getItem('arquivoseg_users');
            return saved ? JSON.parse(saved) : INITIAL_USERS;
        } catch (e) {
            return INITIAL_USERS;
        }
    });

    // STATE: Clients (Entities like Insurers/Brokers)
    const [clients, setClients] = useState(() => {
        try {
            const saved = localStorage.getItem('arquivoseg_clients');
            return saved ? JSON.parse(saved) : INITIAL_CLIENTS;
        } catch (e) {
            return INITIAL_CLIENTS;
        }
    });

    // STATE: Links (Tracking for shared portals)
    const [links, setLinks] = useState(() => {
        try {
            const saved = localStorage.getItem('arquivoseg_links');
            return saved ? JSON.parse(saved) : INITIAL_LINKS;
        } catch (e) {
            return INITIAL_LINKS;
        }
    });

    // STATE: Session/Auth
    const [currentUser, setCurrentUser] = useState(() => {
        try {
            const auth = localStorage.getItem('arquivoseg_authenticated');
            const user = localStorage.getItem('arquivoseg_current_user');
            return auth === 'true' && user ? JSON.parse(user) : null;
        } catch (e) {
            return null;
        }
    });

    const [settings, setSettings] = useState(() => {
        try {
            const saved = localStorage.getItem('arquivoseg_settings');
            return saved ? JSON.parse(saved) : { notificationInterval: '3h', weeklyReport: true };
        } catch (e) {
            return { notificationInterval: '3h', weeklyReport: true };
        }
    });

    // Persistence
    useEffect(() => {
        localStorage.setItem('arquivoseg_claims', JSON.stringify(claims));
        localStorage.setItem('arquivoseg_users', JSON.stringify(users));
        localStorage.setItem('arquivoseg_clients', JSON.stringify(clients));
        localStorage.setItem('arquivoseg_links', JSON.stringify(links));
        localStorage.setItem('arquivoseg_settings', JSON.stringify(settings));
        if (currentUser) {
            localStorage.setItem('arquivoseg_current_user', JSON.stringify(currentUser));
            localStorage.setItem('arquivoseg_authenticated', 'true');
        } else {
            localStorage.removeItem('arquivoseg_current_user');
            localStorage.removeItem('arquivoseg_authenticated');
        }
    }, [claims, users, clients, links, settings, currentUser]);

    // Re-establish API token on reload when session is still active
    useEffect(() => {
        if (currentUser && !getToken()) {
            loginWithUiRole(currentUser.role);
        }
    }, [currentUser]);

    const logout = () => {
        logoutSession();
        setCurrentUser(null);
    };

    const addClaim = async (newClaim) => {
        const now = new Date();
        const claimWithDefaults = {
            ...newClaim,
            id: Date.now().toString(),
            status: 'Aberto',
            progress: 0,
            date: now.toLocaleDateString('pt-BR'),
            lastModified: now.toLocaleDateString('pt-BR'),
            deadline: {
                totalDays: 30, remainingDays: 30, isSuspended: false, suspensionCount: 0,
                lastUpdated: Date.now(),
                history: [{ date: now.toLocaleDateString('pt-BR'), action: 'Início do prazo legal.' }]
            },
            activities: [{ id: 'a1', user: currentUser?.name || 'Sistema', action: 'criou o sinistro', date: now.toLocaleString('pt-BR'), type: 'CREATE' }],
            folders: [
                { id: 'f1-' + Date.now(), name: 'Causa', category: 'causa', completion: 0, documents: [], checklist: newClaim.initialChecklist?.filter(i => i.folder === 'Causa').map(i => ({ ...i, id: Math.random().toString(36).substr(2, 9), received: false })) || [] },
                { id: 'f2-' + Date.now(), name: 'Prejuízo', category: 'prejuizo', completion: 0, documents: [], checklist: newClaim.initialChecklist?.filter(i => i.folder === 'Prejuízo').map(i => ({ ...i, id: Math.random().toString(36).substr(2, 9), received: false })) || [] },
                { id: 'f3-' + Date.now(), name: 'Liquidação', category: 'liquidacao', completion: 0, documents: [], checklist: newClaim.initialChecklist?.filter(i => i.folder === 'Liquidação').map(i => ({ ...i, id: Math.random().toString(36).substr(2, 9), received: false })) || [] },
                { id: 'f4-' + Date.now(), name: 'Gerencial', category: 'gerencial', completion: 0, private: true, documents: [], checklist: [] },
            ],
            shareToken: Math.random().toString(36).substr(2, 9),
        };

        // Automaticamente registra o link de compartilhamento inicial
        const newLink = {
            id: 'l-' + Date.now(),
            token: claimWithDefaults.shareToken,
            claimNumber: claimWithDefaults.number,
            createdBy: currentUser?.name || 'Sistema',
            createdAt: now.toLocaleDateString('pt-BR'),
            views: 0,
            status: 'Ativo'
        };

        setLinks(prev => [newLink, ...prev]);
        setClaims([claimWithDefaults, ...claims]);
        return claimWithDefaults.id;
    };

    const addDocument = (claimId, folderId, docData) => {
        setClaims(prev => prev.map(c => {
            if (c.id === claimId) {
                const folders = c.folders.map(f => f.id === folderId ? { ...f, documents: [{ id: Date.now().toString(), ...docData, date: new Date().toLocaleDateString('pt-BR') }, ...f.documents] } : f);
                const activity = { id: Date.now().toString(), user: currentUser?.name || docData.user, action: `enviou o documento "${docData.name}"`, date: new Date().toLocaleString('pt-BR'), type: 'UPLOAD' };
                return { ...c, folders, activities: [activity, ...c.activities], lastModified: new Date().toLocaleDateString('pt-BR') };
            }
            return c;
        }));
    };

    const updateChecklistStatus = (claimId, folderId, itemId, received) => {
        setClaims(prev => prev.map(c => {
            if (c.id === claimId) {
                const folders = c.folders.map(f => {
                    if (f.id === folderId) {
                        const checklist = f.checklist.map(i => i.id === itemId ? { ...i, received } : i);
                        const completion = checklist.length > 0 ? Math.round((checklist.filter(i => i.received).length / checklist.length) * 100) : 0;
                        return { ...f, checklist, completion };
                    }
                    return f;
                });
                const totalComp = folders.reduce((acc, f) => acc + f.completion, 0);
                return { ...c, folders, progress: Math.round(totalComp / folders.length) };
            }
            return c;
        }));
    };

    const logView = (claimId, docName, token) => {
        claimsService.logDocumentView(claimId, docName, currentUser?.name || 'Visitante');

        // Update claim activities
        setClaims(prev => prev.map(c => c.id === claimId ? {
            ...c,
            activities: [{ id: Date.now().toString(), user: currentUser?.name || 'Visitante', action: `visualizou "${docName}"`, date: new Date().toLocaleString('pt-BR'), type: 'VIEW' }, ...c.activities]
        } : c));

        // Update link view count if accessed via token
        if (token) {
            setLinks(prev => prev.map(l => l.token === token ? { ...l, views: l.views + 1, lastAccessed: new Date().toLocaleString('pt-BR') } : l));
        }
    };

    const toggleDeadline = (claimId, reason) => {
        setClaims(prev => prev.map(c => {
            if (c.id === claimId) {
                const isSuspended = !c.deadline.isSuspended;
                const entry = { date: new Date().toLocaleDateString('pt-BR'), action: isSuspended ? `Suspensão: ${reason}` : 'Retomada.' };
                return { ...c, deadline: { ...c.deadline, isSuspended, suspensionCount: isSuspended ? c.deadline.suspensionCount + 1 : c.deadline.suspensionCount, history: [entry, ...c.deadline.history] } };
            }
            return c;
        }));
    };

    const setComplexStatus = (id, isComplex) => setClaims(prev => prev.map(c => c.id === id ? { ...c, isComplex, deadline: { ...c.deadline, totalDays: isComplex ? 120 : 30 } } : c));
    const addUser = (userData) => setUsers(prev => [{ id: Date.now(), status: 'Ativo', ...userData }, ...prev]);
    const addClientEntity = (clientData) => setClients(prev => [{ id: 'c-' + Date.now(), ...clientData }, ...prev]);
    const updateSettings = (newSettings) => setSettings(newSettings);

    const isGuestVerified = (token) => {
        const verified = sessionStorage.getItem(`verified_guest_${token}`);
        return verified === 'true';
    };

    return (
        <ClaimsContext.Provider value={{
            currentUser, setCurrentUser, logout,
            claims, addClaim, addDocument, updateChecklistStatus,
            toggleDeadline, logView, setComplexStatus,
            users, addUser,
            clients, addClientEntity,
            links, setLinks,
            settings, updateSettings,
            isGuestVerified
        }}>
            {children}
        </ClaimsContext.Provider>
    );
};

export const useClaims = () => useContext(ClaimsContext);

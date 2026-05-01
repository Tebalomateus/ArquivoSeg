import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, ChevronRight } from 'lucide-react';
import { useClaims } from '../context/ClaimsContext';
import { listAudit, ACTION_LABELS } from '../api/audit';

const LAST_SEEN_KEY = 'arquivoseg_notifications_last_seen';
const RELEVANT_ACTIONS = new Set([
    'process.created',
    'process.updated',
    'process.status_changed',
    'process.deleted',
    'file.uploaded',
    'file.deleted',
    'comment.created',
    'comment.updated',
    'share.created',
    'share.accessed',
    'share.revoked',
    'access.denied',
]);

// Generates a notification list from raw audit entries — filters out the
// current user's own actions, keeps only events relevant to the user's
// claims (when contributor) or all tenant events (when manager+).
function buildNotifications({ entries, currentUser, claims, backendUsers }) {
    // currentUser doesn't carry a dbId directly; resolve it by matching email
    // against the backendUsers list (only available for manager+).
    const me = backendUsers.find((u) => u.email?.toLowerCase() === currentUser?.email?.toLowerCase())?.id;
    const myClaimIds = new Set(
        claims
            .filter((c) => c.assignedTo === me || c.backCreatedBy === me)
            .map((c) => c.id)
    );

    const isManagerPlus = currentUser?.backRole === 'manager' || currentUser?.backRole === 'admin';

    const findClaim = (id) => claims.find((c) => c.id === id);
    const labelFor = (uuid) => backendUsers.find((u) => u.id === uuid)?.email || 'Usuário';

    return entries
        .filter((e) => RELEVANT_ACTIONS.has(e.action))
        .filter((e) => e.actor_user_id !== me)
        .filter((e) => {
            if (isManagerPlus) return true;
            if (e.resource_type === 'process') return myClaimIds.has(e.resource_id);
            return false;
        })
        .map((e) => {
            const claim = e.resource_type === 'process' ? findClaim(e.resource_id) : null;
            const actor = labelFor(e.actor_user_id);
            const action = ACTION_LABELS[e.action] || e.action;
            return {
                id: e.id,
                timestamp: e.timestamp,
                action,
                actor,
                resourceType: e.resource_type,
                resourceId: e.resource_id,
                navigateTo: claim ? `sinistros/${claim.id}` : null,
                claimTitle: claim?.title || claim?.number,
                summary: claim ? `${actor} · ${action} em ${claim.title || claim.number}` : `${actor} · ${action}`,
                ip: e.ip_address,
                isAlert: e.action === 'access.denied',
            };
        })
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export default function NotificationBell({ basePath = '/app' }) {
    const { currentUser, claims, backendUsers } = useClaims();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lastSeen, setLastSeen] = useState(() => {
        try { return localStorage.getItem(LAST_SEEN_KEY) || null; } catch { return null; }
    });
    const ref = useRef(null);

    const load = useCallback(async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const res = await listAudit({ from: since, limit: 200 });
            const data = Array.isArray(res?.data) ? res.data : [];
            setEntries(data);
        } catch {
            // viewer/contributor get 403 from /audit — render gracefully empty
            setEntries([]);
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        load();
        const t = setInterval(load, 60 * 1000);
        return () => clearInterval(t);
    }, [load]);

    // close dropdown on outside click
    useEffect(() => {
        if (!open) return;
        const onClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [open]);

    const notifications = useMemo(
        () => buildNotifications({ entries, currentUser, claims, backendUsers }),
        [entries, currentUser, claims, backendUsers]
    );

    const unreadCount = useMemo(() => {
        if (!notifications.length) return 0;
        if (!lastSeen) return notifications.length;
        const cutoff = new Date(lastSeen).getTime();
        return notifications.filter((n) => new Date(n.timestamp).getTime() > cutoff).length;
    }, [notifications, lastSeen]);

    const markAllRead = () => {
        const now = new Date().toISOString();
        setLastSeen(now);
        try { localStorage.setItem(LAST_SEEN_KEY, now); } catch { /* noop */ }
    };

    const goTo = (n) => {
        markAllRead();
        setOpen(false);
        if (n.navigateTo) navigate(`${basePath}/${n.navigateTo}`);
    };

    const goToCenter = () => {
        markAllRead();
        setOpen(false);
        navigate(`${basePath}/notificacoes`);
    };

    const recent = notifications.slice(0, 8);

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="relative p-2 text-slate-400 hover:text-secondary hover:bg-white rounded-xl transition-all border border-transparent hover:border-secondary/10"
                aria-label="Notificações"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl border border-slate-100 shadow-2xl z-50 overflow-hidden animate-fade-in">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Notificações</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                Últimos 7 dias · {notifications.length} eventos
                            </p>
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllRead}
                                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline"
                            >
                                <Check size={12} /> Marcar lidas
                            </button>
                        )}
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {loading && (
                            <p className="text-xs text-slate-400 text-center py-8 uppercase tracking-widest font-bold">Carregando…</p>
                        )}
                        {!loading && recent.length === 0 && (
                            <p className="text-xs text-slate-400 text-center py-8 uppercase tracking-widest font-bold">
                                Nenhuma notificação no período.
                            </p>
                        )}
                        {!loading && recent.map((n) => {
                            const ts = new Date(n.timestamp);
                            const isUnread = !lastSeen || ts.getTime() > new Date(lastSeen).getTime();
                            return (
                                <button
                                    key={n.id}
                                    type="button"
                                    onClick={() => goTo(n)}
                                    className={`w-full text-left p-4 border-b border-slate-50 hover:bg-slate-50/50 transition-colors flex items-start gap-3 ${
                                        isUnread ? 'bg-blue-50/30' : ''
                                    }`}
                                >
                                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                                        n.isAlert ? 'bg-red-500' : isUnread ? 'bg-blue-500' : 'bg-slate-200'
                                    }`} />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs text-slate-700 font-medium leading-snug truncate">{n.summary}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                            {ts.toLocaleString('pt-BR')}
                                        </p>
                                    </div>
                                    {n.navigateTo && <ChevronRight size={14} className="text-slate-300 shrink-0 mt-1" />}
                                </button>
                            );
                        })}
                    </div>

                    <button
                        type="button"
                        onClick={goToCenter}
                        className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-700 transition-colors"
                    >
                        Ver todas as notificações
                    </button>
                </div>
            )}
        </div>
    );
}

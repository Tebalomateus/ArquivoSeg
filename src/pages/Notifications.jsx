import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Check, Filter, ChevronRight, AlertTriangle } from 'lucide-react';
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

export default function Notifications() {
    const { currentUser, claims, backendUsers } = useClaims();
    const navigate = useNavigate();

    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('all'); // all | unread | alerts
    const [lastSeen, setLastSeen] = useState(() => {
        try { return localStorage.getItem(LAST_SEEN_KEY) || null; } catch { return null; }
    });

    const basePath = currentUser?.role === 'ADMIN' ? '/admin' : '/app';

    const load = useCallback(async () => {
        if (!currentUser) return;
        setLoading(true);
        setError(null);
        try {
            const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const res = await listAudit({ from: since, limit: 500 });
            setEntries(Array.isArray(res?.data) ? res.data : []);
        } catch (err) {
            // viewer/contributor get 403 from /audit — render with permission notice
            if (err?.status === 403) {
                setError('Notificações detalhadas requerem papel manager+. Peça acesso ao seu administrador.');
            } else {
                setError(err?.message || 'Falha ao carregar notificações.');
            }
            setEntries([]);
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    useEffect(() => { load(); }, [load]);

    const me = useMemo(
        () => backendUsers.find((u) => u.email?.toLowerCase() === currentUser?.email?.toLowerCase())?.id,
        [backendUsers, currentUser]
    );
    const isManagerPlus = currentUser?.backRole === 'manager' || currentUser?.backRole === 'admin';

    const notifications = useMemo(() => {
        const myClaimIds = new Set(
            claims.filter((c) => c.assignedTo === me || c.backCreatedBy === me).map((c) => c.id)
        );
        return entries
            .filter((e) => RELEVANT_ACTIONS.has(e.action))
            .filter((e) => e.actor_user_id !== me)
            .filter((e) => {
                if (isManagerPlus) return true;
                if (e.resource_type === 'process') return myClaimIds.has(e.resource_id);
                return false;
            })
            .map((e) => {
                const claim = e.resource_type === 'process' ? claims.find((c) => c.id === e.resource_id) : null;
                const actor = backendUsers.find((u) => u.id === e.actor_user_id);
                return {
                    ...e,
                    claim,
                    actorEmail: actor?.email,
                    actorRole: actor?.role,
                };
            })
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }, [entries, claims, backendUsers, me, isManagerPlus]);

    const filtered = useMemo(() => {
        if (filter === 'alerts') return notifications.filter((n) => n.action === 'access.denied');
        if (filter === 'unread') {
            if (!lastSeen) return notifications;
            const cutoff = new Date(lastSeen).getTime();
            return notifications.filter((n) => new Date(n.timestamp).getTime() > cutoff);
        }
        return notifications;
    }, [notifications, filter, lastSeen]);

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
        if (n.claim) navigate(`${basePath}/sinistros/${n.claim.id}`);
    };

    return (
        <div className="space-y-8 animate-fade-in relative z-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <Link to={basePath} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-blue-500 mb-2 tracking-widest">
                        <ArrowLeft size={16} />
                        Voltar
                    </Link>
                    <h1 className="text-3xl font-bold text-slate-900 font-display flex items-center gap-3">
                        <Bell size={26} /> Centro de Notificações
                    </h1>
                    <p className="text-slate-500 font-medium">Atividades nos seus sinistros nos últimos 30 dias.</p>
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={markAllRead}
                        className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-blue-700 flex items-center gap-2"
                    >
                        <Check size={14} /> Marcar todas como lidas
                    </button>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-4 flex flex-wrap items-center gap-3">
                <Filter size={16} className="text-slate-400" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtrar</span>
                {[
                    { key: 'all', label: `Todas (${notifications.length})` },
                    { key: 'unread', label: `Não lidas (${unreadCount})` },
                    { key: 'alerts', label: `Alertas` },
                ].map((f) => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                            filter === f.key
                                ? 'bg-slate-900 text-white shadow-md'
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {error && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm font-medium text-amber-800">{error}</div>
            )}

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
                {loading && (
                    <p className="text-xs text-slate-400 text-center py-16 uppercase tracking-widest font-bold">Carregando…</p>
                )}
                {!loading && filtered.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-16 uppercase tracking-widest font-bold">
                        Nenhuma notificação para este filtro.
                    </p>
                )}
                {!loading && filtered.map((n) => {
                    const ts = new Date(n.timestamp);
                    const isUnread = !lastSeen || ts.getTime() > new Date(lastSeen).getTime();
                    const isAlert = n.action === 'access.denied';
                    const summary = n.claim
                        ? `${n.actorEmail || 'Usuário'} · ${ACTION_LABELS[n.action] || n.action} em ${n.claim.title || n.claim.number}`
                        : `${n.actorEmail || 'Usuário'} · ${ACTION_LABELS[n.action] || n.action}`;
                    return (
                        <button
                            key={n.id}
                            type="button"
                            onClick={() => goTo(n)}
                            className={`w-full text-left p-5 border-b border-slate-50 hover:bg-slate-50/50 transition-colors flex items-start gap-4 ${
                                isUnread ? 'bg-blue-50/20' : ''
                            }`}
                        >
                            <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                                isAlert ? 'bg-red-100 text-red-600' : isUnread ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                            }`}>
                                {isAlert ? <AlertTriangle size={18} /> : <Bell size={18} />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-slate-800 leading-snug">{summary}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    <span>{ts.toLocaleString('pt-BR')}</span>
                                    {n.actorRole && <span>· {n.actorRole}</span>}
                                    {n.ip_address && <span className="font-mono normal-case">· {n.ip_address}</span>}
                                </div>
                            </div>
                            {n.claim && <ChevronRight size={16} className="text-slate-300 mt-2 shrink-0" />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowLeft,
    ShieldCheck,
    AlertTriangle,
    Lock,
    Database,
    Users,
    FileText,
    Link as LinkIcon,
    Download,
    Activity,
    Clock,
    Calendar,
    TrendingUp,
    Server,
    Info,
    X,
    ChevronRight,
} from 'lucide-react';
import { useClaims } from '../../context/ClaimsContext';
import { listAudit, ACTION_LABELS } from '../../api/audit';
import { actorLabelFromDbId } from '../../api/auth';

const PERIOD_PRESETS = [
    { key: '7', label: '7 dias' },
    { key: '30', label: '30 dias' },
    { key: '90', label: '90 dias' },
];

const SUSEP_SLA_DAYS = 30;
const AUDIT_WINDOW_LIMIT = 1000;

const RESOURCE_LABELS = {
    process: 'Sinistros',
    file_version: 'Documentos',
    comment: 'Anotações',
    share_token: 'Links públicos',
    client: 'Clientes',
    audit_log: 'Audit log',
    user: 'Usuários',
};
const RESOURCE_COLORS = {
    process: 'bg-blue-500',
    file_version: 'bg-amber-500',
    comment: 'bg-emerald-500',
    share_token: 'bg-purple-500',
    client: 'bg-pink-500',
    audit_log: 'bg-slate-500',
    user: 'bg-indigo-500',
};

const ROLE_LABELS = {
    admin: 'Admin',
    manager: 'Manager (Corretor)',
    contributor: 'Contributor (Perito)',
    viewer: 'Viewer (Analista)',
};

const formatBytes = (n) => {
    if (!n || Number.isNaN(n)) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
};

const KpiCard = ({ icon: Icon, color, title, value, detail, regulator, onClick }) => {
    const clickable = typeof onClick === 'function';
    return (
        <button
            type="button"
            onClick={clickable ? onClick : undefined}
            disabled={!clickable}
            className={`bg-white p-7 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-100/50 flex flex-col justify-between transition-all text-left w-full h-full ${
                clickable
                    ? 'hover:border-blue-300 hover:shadow-blue-100 hover:-translate-y-0.5 cursor-pointer group'
                    : 'cursor-default'
            }`}
        >
            <div className="flex items-center justify-between mb-5">
                <div className={`p-3 rounded-2xl ${color} text-white shadow-lg`}>
                    <Icon size={20} />
                </div>
                <div className="flex items-center gap-2">
                    {regulator && (
                        <span
                            title={regulator}
                            className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-slate-50 text-slate-500 cursor-help flex items-center gap-1"
                        >
                            <Info size={10} /> {regulator.split(' — ')[0]}
                        </span>
                    )}
                    {clickable && (
                        <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                    )}
                </div>
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
                <h3 className="text-3xl font-black text-slate-900 font-display">{value}</h3>
                <p className="text-xs text-slate-500 mt-2 font-medium leading-snug">{detail}</p>
            </div>
        </button>
    );
};

// Slide-in drawer with backdrop. Renders fixed at viewport level so the
// page underneath stops scrolling while details are open.
const Drawer = ({ open, title, subtitle, onClose, children }) => {
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, onClose]);

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
            <div className="relative w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col animate-slide-in-right">
                <div className="flex items-start justify-between p-6 border-b border-slate-100 shrink-0">
                    <div className="min-w-0">
                        <h2 className="text-xl font-black text-slate-900 font-display">{title}</h2>
                        {subtitle && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{subtitle}</p>}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all">
                        <X size={20} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">{children}</div>
            </div>
        </div>
    );
};

export default function ComplianceDataCenter() {
    const {
        claims,
        backendUsers,
        clients,
        listFileShares,
        resolveActorLabel,
    } = useClaims();

    const [period, setPeriod] = useState('30');
    const [auditEntries, setAuditEntries] = useState([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditError, setAuditError] = useState(null);
    const [shares, setShares] = useState([]);
    const [sharesLoading, setSharesLoading] = useState(false);
    const [healthOk, setHealthOk] = useState(null);

    // drilldown = { type, payload? } — controls what the side drawer renders.
    const [drilldown, setDrilldown] = useState(null);
    const closeDrawer = useCallback(() => setDrilldown(null), []);

    // Build the from/to ISO window from the period preset.
    const window = useMemo(() => {
        const now = new Date();
        const days = parseInt(period, 10) || 30;
        const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        return {
            fromIso: from.toISOString(),
            toIso: now.toISOString(),
            fromLabel: from.toLocaleDateString('pt-BR'),
            toLabel: now.toLocaleDateString('pt-BR'),
            days,
        };
    }, [period]);

    // Loop-fetch audit entries in the period (back caps each page; we paginate
    // up to AUDIT_WINDOW_LIMIT to keep client-side aggregations honest).
    const loadAudit = useCallback(async () => {
        setAuditLoading(true);
        setAuditError(null);
        try {
            const collected = [];
            const pageSize = 200;
            for (let page = 1; page <= Math.ceil(AUDIT_WINDOW_LIMIT / pageSize); page++) {
                const res = await listAudit({
                    from: window.fromIso,
                    to: window.toIso,
                    page,
                    limit: pageSize,
                });
                const batch = Array.isArray(res?.data) ? res.data : [];
                collected.push(...batch);
                if (batch.length < pageSize) break;
            }
            setAuditEntries(collected);
        } catch (err) {
            setAuditError(err?.message || 'Falha ao carregar auditoria.');
            setAuditEntries([]);
        } finally {
            setAuditLoading(false);
        }
    }, [window.fromIso, window.toIso]);

    // Aggregate share_tokens across every file the admin can see.
    const loadShares = useCallback(async () => {
        setSharesLoading(true);
        try {
            const fileIds = new Set();
            for (const c of claims) {
                for (const f of c.folders || []) {
                    for (const d of f.documents || []) {
                        if (d.backFileVerId) fileIds.add(d.backFileVerId);
                    }
                }
            }
            const lists = await Promise.all(
                Array.from(fileIds).map((id) => listFileShares(id).then((items) => items || []))
            );
            setShares(lists.flat());
        } finally {
            setSharesLoading(false);
        }
    }, [claims, listFileShares]);

    const checkHealth = useCallback(async () => {
        try {
            const res = await fetch('/health/live');
            setHealthOk(res.ok);
        } catch {
            setHealthOk(false);
        }
    }, []);

    useEffect(() => { loadAudit(); }, [loadAudit]);
    useEffect(() => { loadShares(); }, [loadShares]);
    useEffect(() => {
        checkHealth();
        const t = setInterval(checkHealth, 30000);
        return () => clearInterval(t);
    }, [checkHealth]);

    // ======= aggregations =======

    // SUSEP SLA — % of completed claims (status=done) that finished within 30d
    const slaSusep = useMemo(() => {
        const completed = claims.filter((c) => c.backStatus === 'done' && c.backCreatedAt && c.backUpdatedAt);
        if (completed.length === 0) {
            return { pct: null, total: 0, within: 0 };
        }
        let within = 0;
        for (const c of completed) {
            const start = new Date(c.backCreatedAt).getTime();
            const end = new Date(c.backUpdatedAt).getTime();
            const days = (end - start) / (1000 * 60 * 60 * 24);
            if (days <= SUSEP_SLA_DAYS) within++;
        }
        return { pct: Math.round((within / completed.length) * 100), total: completed.length, within };
    }, [claims]);

    const claimsWithSuspendedSla = useMemo(() => {
        return claims.filter((c) => Array.isArray(c.deadline?.history) && (c.deadline?.suspensionCount || 0) > 0).length;
    }, [claims]);

    const accessDeniedCount = useMemo(
        () => auditEntries.filter((e) => e.action === 'access.denied').length,
        [auditEntries]
    );

    const activeShares = useMemo(() => {
        const now = Date.now();
        return shares.filter((s) => !s.revoked && (!s.expires_at || new Date(s.expires_at).getTime() > now)).length;
    }, [shares]);

    const revokedShares = shares.filter((s) => s.revoked).length;
    const expiredShares = useMemo(() => {
        const now = Date.now();
        return shares.filter((s) => !s.revoked && s.expires_at && new Date(s.expires_at).getTime() <= now).length;
    }, [shares]);

    const eventsByResource = useMemo(() => {
        const m = {};
        for (const e of auditEntries) {
            const k = e.resource_type || 'desconhecido';
            m[k] = (m[k] || 0) + 1;
        }
        return m;
    }, [auditEntries]);

    const topActors = useMemo(() => {
        const counts = {};
        for (const e of auditEntries) {
            if (!e.actor_user_id) continue;
            counts[e.actor_user_id] = (counts[e.actor_user_id] || 0) + 1;
        }
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([id, count]) => {
                const u = backendUsers.find((x) => x.id === id);
                return {
                    id,
                    label: u?.email || resolveActorLabel?.(id) || actorLabelFromDbId(id, `User ${String(id).slice(0, 8)}`),
                    role: u?.role,
                    count,
                };
            });
    }, [auditEntries, backendUsers, resolveActorLabel]);

    const accessDenied = useMemo(
        () => auditEntries.filter((e) => e.action === 'access.denied').slice(0, 25),
        [auditEntries]
    );

    // Top accessed share tokens — via share.accessed events grouped by resource_id (= share token UUID)
    const topShareAccesses = useMemo(() => {
        const counts = {};
        const ips = new Set();
        for (const e of auditEntries) {
            if (e.action !== 'share.accessed') continue;
            counts[e.resource_id] = (counts[e.resource_id] || 0) + 1;
            if (e.ip_address) ips.add(String(e.ip_address));
        }
        const top = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id, count]) => {
                const sh = shares.find((s) => s.id === id);
                return {
                    id,
                    token: sh?.token ? `${sh.token.slice(0, 12)}…` : `${String(id).slice(0, 8)}…`,
                    label: sh?.label || 'sem rótulo',
                    revoked: !!sh?.revoked,
                    count,
                };
            });
        return { rows: top, distinctIps: ips.size };
    }, [auditEntries, shares]);

    // Document management — flatten all docs across claims
    const docStats = useMemo(() => {
        let totalDocs = 0;
        let totalSize = 0;
        const folderCounts = {};
        let oldest = null;
        let newest = null;
        for (const c of claims) {
            for (const f of c.folders || []) {
                for (const d of f.documents || []) {
                    if (!d.backFileVerId) continue;
                    totalDocs++;
                    totalSize += Number(d.size_bytes || 0);
                    const cat = (f.category || 'sem categoria').toString().toLowerCase();
                    folderCounts[cat] = (folderCounts[cat] || 0) + 1;
                    if (d.createdAt) {
                        const t = new Date(d.createdAt).getTime();
                        if (!oldest || t < oldest) oldest = t;
                        if (!newest || t > newest) newest = t;
                    }
                }
            }
        }
        return {
            totalDocs,
            totalSize,
            folderCounts,
            oldest: oldest ? new Date(oldest) : null,
            newest: newest ? new Date(newest) : null,
        };
    }, [claims]);

    // RBAC distribution + inactive users in the window
    const rbac = useMemo(() => {
        const dist = { admin: 0, manager: 0, contributor: 0, viewer: 0 };
        for (const u of backendUsers) {
            if (dist[u.role] !== undefined) dist[u.role]++;
        }
        const activeIds = new Set(auditEntries.map((e) => e.actor_user_id).filter(Boolean));
        const inactive = backendUsers.filter((u) => !activeIds.has(u.id));
        return { dist, inactive };
    }, [backendUsers, auditEntries]);

    const totalEvents = auditEntries.length;

    // CSV export — generated client-side from auditEntries already in memory.
    const exportCsv = () => {
        const header = ['timestamp', 'actor_user_id', 'actor_email', 'action', 'resource_type', 'resource_id', 'ip_address', 'user_agent'];
        const lines = [header.join(',')];
        for (const e of auditEntries) {
            const actor = backendUsers.find((u) => u.id === e.actor_user_id);
            const row = [
                e.timestamp || '',
                e.actor_user_id || '',
                actor?.email || '',
                e.action || '',
                e.resource_type || '',
                e.resource_id || '',
                e.ip_address || '',
                (e.user_agent || '').replace(/"/g, '""'),
            ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
            lines.push(row.join(','));
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_trail_${window.fromLabel.replace(/\//g, '-')}_a_${window.toLabel.replace(/\//g, '-')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-8 animate-fade-in relative z-10">
            {/* ========= Header ========= */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <Link to="/admin" className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-blue-500 mb-2 tracking-widest">
                        <ArrowLeft size={16} />
                        Voltar ao Painel
                    </Link>
                    <h1 className="text-3xl font-bold text-slate-900 font-display flex items-center gap-3">
                        <Database size={26} /> Compliance Data Center
                    </h1>
                    <p className="text-slate-500 font-medium">
                        Visão consolidada de conformidade — LGPD Art. 37, SUSEP Circular 621/2021, Resolução CNSP 416/2021.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest ${
                            healthOk === null
                                ? 'bg-slate-50 border-slate-100 text-slate-500'
                                : healthOk
                                  ? 'bg-green-50 border-green-200 text-green-700'
                                  : 'bg-red-50 border-red-200 text-red-700'
                        }`}
                    >
                        <Server size={14} />
                        Backend {healthOk === null ? '…' : healthOk ? 'Online' : 'Offline'}
                    </div>
                    <button
                        onClick={exportCsv}
                        disabled={auditEntries.length === 0}
                        className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-blue-700 disabled:opacity-40 flex items-center gap-2"
                    >
                        <Download size={14} /> Exportar CSV
                    </button>
                </div>
            </div>

            {/* ========= Period filter ========= */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Calendar size={16} className="text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Período de análise</span>
                    <div className="flex gap-2">
                        {PERIOD_PRESETS.map((p) => (
                            <button
                                key={p.key}
                                onClick={() => setPeriod(p.key)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                    period === p.key
                                        ? 'bg-slate-900 text-white shadow-md'
                                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {window.fromLabel} → {window.toLabel} · {auditLoading ? 'carregando…' : `${totalEvents} eventos`}
                </p>
            </div>

            {auditError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm font-medium text-red-700">{auditError}</div>
            )}

            {/* ========= Section 2 — KPIs ========= */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard
                    icon={Clock}
                    color="bg-blue-600"
                    title="SLA SUSEP (30d)"
                    value={slaSusep.pct === null ? '—' : `${slaSusep.pct}%`}
                    detail={
                        slaSusep.total > 0
                            ? `${slaSusep.within} de ${slaSusep.total} sinistros concluídos no prazo`
                            : 'Nenhum sinistro concluído na janela.'
                    }
                    regulator="SUSEP 621/2021 — art. 41 (30d entre documentos básicos e liquidação)"
                    onClick={() => setDrilldown({ type: 'sla_susep' })}
                />
                <KpiCard
                    icon={AlertTriangle}
                    color="bg-amber-500"
                    title="Sinistros suspensos"
                    value={claimsWithSuspendedSla}
                    detail="Processos com SLA pausado (justificativa registrada)"
                    regulator="CNSP 416/2021 — controles operacionais"
                    onClick={() => setDrilldown({ type: 'suspended' })}
                />
                <KpiCard
                    icon={Lock}
                    color="bg-red-600"
                    title="Acessos negados"
                    value={accessDeniedCount}
                    detail={`Últimos ${window.days} dias · 403 servidos pelo back`}
                    regulator="LGPD Art. 37 — segregação de funções"
                    onClick={() => setDrilldown({ type: 'access_denied' })}
                />
                <KpiCard
                    icon={LinkIcon}
                    color="bg-purple-600"
                    title="Links públicos ativos"
                    value={sharesLoading ? '…' : activeShares}
                    detail={`${revokedShares} revogados · ${expiredShares} expirados`}
                    regulator="LGPD Art. 7 — compartilhamento com terceiros"
                    onClick={() => setDrilldown({ type: 'shares_active' })}
                />
            </div>

            {/* ========= Section 3 — Audit trail ========= */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Donut + breakdown */}
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl p-7 lg:col-span-2">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Eventos por categoria</h3>
                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">LGPD Art. 37 — registro de operações</p>
                        </div>
                        <Activity size={18} className="text-slate-300" />
                    </div>
                    {totalEvents === 0 ? (
                        <p className="text-xs text-slate-400 font-medium text-center py-12">Nenhum evento no período.</p>
                    ) : (
                        <div className="space-y-3">
                            {Object.entries(eventsByResource)
                                .sort((a, b) => b[1] - a[1])
                                .map(([rt, count]) => {
                                    const pct = Math.round((count / totalEvents) * 100);
                                    return (
                                        <button
                                            key={rt}
                                            type="button"
                                            onClick={() => setDrilldown({ type: 'events_by_resource', payload: { rt } })}
                                            className="w-full text-left space-y-1.5 p-2 -m-2 rounded-xl hover:bg-slate-50 transition-colors group"
                                        >
                                            <div className="flex justify-between text-xs">
                                                <span className="font-bold text-slate-700 group-hover:text-blue-600">{RESOURCE_LABELS[rt] || rt}</span>
                                                <span className="font-black text-slate-900 flex items-center gap-1">
                                                    {count} <span className="text-slate-400 font-bold">({pct}%)</span>
                                                    <ChevronRight size={12} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                                                </span>
                                            </div>
                                            <div className="w-full h-2.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                                                <div
                                                    className={`h-full ${RESOURCE_COLORS[rt] || 'bg-slate-400'} transition-all duration-500`}
                                                    style={{ width: `${pct}%` }}
                                                ></div>
                                            </div>
                                        </button>
                                    );
                                })}
                        </div>
                    )}
                </div>

                {/* Top actors */}
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl p-7">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Top 10 atores</h3>
                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Maior volume de operações</p>
                        </div>
                        <TrendingUp size={18} className="text-slate-300" />
                    </div>
                    {topActors.length === 0 ? (
                        <p className="text-xs text-slate-400 font-medium text-center py-12">Nenhum ator no período.</p>
                    ) : (
                        <ul className="space-y-2">
                            {topActors.map((a, i) => (
                                <li key={a.id}>
                                    <button
                                        type="button"
                                        onClick={() => setDrilldown({ type: 'actor', payload: { id: a.id, label: a.label, role: a.role } })}
                                        className="w-full flex items-center justify-between gap-2 p-2 -m-2 rounded-xl hover:bg-slate-50 transition-colors group"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="text-[10px] font-black text-slate-400 w-5">{i + 1}</span>
                                            <div className="min-w-0 text-left">
                                                <p className="text-xs font-bold text-slate-800 truncate group-hover:text-blue-600" title={a.label}>{a.label}</p>
                                                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">{a.role || '—'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-xs font-black text-slate-900">{a.count}</span>
                                            <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* ========= Access denied table ========= */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                            <Lock size={16} className="text-red-500" /> Acessos negados (mais recentes)
                        </h3>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">CNSP 416/2021 — gestão de riscos</p>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{accessDenied.length} mostrados</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/50">
                            <tr className="text-left border-b border-slate-100">
                                <th className="p-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">Quando</th>
                                <th className="p-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">Ator</th>
                                <th className="p-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">Recurso tentado</th>
                                <th className="p-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">IP</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {auditLoading && (
                                <tr><td colSpan="4" className="p-12 text-center text-slate-400 text-xs uppercase tracking-widest">Carregando...</td></tr>
                            )}
                            {!auditLoading && accessDenied.length === 0 && (
                                <tr><td colSpan="4" className="p-12 text-center text-slate-400 text-xs uppercase tracking-widest">Nenhuma negação no período — ✓</td></tr>
                            )}
                            {!auditLoading && accessDenied.map((e) => {
                                const ts = e.timestamp ? new Date(e.timestamp) : null;
                                const actor = backendUsers.find((u) => u.id === e.actor_user_id);
                                const label = actor?.email || resolveActorLabel?.(e.actor_user_id) || actorLabelFromDbId(e.actor_user_id, 'desconhecido');
                                return (
                                    <tr key={e.id} className="hover:bg-slate-50/30">
                                        <td className="p-4 text-xs font-bold text-slate-700 whitespace-nowrap">{ts ? ts.toLocaleString('pt-BR') : '-'}</td>
                                        <td className="p-4 text-xs font-bold text-slate-700">
                                            {label}
                                            {actor?.role && <span className="ml-2 text-[9px] text-slate-400 font-black uppercase tracking-widest">({actor.role})</span>}
                                        </td>
                                        <td className="p-4 text-[10px] font-mono text-slate-600">
                                            {e.resource_type}{e.resource_id ? ` · ${String(e.resource_id).slice(0, 8)}` : ''}
                                        </td>
                                        <td className="p-4 text-[10px] font-mono text-slate-500">{e.ip_address || '-'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ========= Append-only integrity ========= */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-slate-900 text-white rounded-[2rem] p-7 shadow-2xl">
                    <div className="flex items-start gap-4">
                        <div className="p-3 rounded-2xl bg-blue-500/20 text-blue-300 shrink-0">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-tight">Trilha de auditoria append-only</h3>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                A tabela <code className="text-slate-200 font-mono">audit_logs</code> tem <code className="text-slate-200 font-mono">REVOKE UPDATE, DELETE FROM app</code> no Postgres — o role da aplicação só pode <strong>inserir</strong>. Adulteração exige acesso ao admin do banco. Multi-tenant via Row-Level Security.
                            </p>
                            <div className="grid grid-cols-3 gap-4 mt-5">
                                <div>
                                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Eventos lidos</p>
                                    <p className="text-2xl font-black mt-1">{totalEvents}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Janela</p>
                                    <p className="text-2xl font-black mt-1">{window.days}d</p>
                                </div>
                                <div>
                                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Categorias</p>
                                    <p className="text-2xl font-black mt-1">{Object.keys(eventsByResource).length}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl p-7">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-1">Política de retenção</h3>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mb-4">Sinistros arquivados</p>
                    <p className="text-3xl font-black text-slate-900">
                        {claims.filter((c) => c.backStatus === 'archived').length}
                    </p>
                    <p className="text-xs text-slate-500 mt-2 leading-snug">
                        Retenção mínima sugerida: 5 anos pós-encerramento (Lei do Seguro / SUSEP).
                    </p>
                </div>
            </div>

            {/* ========= Section 4 — External access ========= */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-slate-50">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                        <LinkIcon size={16} /> Acessos externos
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-1">Compartilhamento via portal público (LGPD Art. 7)</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
                    <div className="p-5 rounded-2xl bg-green-50 border border-green-100">
                        <p className="text-[10px] font-black text-green-700 uppercase tracking-widest">Ativos</p>
                        <p className="text-3xl font-black text-green-700 mt-1">{activeShares}</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-red-50 border border-red-100">
                        <p className="text-[10px] font-black text-red-700 uppercase tracking-widest">Revogados</p>
                        <p className="text-3xl font-black text-red-700 mt-1">{revokedShares}</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Expirados</p>
                        <p className="text-3xl font-black text-slate-700 mt-1">{expiredShares}</p>
                    </div>
                </div>
                <div className="p-6 border-t border-slate-50">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Top 5 links acessados</h4>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {topShareAccesses.distinctIps} IPs distintos · {window.days}d
                        </span>
                    </div>
                    {topShareAccesses.rows.length === 0 ? (
                        <p className="text-xs text-slate-400 font-medium text-center py-8">Nenhum acesso externo no período.</p>
                    ) : (
                        <ul className="space-y-2">
                            {topShareAccesses.rows.map((s, i) => (
                                <li key={s.id}>
                                    <button
                                        type="button"
                                        onClick={() => setDrilldown({ type: 'share', payload: { id: s.id, token: s.token, label: s.label, revoked: s.revoked } })}
                                        className="w-full flex items-center justify-between p-3 bg-slate-50/50 rounded-xl hover:bg-slate-100 transition-colors group text-left"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="text-[10px] font-black text-slate-400 w-5">{i + 1}</span>
                                            <div className="min-w-0">
                                                <p className="text-xs font-mono text-slate-700 group-hover:text-blue-600">{s.token}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{s.label}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            {s.revoked && <span className="text-[9px] font-black text-red-700 bg-red-100 px-2 py-0.5 rounded uppercase">Revogado</span>}
                                            <span className="text-xs font-black text-slate-900">{s.count}</span>
                                            <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* ========= Section 5 — Document management ========= */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl p-7">
                    <FileText size={20} className="text-slate-400 mb-3" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Documentos ativos</p>
                    <h3 className="text-3xl font-black text-slate-900 mt-1">{docStats.totalDocs}</h3>
                </div>
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl p-7">
                    <Database size={20} className="text-slate-400 mb-3" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Espaço armazenado</p>
                    <h3 className="text-3xl font-black text-slate-900 mt-1">{formatBytes(docStats.totalSize)}</h3>
                </div>
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl p-7">
                    <Calendar size={20} className="text-slate-400 mb-3" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mais antigo</p>
                    <h3 className="text-base font-black text-slate-900 mt-1">{docStats.oldest ? docStats.oldest.toLocaleDateString('pt-BR') : '—'}</h3>
                </div>
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl p-7">
                    <Calendar size={20} className="text-slate-400 mb-3" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mais recente</p>
                    <h3 className="text-base font-black text-slate-900 mt-1">{docStats.newest ? docStats.newest.toLocaleDateString('pt-BR') : '—'}</h3>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl p-7">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-1">Distribuição por categoria de pasta</h3>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mb-5">Prefixo <code className="font-mono">{'<categoria>__'}</code> dos uploads</p>
                {Object.keys(docStats.folderCounts).length === 0 ? (
                    <p className="text-xs text-slate-400 font-medium text-center py-8">Nenhum documento registrado.</p>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(docStats.folderCounts)
                            .sort((a, b) => b[1] - a[1])
                            .map(([cat, count]) => (
                                <div key={cat} className="p-4 rounded-2xl bg-slate-50/50 border border-slate-100">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{cat}</p>
                                    <p className="text-2xl font-black text-slate-900 mt-1">{count}</p>
                                </div>
                            ))}
                    </div>
                )}
            </div>

            {/* ========= Section 6 — RBAC controls ========= */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl p-7">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <Users size={16} /> Distribuição de papéis
                            </h3>
                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Segregação CNSP 416/2021</p>
                        </div>
                        <span className="text-xs font-black text-slate-900">{backendUsers.length} usuários</span>
                    </div>
                    {backendUsers.length === 0 ? (
                        <p className="text-xs text-slate-400 font-medium text-center py-8">Lista de usuários indisponível.</p>
                    ) : (
                        <div className="space-y-3">
                            {Object.entries(rbac.dist).map(([role, count]) => {
                                const pct = backendUsers.length > 0 ? Math.round((count / backendUsers.length) * 100) : 0;
                                return (
                                    <div key={role} className="space-y-1.5">
                                        <div className="flex justify-between text-xs">
                                            <span className="font-bold text-slate-700">{ROLE_LABELS[role] || role}</span>
                                            <span className="font-black text-slate-900">
                                                {count} <span className="text-slate-400 font-bold">({pct}%)</span>
                                            </span>
                                        </div>
                                        <div className="w-full h-2.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                                            <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${pct}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl p-7">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Usuários inativos no período</h3>
                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Sem operações nos últimos {window.days} dias</p>
                        </div>
                        <span className="text-xs font-black text-slate-900">{rbac.inactive.length}</span>
                    </div>
                    {rbac.inactive.length === 0 ? (
                        <p className="text-xs text-slate-400 font-medium text-center py-8">Todos os usuários ativos no período.</p>
                    ) : (
                        <ul className="space-y-2 max-h-72 overflow-y-auto">
                            {rbac.inactive.map((u) => (
                                <li key={u.id} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl">
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-slate-700 truncate">{u.email}</p>
                                        <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black">{ROLE_LABELS[u.role] || u.role}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* Footnote about Zitadel-side gaps */}
            <div className="p-5 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                <Info size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 leading-relaxed">
                    <strong>Limitação conhecida:</strong> eventos <code className="font-mono">user.invited</code> e <code className="font-mono">user.role_changed</code> não são registrados aqui — convites e mudanças de papel acontecem no console do Zitadel
                    (<code className="font-mono">http://localhost:8081</code>) e geram trilha lá. Esta tela cobre apenas o domínio operacional do ArquivoSeg.
                </p>
            </div>

            {/* ========= Drilldown drawer ========= */}
            <DrilldownDrawer
                drilldown={drilldown}
                onClose={closeDrawer}
                auditEntries={auditEntries}
                claims={claims}
                shares={shares}
                backendUsers={backendUsers}
                clients={clients}
                resolveActorLabel={resolveActorLabel}
                window={window}
            />
        </div>
    );
}

// ===========================================================================
// Drilldown drawer — switches content based on drilldown.type.
// Each branch reads from already-loaded state (no extra fetches).
// ===========================================================================
function DrilldownDrawer({ drilldown, onClose, auditEntries, claims, shares, backendUsers, clients, resolveActorLabel, window: win }) {
    const open = !!drilldown;
    const type = drilldown?.type;
    const payload = drilldown?.payload;

    const labelFor = (uuid) => {
        if (!uuid) return 'Sistema';
        const u = backendUsers.find((x) => x.id === uuid);
        return u?.email || resolveActorLabel?.(uuid) || actorLabelFromDbId(uuid, `User ${String(uuid).slice(0, 8)}`);
    };
    const roleFor = (uuid) => backendUsers.find((x) => x.id === uuid)?.role;

    let title = '';
    let subtitle = '';
    let body = null;

    if (type === 'access_denied') {
        const events = auditEntries.filter((e) => e.action === 'access.denied');
        title = 'Acessos negados';
        subtitle = `LGPD Art. 37 · CNSP 416/2021 — ${events.length} ocorrência${events.length === 1 ? '' : 's'} nos últimos ${win.days} dias`;
        body = <EventTable events={events} labelFor={labelFor} roleFor={roleFor} emptyText="Nenhum acesso negado no período — RBAC sem alertas." />;
    } else if (type === 'sla_susep') {
        const completed = claims.filter((c) => c.backStatus === 'done' && c.backCreatedAt && c.backUpdatedAt);
        title = 'SLA SUSEP — sinistros concluídos';
        subtitle = `SUSEP Circular 621/2021 art. 41 · prazo de ${SUSEP_SLA_DAYS} dias entre criação e liquidação`;
        body = <ClaimSlaList claims={completed} backendUsers={backendUsers} />;
    } else if (type === 'suspended') {
        const susp = claims.filter((c) => Array.isArray(c.deadline?.history) && (c.deadline?.suspensionCount || 0) > 0);
        title = 'Sinistros com SLA suspenso';
        subtitle = `CNSP 416/2021 — ${susp.length} processo${susp.length === 1 ? '' : 's'} pausado${susp.length === 1 ? '' : 's'}`;
        body = <SuspensionList claims={susp} />;
    } else if (type === 'shares_active') {
        const now = Date.now();
        const items = shares.filter((s) => !s.revoked && (!s.expires_at || new Date(s.expires_at).getTime() > now));
        title = 'Links públicos ativos';
        subtitle = `LGPD Art. 7 — ${items.length} link${items.length === 1 ? '' : 's'} compartilhado${items.length === 1 ? '' : 's'} com terceiros`;
        body = <ShareList shares={items} labelFor={labelFor} />;
    } else if (type === 'events_by_resource') {
        const rt = payload?.rt;
        const events = auditEntries.filter((e) => e.resource_type === rt);
        title = `Eventos · ${RESOURCE_LABELS[rt] || rt}`;
        subtitle = `${events.length} evento${events.length === 1 ? '' : 's'} no período · LGPD Art. 37`;
        body = <EventTable events={events} labelFor={labelFor} roleFor={roleFor} emptyText="Sem eventos nesta categoria." />;
    } else if (type === 'actor') {
        const events = auditEntries.filter((e) => e.actor_user_id === payload?.id);
        title = payload?.label || 'Ator';
        subtitle = `${events.length} operações · papel ${payload?.role || '—'}`;
        body = <EventTable events={events} labelFor={labelFor} roleFor={roleFor} emptyText="Sem eventos para este ator." />;
    } else if (type === 'share') {
        const events = auditEntries.filter((e) => e.resource_id === payload?.id && e.resource_type === 'share_token');
        const accessed = events.filter((e) => e.action === 'share.accessed');
        title = `Link · ${payload?.token || ''}`;
        subtitle = `${payload?.label || 'sem rótulo'} — ${accessed.length} acesso${accessed.length === 1 ? '' : 's'} público${accessed.length === 1 ? '' : 's'}`;
        body = (
            <>
                {payload?.revoked && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-bold uppercase tracking-widest">
                        Este link foi revogado.
                    </div>
                )}
                <EventTable events={events} labelFor={labelFor} roleFor={roleFor} emptyText="Sem eventos para este link." />
            </>
        );
    }

    return (
        <Drawer open={open} title={title} subtitle={subtitle} onClose={onClose}>
            {body}
        </Drawer>
    );
}

// Reusable event table for drill-downs.
function EventTable({ events, labelFor, roleFor, emptyText }) {
    if (events.length === 0) {
        return <p className="text-xs text-slate-400 font-medium text-center py-12">{emptyText || 'Sem eventos.'}</p>;
    }
    return (
        <div className="space-y-2">
            {events.map((e) => {
                const ts = e.timestamp ? new Date(e.timestamp) : null;
                const label = labelFor(e.actor_user_id);
                const role = roleFor(e.actor_user_id);
                const meta = e.metadata || {};
                const metaKeys = Object.keys(meta);
                return (
                    <div key={e.id} className="p-3 bg-slate-50/60 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[9px] font-black uppercase tracking-widest">
                                {ACTION_LABELS[e.action] || e.action}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold tabular-nums">{ts ? ts.toLocaleString('pt-BR') : '-'}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-800">
                            {label}
                            {role && <span className="ml-2 text-[9px] text-slate-400 font-black uppercase tracking-widest">({role})</span>}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-500">
                            <div>
                                <span className="text-slate-400">recurso: </span>
                                {e.resource_type}{e.resource_id ? ` · ${String(e.resource_id).slice(0, 8)}` : ''}
                            </div>
                            <div>
                                <span className="text-slate-400">ip: </span>
                                {e.ip_address || '-'}
                            </div>
                        </div>
                        {e.user_agent && (
                            <p className="mt-1 text-[10px] font-mono text-slate-400 break-all">
                                <span className="text-slate-400">ua: </span>{e.user_agent}
                            </p>
                        )}
                        {metaKeys.length > 0 && (
                            <div className="mt-2 p-2 rounded-lg bg-white border border-slate-100 text-[10px] font-mono text-slate-600 space-y-0.5">
                                {metaKeys.map((k) => (
                                    <div key={k}><span className="text-slate-400">{k}: </span>{typeof meta[k] === 'object' ? JSON.stringify(meta[k]) : String(meta[k])}</div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function ClaimSlaList({ claims }) {
    if (claims.length === 0) {
        return <p className="text-xs text-slate-400 font-medium text-center py-12">Nenhum sinistro concluído na janela.</p>;
    }
    return (
        <div className="space-y-2">
            {claims.map((c) => {
                const start = new Date(c.backCreatedAt).getTime();
                const end = new Date(c.backUpdatedAt).getTime();
                const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
                const within = days <= SUSEP_SLA_DAYS;
                return (
                    <div key={c.id} className="p-3 bg-slate-50/60 rounded-xl border border-slate-100 flex items-start gap-3">
                        <span className={`shrink-0 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${within ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {within ? 'No prazo' : 'Fora do prazo'}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800 truncate">{c.title || c.number}</p>
                            <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                                {c.insurer || '—'} · criado em {new Date(c.backCreatedAt).toLocaleDateString('pt-BR')} · concluído em {new Date(c.backUpdatedAt).toLocaleDateString('pt-BR')}
                            </p>
                            <p className="text-[10px] font-mono text-slate-400 mt-1">{days} dia{days === 1 ? '' : 's'} de tramitação · limite SUSEP {SUSEP_SLA_DAYS}d</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function SuspensionList({ claims }) {
    if (claims.length === 0) {
        return <p className="text-xs text-slate-400 font-medium text-center py-12">Nenhum sinistro com SLA suspenso.</p>;
    }
    return (
        <div className="space-y-3">
            {claims.map((c) => (
                <div key={c.id} className="p-4 bg-slate-50/60 rounded-xl border border-slate-100">
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{c.title || c.number}</p>
                            <p className="text-[10px] text-slate-500 font-medium mt-0.5">{c.insurer || '—'}</p>
                        </div>
                        <span className="shrink-0 px-2 py-1 rounded-md bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-widest">
                            {c.deadline?.suspensionCount || 0}× pausado
                        </span>
                    </div>
                    {Array.isArray(c.deadline?.history) && c.deadline.history.length > 0 ? (
                        <ul className="space-y-1.5 mt-2 border-l-2 border-amber-200 pl-3">
                            {c.deadline.history.map((h, i) => (
                                <li key={i} className="text-[10px] text-slate-600">
                                    <span className="font-bold text-slate-400">{h.date}</span>
                                    <span className="ml-2">{h.action}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-[10px] text-slate-400 italic">Histórico de suspensões não disponível.</p>
                    )}
                </div>
            ))}
        </div>
    );
}

function ShareList({ shares, labelFor }) {
    if (shares.length === 0) {
        return <p className="text-xs text-slate-400 font-medium text-center py-12">Nenhum link ativo.</p>;
    }
    return (
        <div className="space-y-2">
            {shares.map((s) => {
                const created = s.created_at ? new Date(s.created_at).toLocaleDateString('pt-BR') : '-';
                const expires = s.expires_at ? new Date(s.expires_at).toLocaleDateString('pt-BR') : 'sem expiração';
                return (
                    <div key={s.id} className="p-3 bg-slate-50/60 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-xs font-mono text-slate-700 truncate">{s.token ? `${s.token.slice(0, 16)}…` : String(s.id).slice(0, 8)}</p>
                            <span className="text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest bg-green-100 text-green-700 shrink-0">Ativo</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold">{s.label || 'sem rótulo'}</p>
                        <p className="text-[10px] font-mono text-slate-400 mt-1">
                            criado {created} · expira {expires} · por {labelFor(s.created_by)}
                        </p>
                    </div>
                );
            })}
        </div>
    );
}

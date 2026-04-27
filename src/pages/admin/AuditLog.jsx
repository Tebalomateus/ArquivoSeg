import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, History, Filter, RotateCcw } from 'lucide-react';
import { useClaims } from '../../context/ClaimsContext';
import { listAudit, ACTION_LABELS } from '../../api/audit';
import { actorLabelFromDbId } from '../../api/auth';

const PAGE_SIZE = 25;

const RESOURCE_TYPES = [
    { value: '', label: 'Todos' },
    { value: 'process', label: 'Sinistro' },
    { value: 'file_version', label: 'Documento' },
    { value: 'comment', label: 'Anotação' },
    { value: 'share_token', label: 'Share' },
    { value: 'client', label: 'Cliente' },
    { value: 'audit_log', label: 'Audit log' },
    { value: 'user', label: 'Usuário' },
];

export default function AuditLog() {
    const { backendUsers, resolveActorLabel } = useClaims();

    const [filters, setFilters] = useState({
        actorUserId: '',
        resourceType: '',
        from: '',
        to: '',
    });
    const [page, setPage] = useState(1);
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [expandedId, setExpandedId] = useState(null);

    const fetchPage = async () => {
        setLoading(true);
        setError(null);
        try {
            const opts = { page, limit: PAGE_SIZE };
            if (filters.actorUserId) opts.actorUserId = filters.actorUserId;
            if (filters.resourceType) opts.resourceType = filters.resourceType;
            // Date inputs are YYYY-MM-DD; convert to RFC3339 boundaries.
            if (filters.from) opts.from = `${filters.from}T00:00:00Z`;
            if (filters.to) opts.to = `${filters.to}T23:59:59Z`;
            const res = await listAudit(opts);
            const entries = Array.isArray(res?.data) ? res.data : [];
            setData(entries);
            setTotal(typeof res?.total === 'number' ? res.total : entries.length);
        } catch (err) {
            setError(err?.message || 'Erro ao carregar audit log.');
            setData([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPage();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters, page]);

    // Reset to first page when filters change.
    const resetFilters = () => {
        setFilters({ actorUserId: '', resourceType: '', from: '', to: '' });
        setPage(1);
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const setFilter = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const labelFor = useMemo(() => (uuid) => {
        if (!uuid) return 'Sistema';
        return resolveActorLabel?.(uuid) || actorLabelFromDbId(uuid, `User ${String(uuid).slice(0, 8)}`);
    }, [resolveActorLabel]);

    return (
        <div className="space-y-8 animate-fade-in relative z-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <Link to="/admin" className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-blue-500 transition-all mb-2 tracking-widest">
                        <ArrowLeft size={16} />
                        Voltar ao Painel
                    </Link>
                    <h1 className="text-3xl font-bold text-slate-900 font-display flex items-center gap-3">
                        <History size={26} /> Auditoria Global
                    </h1>
                    <p className="text-slate-500 font-medium">Trilha completa de eventos do tenant. Manager+ apenas.</p>
                </div>
                <button onClick={fetchPage} className="bg-white px-4 py-2 rounded-xl border border-slate-100 text-slate-600 hover:bg-slate-50 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <RotateCcw size={14} /> Recarregar
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm font-medium text-red-700">{error}</div>
            )}

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-slate-50 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ator</label>
                        <select
                            value={filters.actorUserId}
                            onChange={(e) => setFilter('actorUserId', e.target.value)}
                            className="w-full mt-1 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Todos</option>
                            {(backendUsers || []).map(u => (
                                <option key={u.id} value={u.id}>{u.email} ({u.role})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recurso</label>
                        <select
                            value={filters.resourceType}
                            onChange={(e) => setFilter('resourceType', e.target.value)}
                            className="w-full mt-1 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {RESOURCE_TYPES.map(rt => (
                                <option key={rt.value} value={rt.value}>{rt.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">De</label>
                        <input
                            type="date"
                            value={filters.from}
                            onChange={(e) => setFilter('from', e.target.value)}
                            className="w-full mt-1 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Até</label>
                        <input
                            type="date"
                            value={filters.to}
                            onChange={(e) => setFilter('to', e.target.value)}
                            className="w-full mt-1 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={resetFilters}
                        className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 flex items-center justify-center gap-2"
                    >
                        <Filter size={14} /> Limpar
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/50">
                            <tr className="text-left border-b border-slate-100">
                                <th className="p-5 font-black text-slate-400 text-[10px] uppercase tracking-widest">Quando</th>
                                <th className="p-5 font-black text-slate-400 text-[10px] uppercase tracking-widest">Ator</th>
                                <th className="p-5 font-black text-slate-400 text-[10px] uppercase tracking-widest">Ação</th>
                                <th className="p-5 font-black text-slate-400 text-[10px] uppercase tracking-widest">Recurso</th>
                                <th className="p-5"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading && (
                                <tr><td colSpan="5" className="p-12 text-center text-slate-400 text-xs uppercase tracking-widest">Carregando...</td></tr>
                            )}
                            {!loading && data.length === 0 && (
                                <tr><td colSpan="5" className="p-16 text-center text-slate-400 text-xs uppercase tracking-widest">Nenhum evento encontrado para os filtros atuais.</td></tr>
                            )}
                            {!loading && data.map(entry => {
                                const isOpen = expandedId === entry.id;
                                const ts = entry.timestamp ? new Date(entry.timestamp) : null;
                                const expandable = !!(entry.ip_address || entry.user_agent || (entry.metadata && Object.keys(entry.metadata).length > 0));
                                return (
                                    <>
                                        <tr key={entry.id} className="hover:bg-slate-50/50">
                                            <td className="p-5 text-xs font-bold text-slate-700 whitespace-nowrap">{ts ? ts.toLocaleString('pt-BR') : '-'}</td>
                                            <td className="p-5 text-xs font-bold text-slate-700">{labelFor(entry.actor_user_id)}</td>
                                            <td className="p-5">
                                                <span className="inline-flex items-center px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest">
                                                    {ACTION_LABELS[entry.action] || entry.action}
                                                </span>
                                            </td>
                                            <td className="p-5 text-[10px] font-mono text-slate-500">
                                                {entry.resource_type}{entry.resource_id ? ` · ${String(entry.resource_id).slice(0, 8)}` : ''}
                                            </td>
                                            <td className="p-5 text-right">
                                                {expandable && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedId(isOpen ? null : entry.id)}
                                                        className="text-[10px] font-black text-blue-600 hover:underline uppercase tracking-widest"
                                                    >
                                                        {isOpen ? 'ocultar' : 'detalhes'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                        {expandable && isOpen && (
                                            <tr key={entry.id + '-d'}>
                                                <td colSpan="5" className="bg-slate-50/30 p-5 border-l-4 border-blue-400">
                                                    <div className="text-[10px] font-mono text-slate-700 space-y-1 break-all">
                                                        {entry.ip_address && <div><span className="text-slate-400">ip: </span>{entry.ip_address}</div>}
                                                        {entry.user_agent && <div><span className="text-slate-400">user-agent: </span>{entry.user_agent}</div>}
                                                        {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                                                            <div>
                                                                <p className="text-slate-400 mb-1">metadata:</p>
                                                                {Object.entries(entry.metadata).map(([k, v]) => (
                                                                    <div key={k} className="pl-3"><span className="text-slate-500">{k}: </span>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {total > PAGE_SIZE && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-50 bg-slate-50/50">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Página {page} de {totalPages} · {total} eventos no total
                        </p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                disabled={page <= 1 || loading}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Anterior
                            </button>
                            <button
                                type="button"
                                disabled={page >= totalPages || loading}
                                onClick={() => setPage(p => p + 1)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Próxima
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

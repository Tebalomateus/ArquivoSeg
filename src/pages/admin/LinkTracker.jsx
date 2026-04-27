import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Link as LinkIcon,
    ExternalLink,
    Eye,
    Calendar,
    User,
    XCircle,
    Search,
    ArrowLeft,
    ShieldAlert,
    Copy
} from 'lucide-react';
import { useClaims } from '../../context/ClaimsContext';
import { actorLabelFromDbId } from '../../api/auth';

export default function LinkTracker() {
    const {
        claims,
        listFileShares,
        revokeFileShare,
        countShareAccesses,
        resolveActorLabel,
    } = useClaims();

    const [searchTerm, setSearchTerm] = useState('');
    const [shares, setShares] = useState([]);
    const [accessCounts, setAccessCounts] = useState({}); // tokenId -> count
    const [loading, setLoading] = useState(false);

    const filesByVerId = useMemo(() => {
        const map = {};
        for (const c of claims) {
            for (const f of c.folders || []) {
                for (const d of f.documents || []) {
                    if (d.backFileVerId) {
                        map[d.backFileVerId] = { ...d, claim: c };
                    }
                }
            }
        }
        return map;
    }, [claims]);

    const refreshShares = async () => {
        setLoading(true);
        try {
            const allFiles = Object.values(filesByVerId);
            const lists = await Promise.all(allFiles.map(async (f) => {
                const items = await listFileShares(f.backFileVerId);
                return items.map(s => ({ ...s, _file: f }));
            }));
            const flat = lists.flat();
            setShares(flat);

            // Fetch access counts in parallel (best effort)
            const counts = {};
            await Promise.all(flat.map(async (s) => {
                counts[s.id] = await countShareAccesses(s.id);
            }));
            setAccessCounts(counts);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (Object.keys(filesByVerId).length > 0) refreshShares();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [Object.keys(filesByVerId).length]);

    const filteredShares = useMemo(() => {
        const q = searchTerm.toLowerCase();
        return shares.filter(s =>
            (s.token || '').toLowerCase().includes(q) ||
            (s.label || '').toLowerCase().includes(q) ||
            (s._file?.name || '').toLowerCase().includes(q) ||
            (s._file?.claim?.number || '').toLowerCase().includes(q)
        );
    }, [shares, searchTerm]);

    const handleRevoke = async (id) => {
        if (!confirm('Revogar este link? O acesso público será imediatamente bloqueado.')) return;
        await revokeFileShare(id);
        await refreshShares();
    };

    const handleCopy = (token) => {
        navigator.clipboard.writeText(`${window.location.origin}/portal/${token}`);
        alert('Link copiado para a área de transferência!');
    };

    const totalViews = Object.values(accessCounts).reduce((acc, n) => acc + n, 0);
    const activeShares = shares.filter(s => !s.revoked).length;
    const revokedRatio = shares.length > 0
        ? Math.round((shares.filter(s => s.revoked).length / shares.length) * 100)
        : 0;
    const avgViews = activeShares > 0 ? (totalViews / activeShares).toFixed(1) : 0;

    return (
        <div className="space-y-8 animate-fade-in relative z-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <Link to="/admin" className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-blue-500 transition-all mb-2 tracking-widest">
                        <ArrowLeft size={16} />
                        Voltar ao Painel
                    </Link>
                    <h1 className="text-3xl font-bold text-slate-900 font-display">Rastreamento de Links</h1>
                    <p className="text-slate-500 font-medium">Shares públicos por arquivo. Acessos vêm da auditoria do backend.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={refreshShares} className="bg-white px-4 py-2 rounded-xl border border-slate-100 text-slate-600 hover:bg-slate-50 text-xs font-bold uppercase tracking-wider">
                        Recarregar
                    </button>
                    <div className="bg-amber-50 px-4 py-2 rounded-xl border border-amber-100 text-amber-700 flex items-center gap-2">
                        <ShieldAlert size={16} />
                        <span className="text-xs font-bold uppercase tracking-wider">Monitoramento Ativo</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Links Ativos</p>
                    <h3 className="text-2xl font-black text-slate-900">{activeShares}</h3>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total de Acessos</p>
                    <h3 className="text-2xl font-black text-blue-600">{totalViews}</h3>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Acessos / Link Ativo</p>
                    <h3 className="text-2xl font-black text-slate-900">{avgViews}</h3>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Taxa de Revogação</p>
                    <h3 className="text-2xl font-black text-red-500">{revokedRatio}%</h3>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
                <div className="p-8 border-b border-slate-50">
                    <div className="relative group max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar por token, rótulo, arquivo ou sinistro..."
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-200 transition-all font-bold text-sm"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/50">
                            <tr className="text-left border-b border-slate-100">
                                <th className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest">Arquivo / Sinistro</th>
                                <th className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest">Token / Rótulo</th>
                                <th className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest">Expira / Criado</th>
                                <th className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest">Acessos</th>
                                <th className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest">Status</th>
                                <th className="p-6 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading && (
                                <tr><td colSpan="6" className="p-10 text-center text-slate-400 text-xs uppercase tracking-widest">Carregando shares...</td></tr>
                            )}
                            {!loading && filteredShares.length === 0 && (
                                <tr><td colSpan="6" className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                                    {shares.length === 0 ? 'Nenhum share criado ainda. Vá em um sinistro → aba Gerenciamento.' : 'Nenhum link encontrado.'}
                                </td></tr>
                            )}
                            {!loading && filteredShares.map((s) => {
                                const created = s.created_at ? new Date(s.created_at).toLocaleDateString('pt-BR') : '-';
                                const expires = s.expires_at ? new Date(s.expires_at).toLocaleDateString('pt-BR') : 'sem expiração';
                                const accessCount = accessCounts[s.id] ?? 0;
                                return (
                                    <tr key={s.id} className="hover:bg-slate-50/50 transition-all group">
                                        <td className="p-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                                                    <LinkIcon size={18} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 text-sm truncate max-w-[260px]">{s._file?.name || '-'}</p>
                                                    <p className="text-[10px] text-slate-400 font-black uppercase">#{s._file?.claim?.number || s._file?.claim?.id?.slice(0, 8)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <p className="text-[10px] text-slate-500 font-mono break-all max-w-[220px]">{s.token}</p>
                                            <p className="text-[10px] text-slate-400 font-black uppercase">{s.label || 'sem rótulo'}</p>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                                <Calendar size={12} className="text-slate-400" /> {expires}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase mt-1">
                                                <User size={12} /> criado em {created}
                                                {s.created_by && (
                                                    <span className="text-slate-500"> · por {(resolveActorLabel?.(s.created_by) || actorLabelFromDbId(s.created_by, '—'))}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold w-fit">
                                                <Eye size={14} /> {accessCount}
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${s.revoked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                {s.revoked ? 'Revogado' : 'Ativo'}
                                            </span>
                                        </td>
                                        <td className="p-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => handleCopy(s.token)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-100 shadow-sm" title="Copiar Link">
                                                    <Copy size={16} />
                                                </button>
                                                <a href={`/portal/${s.token}`} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-100 shadow-sm" title="Abrir Portal">
                                                    <ExternalLink size={16} />
                                                </a>
                                                {!s.revoked && (
                                                    <button onClick={() => handleRevoke(s.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-100 shadow-sm" title="Revogar Acesso">
                                                        <XCircle size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

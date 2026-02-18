import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Link as LinkIcon,
    ExternalLink,
    Eye,
    Calendar,
    User,
    XCircle,
    CheckCircle2,
    Search,
    ArrowLeft,
    ShieldAlert,
    Copy,
    Trash2
} from 'lucide-react';
import { useClaims } from '../../context/ClaimsContext';

export default function LinkTracker() {
    const { links, setLinks } = useClaims();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredLinks = useMemo(() => {
        return links.filter(l =>
            l.claimNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            l.createdBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
            l.token.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [links, searchTerm]);

    const handleRevoke = (id) => {
        if (confirm('Deseja realmente revogar este acesso? O link deixará de funcionar imediatamente.')) {
            setLinks(prev => prev.map(l => l.id === id ? { ...l, status: 'Revogado' } : l));
        }
    };

    const handleCopy = (token) => {
        const url = `${window.location.origin}/portal/${token}`;
        navigator.clipboard.writeText(url);
        alert('Link copiado para a área de transferência!');
    };

    return (
        <div className="space-y-8 animate-fade-in relative z-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <Link to="/admin" className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-blue-500 transition-all mb-2 tracking-widest">
                        <ArrowLeft size={16} />
                        Voltar ao Painel
                    </Link>
                    <h1 className="text-3xl font-bold text-slate-900 font-display">Rastreamento de Links</h1>
                    <p className="text-slate-500 font-medium">Gestão global de acessos externos e auditoria de compartilhamento.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-amber-50 px-4 py-2 rounded-xl border border-amber-100 text-amber-700 flex items-center gap-2">
                        <ShieldAlert size={16} />
                        <span className="text-xs font-bold uppercase tracking-wider">Monitoramento Ativo</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Links Ativos</p>
                    <h3 className="text-2xl font-black text-slate-900">{links.filter(l => l.status === 'Ativo').length}</h3>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total de Visualizações</p>
                    <h3 className="text-2xl font-black text-blue-600">{links.reduce((acc, l) => acc + l.views, 0)}</h3>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Visualizações/Link (Média)</p>
                    <h3 className="text-2xl font-black text-slate-900">{links.length > 0 ? (links.reduce((acc, l) => acc + l.views, 0) / links.length).toFixed(1) : 0}</h3>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Taxa de Revogação</p>
                    <h3 className="text-2xl font-black text-red-500">{links.length > 0 ? Math.round((links.filter(l => l.status === 'Revogado').length / links.length) * 100) : 0}%</h3>
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
                            placeholder="Buscar por sinistro, criador ou token..."
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-200 transition-all font-bold text-sm"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/50">
                            <tr className="text-left border-b border-slate-100">
                                <th className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest">Token / Sinistro</th>
                                <th className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest">Criador / Data</th>
                                <th className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest">Visualizações</th>
                                <th className="p-6 font-black text-slate-400 text-[10px] uppercase tracking-widest">Status</th>
                                <th className="p-6 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredLinks.length > 0 ? filteredLinks.map((link) => (
                                <tr key={link.id} className="hover:bg-slate-50/50 transition-all group">
                                    <td className="p-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                                                <LinkIcon size={18} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900 text-sm">#{link.claimNumber}</p>
                                                <p className="text-[10px] text-slate-400 font-black font-mono">{link.token}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                                <User size={12} className="text-slate-400" /> {link.createdBy}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase">
                                                <Calendar size={12} /> {link.createdAt}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold">
                                                <Eye size={14} /> {link.views}
                                            </div>
                                            {link.lastAccessed && (
                                                <span className="text-[10px] font-black text-slate-300 uppercase">Último: {link.lastAccessed}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${link.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {link.status}
                                        </span>
                                    </td>
                                    <td className="p-6 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleCopy(link.token)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-100 shadow-sm"
                                                title="Copiar Link"
                                            >
                                                <Copy size={16} />
                                            </button>
                                            <a
                                                href={`/portal/${link.token}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-100 shadow-sm"
                                                title="Abrir Portal"
                                            >
                                                <ExternalLink size={16} />
                                            </a>
                                            {link.status === 'Ativo' && (
                                                <button
                                                    onClick={() => handleRevoke(link.id)}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-100 shadow-sm"
                                                    title="Revogar Acesso"
                                                >
                                                    <XCircle size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                                        Nenhum link encontrado para esta pesquisa.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

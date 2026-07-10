import { useState, useMemo, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Filter, Plus, FileText, ChevronRight, ChevronDown, X, Calendar, Building2, AlertCircle, Circle, ArrowLeft, Briefcase } from 'lucide-react';
import { useClaims } from '../context/ClaimsContext';
import { STATUS_COLORS, INSURERS_CONFIG } from '../constants/config';
import Badge from '../components/Badge';

/**
 * Utility to parse 'DD/MM/YYYY' strings into Date objects.
 * Essential for consistent sorting across different browsers.
 * 
 * @param {string} dateStr - Date string in DD/MM/YYYY format
 * @returns {Date} Parsed Date object
 */
const parseDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    const [day, month, year] = dateStr.split('/').map(Number);
    return new Date(year, month - 1, day);
};

/**
 * Claims List Page Component.
 * centralized work queue with advanced filtering and robust sorting.
 */
export default function ClaimsList() {
    const { claims, claimsLoading, claimsError, claimsTotal, refreshClaims, currentUser, backendUsers } = useClaims();
    const location = useLocation();
    const navigate = useNavigate();

    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [activeTab, setActiveTab] = useState('ativos');
    const [onlyMine, setOnlyMine] = useState(false);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    // Resolve "current user db UUID" by matching the front-only INITIAL_USERS
    // email against the real backend list (manager+ only). Viewer/contributor
    // can't fetch /users so the toggle is hidden for them.
    const myDbId = (() => {
        if (!currentUser?.email || !Array.isArray(backendUsers) || backendUsers.length === 0) return null;
        const hit = backendUsers.find(u => (u.email || '').toLowerCase() === currentUser.email.toLowerCase());
        return hit?.id || null;
    })();

    // Push tab + assignment filter to backend query.
    useEffect(() => {
        if (!refreshClaims) return;
        const opts = {
            page,
            limit: PAGE_SIZE,
            ...(activeTab === 'concluidos' ? { status: 'done' } : {}),
            ...(onlyMine && myDbId ? { assignedTo: myDbId } : {}),
        };
        refreshClaims(opts);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, onlyMine, page, myDbId]);

    // Reset to page 1 whenever filters change (the dependency below keeps
    // page=1 stable on first mount).
    useEffect(() => { setPage(1); }, [activeTab, onlyMine]);

    const [filterInsurer, setFilterInsurer] = useState('');
    const [filterBroker, setFilterBroker] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterCritico, setFilterCritico] = useState(false);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    // MEMOIZED: Filtered and Sorted Claims
    const filteredClaims = useMemo(() => {
        const filtered = claims.filter(c => {
            if (activeTab === 'ativos' && c.status === 'Concluído') return false;
            if (activeTab === 'concluidos' && c.status !== 'Concluído') return false;

            const matchesSearch =
                c.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.insurer.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesInsurer = !filterInsurer || c.insurer === filterInsurer;
            const matchesBroker = !filterBroker || c.broker === filterBroker;
            const matchesStatus = !filterStatus || c.status === filterStatus;

            const claimDate = parseDate(c.date).getTime();
            const matchesDate = (!dateRange.start || claimDate >= new Date(dateRange.start).getTime()) &&
                (!dateRange.end || claimDate <= new Date(dateRange.end).getTime());

            const isCritico = (c.deadline?.remainingDays || 30) < 5 && !c.deadline?.isSuspended && c.status !== 'Concluído';
            const matchesCritico = !filterCritico || isCritico;

            return matchesSearch && matchesInsurer && matchesBroker && matchesStatus && matchesCritico && matchesDate;
        });

        // Robust Sorting: Priority to most recent and critical
        return [...filtered].sort((a, b) => {
            const dateA = parseDate(a.lastModified || a.date).getTime();
            const dateB = parseDate(b.lastModified || b.date).getTime();

            if (dateB !== dateA) return dateB - dateA;

            // Tie-breaker: Urgency by SLA
            return (a.deadline?.remainingDays || 30) - (b.deadline?.remainingDays || 30);
        });
    }, [claims, searchTerm, filterInsurer, filterStatus, filterCritico, activeTab]);

    return (
        <div className="space-y-8 relative z-10 animate-fade-in pb-20">
            {claimsError && (
                <div className="flex items-start gap-4 p-5 bg-red-50 border border-red-200 rounded-2xl shadow-sm">
                    <AlertCircle size={20} className="text-red-600 mt-0.5 shrink-0" />
                    <div className="flex-1 space-y-1">
                        <p className="text-sm font-bold text-red-800">Falha ao carregar sinistros do servidor</p>
                        <p className="text-xs text-red-700 font-medium">{claimsError}</p>
                    </div>
                    <button
                        onClick={() => refreshClaims?.()}
                        disabled={claimsLoading}
                        className="px-4 py-2 bg-white border border-red-200 text-red-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all disabled:opacity-50"
                    >
                        {claimsLoading ? 'Recarregando...' : 'Tentar novamente'}
                    </button>
                </div>
            )}

            {/* Header Section */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 bg-white/40 p-6 rounded-3xl border border-white/60 backdrop-blur-md shadow-sm">
                <div className="space-y-2">
                    <Link to=".." className="inline-flex items-center gap-2 group text-[10px] font-black uppercase text-gray-400 hover:text-secondary transition-all tracking-widest">
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Voltar ao Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold text-primary font-display flex items-center gap-3">
                        Fila de Sinistros
                        <span className="text-xs font-medium px-2 py-1 bg-primary/5 text-primary/60 rounded-md border border-primary/10">
                            {filteredClaims.length} processos
                        </span>
                    </h1>
                </div>
                {(currentUser?.backRole === 'manager' || currentUser?.backRole === 'admin') && (
                    <Link to="novo" className="w-full lg:w-auto bg-secondary text-white px-8 py-3.5 rounded-2xl font-bold hover:bg-secondary-hover transition-all shadow-xl shadow-secondary/20 flex items-center justify-center gap-2 group">
                        <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                        Novo Sinistro
                    </Link>
                )}
            </div>

            {/* Navigation & Search Bar */}
            <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
                <div className="flex p-1.5 bg-gray-100/80 rounded-2xl border border-gray-200/50 backdrop-blur-sm shadow-inner">
                    <button
                        onClick={() => setActiveTab('ativos')}
                        className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'ativos' ? 'bg-white shadow-lg text-primary scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Ativos
                    </button>
                    <button
                        onClick={() => setActiveTab('concluidos')}
                        className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'concluidos' ? 'bg-white shadow-lg text-primary scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Concluídos
                    </button>
                    {myDbId && (
                        <button
                            onClick={() => setOnlyMine(!onlyMine)}
                            className={`ml-1 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${onlyMine ? 'bg-indigo-600 shadow-lg text-white scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}
                            title="Filtrar sinistros atribuídos a você (server-side via /processes?assigned_to=)"
                        >
                            Atribuídos a mim
                        </button>
                    )}
                </div>

                <div className="flex flex-1 items-center gap-3">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-secondary transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar por número, título ou seguradora..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-14 pr-6 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-secondary/5 focus:border-secondary transition-all text-sm font-medium outline-none shadow-sm placeholder:text-gray-300"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`px-6 py-4 rounded-2xl border transition-all flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest ${showFilters || filterInsurer || filterBroker || filterStatus || filterCritico || dateRange.start || dateRange.end ? 'bg-primary text-white border-primary shadow-xl shadow-primary/20' : 'bg-white border-gray-200 text-gray-600 hover:border-secondary hover:text-secondary hover:shadow-md'}`}
                    >
                        <Filter size={18} />
                        <span className="hidden sm:inline">Filtros</span>
                        {(filterInsurer || filterBroker || filterStatus || filterCritico || dateRange.start || dateRange.end) && (
                            <span className="ml-1 w-2 h-2 bg-secondary rounded-full border-2 border-white animate-pulse"></span>
                        )}
                    </button>
                </div>
            </div>

            {/* Advanced Filters Panel */}
            {showFilters && (
                <div className="p-8 bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl animate-scale-up space-y-8 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-3 h-full bg-secondary"></div>
                    <div className="flex items-center justify-between pb-6 border-b border-gray-50">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                                <Filter size={20} />
                            </div>
                            <div className="flex flex-col">
                                <h3 className="text-sm font-black text-primary uppercase tracking-widest">Painel de Visualização</h3>
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">Configure a filtragem avançada</span>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setFilterInsurer('');
                                setFilterBroker('');
                                setFilterStatus('');
                                setFilterCritico(false);
                                setDateRange({ start: '', end: '' });
                            }}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[9px] font-black text-gray-400 hover:text-red-500 hover:bg-red-50 uppercase tracking-widest transition-all border border-transparent hover:border-red-100"
                        >
                            <X size={14} /> Limpar Filtros
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Building2 size={12} className="text-secondary" /> Seguradora
                            </label>
                            <div className="relative">
                                <select
                                    value={filterInsurer}
                                    onChange={(e) => setFilterInsurer(e.target.value)}
                                    className="w-full p-4 bg-gray-50/50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-secondary/10 focus:bg-white focus:border-secondary transition-all cursor-pointer appearance-none shadow-sm pr-10"
                                >
                                    <option value="">Todas as Seguradoras</option>
                                    {Object.keys(INSURERS_CONFIG).map(name => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Circle size={12} className="text-secondary" /> Status do Processo
                            </label>
                            <div className="relative">
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="w-full p-4 bg-gray-50/50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-secondary/10 focus:bg-white focus:border-secondary transition-all cursor-pointer appearance-none shadow-sm pr-10"
                                >
                                    <option value="">Todos os Status</option>
                                    {Object.keys(STATUS_COLORS).map(status => (
                                        <option key={status} value={status}>{status}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Building2 size={12} className="text-secondary" /> Corretora
                            </label>
                            <div className="relative">
                                <select
                                    value={filterBroker}
                                    onChange={(e) => setFilterBroker(e.target.value)}
                                    className="w-full p-4 bg-gray-50/50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-secondary/10 focus:bg-white focus:border-secondary transition-all cursor-pointer appearance-none shadow-sm pr-10"
                                >
                                    <option value="">Todas as Corretoras</option>
                                    <option value="Silva Seguros">Silva Seguros</option>
                                    <option value="ABC Corretora">ABC Corretora</option>
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Calendar size={12} className="text-secondary" /> Período de Abertura
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                    className="flex-1 p-3 bg-gray-50/50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-secondary/10 focus:bg-white transition-all shadow-sm"
                                />
                                <span className="text-gray-300 font-bold">à</span>
                                <input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                    className="flex-1 p-3 bg-gray-50/50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-secondary/10 focus:bg-white transition-all shadow-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <AlertCircle size={12} className="text-secondary" /> Nível de Atenção
                            </label>
                            <button
                                onClick={() => setFilterCritico(!filterCritico)}
                                className={`w-full p-4 rounded-2xl border font-bold text-xs transition-all flex items-center justify-center gap-3 ${filterCritico ? 'bg-red-50 border-red-200 text-red-600 shadow-inner translate-y-0.5' : 'bg-gray-50/50 border-gray-100 text-gray-400 hover:bg-white hover:border-gray-200 shadow-sm'}`}
                            >
                                <div className={`w-2.5 h-2.5 rounded-full ${filterCritico ? 'bg-red-600 animate-pulse' : 'bg-gray-300'}`}></div>
                                Sinistros Críticos (&lt; 5 dias)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter Badges List */}
            {(filterInsurer || filterBroker || filterStatus || filterCritico || dateRange.start || dateRange.end) && (
                <div className="flex flex-wrap gap-2 animate-fade-in py-1">
                    {filterInsurer && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-secondary/5 text-secondary border border-secondary/10 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm group/badge">
                            <Building2 size={12} /> {filterInsurer}
                            <button onClick={() => setFilterInsurer('')} className="hover:bg-red-500 hover:text-white rounded-lg p-0.5 transition-all">
                                <X size={12} />
                            </button>
                        </div>
                    )}
                    {filterBroker && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-secondary/5 text-secondary border border-secondary/10 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm group/badge">
                            <Briefcase size={12} /> {filterBroker}
                            <button onClick={() => setFilterBroker('')} className="hover:bg-red-500 hover:text-white rounded-lg p-0.5 transition-all">
                                <X size={12} />
                            </button>
                        </div>
                    )}
                    {filterStatus && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-secondary/5 text-secondary border border-secondary/10 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm group/badge">
                            <Circle size={12} /> {filterStatus}
                            <button onClick={() => setFilterStatus('')} className="hover:bg-red-500 hover:text-white rounded-lg p-0.5 transition-all">
                                <X size={12} />
                            </button>
                        </div>
                    )}
                    {filterCritico && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm group/badge">
                            <AlertCircle size={12} /> Sinistros Críticos
                            <button onClick={() => setFilterCritico(false)} className="hover:bg-red-600 hover:text-white rounded-lg p-0.5 transition-all">
                                <X size={12} />
                            </button>
                        </div>
                    )}
                    {(dateRange.start || dateRange.end) && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm group/badge">
                            <Calendar size={12} /> {dateRange.start || '...'} à {dateRange.end || '...'}
                            <button onClick={() => setDateRange({ start: '', end: '' })} className="hover:bg-red-600 hover:text-white rounded-lg p-0.5 transition-all">
                                <X size={12} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Claims Table Section */}
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden animate-slide-up">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50/40">
                            <tr className="text-left border-b border-gray-100">
                                <th className="p-7 font-black text-gray-400 text-[10px] uppercase tracking-widest">Processo nº</th>
                                <th className="p-7 font-black text-gray-400 text-[10px] uppercase tracking-widest">Parceiro / Seguradora</th>
                                <th className="p-7 font-black text-gray-400 text-[10px] uppercase tracking-widest">Status / Fase</th>
                                <th className="p-7 font-black text-gray-400 text-[10px] uppercase tracking-widest">SLA / Evolução</th>
                                <th className="p-7"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50/50">
                            {filteredClaims.length > 0 ? (
                                filteredClaims.map((claim) => (
                                    <tr
                                        key={claim.id}
                                        onClick={() => navigate(`${claim.id}`)}
                                        className="hover:bg-secondary/[0.02] transition-all cursor-pointer group"
                                    >
                                        <td className="p-7">
                                            <div className="flex items-center gap-5">
                                                <div className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center font-bold text-xs shadow-lg shadow-primary/10 group-hover:scale-105 transition-all">
                                                    SD
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-primary text-base group-hover:text-secondary transition-colors underline-offset-4 group-hover:underline">{claim.number}</span>
                                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate max-w-[200px]">{claim.title}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-7">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-secondary shadow-lg shadow-secondary/40 animate-pulse"></div>
                                                <span className="text-xs font-bold text-gray-600">{claim.insurer}</span>
                                            </div>
                                        </td>
                                        <td className="p-7">
                                            <Badge colorClass={STATUS_COLORS[claim.status]}>{claim.status}</Badge>
                                        </td>
                                        <td className="p-7">
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Completude: {claim.progress}%</span>
                                                </div>
                                                <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                                                    <div
                                                        className="bg-secondary h-full transition-all duration-700 shadow-[0_0_12px_rgba(38,166,154,0.4)]"
                                                        style={{ width: `${claim.progress}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-7 text-right">
                                            <div className="flex items-center justify-end gap-3 translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] font-black text-secondary uppercase tracking-widest">Visualizar</span>
                                                    <span className="text-[8px] font-bold text-gray-300 uppercase tracking-tighter">Detalhes do Sinistro</span>
                                                </div>
                                                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                                                    <ChevronRight size={20} />
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="p-32 text-center">
                                        <div className="flex flex-col items-center gap-6 animate-fade-in">
                                            <div className="w-24 h-24 rounded-[2rem] bg-gray-50 flex items-center justify-center text-gray-200 border border-gray-100 shadow-inner">
                                                <Search size={48} className="rotate-12" />
                                            </div>
                                            <div className="space-y-2">
                                                <h4 className="text-lg font-bold text-gray-900">Nenhum resultado encontrado</h4>
                                                <p className="text-sm text-gray-400 max-w-xs mx-auto">Tente ajustar seus filtros ou termos de pesquisa para encontrar o que procura.</p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setSearchTerm('');
                                                    setFilterInsurer('');
                                                    setFilterStatus('');
                                                    setFilterCritico(false);
                                                }}
                                                className="px-6 py-3 bg-primary/5 hover:bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all border border-primary/5"
                                            >
                                                Redefinir Filtros
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination — driven by backend total. Hidden when result fits a single page. */}
                {claimsTotal > PAGE_SIZE && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                            Página {page} de {Math.max(1, Math.ceil(claimsTotal / PAGE_SIZE))} · {claimsTotal} sinistros no total
                        </p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                disabled={page <= 1 || claimsLoading}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Anterior
                            </button>
                            <button
                                type="button"
                                disabled={page >= Math.ceil(claimsTotal / PAGE_SIZE) || claimsLoading}
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

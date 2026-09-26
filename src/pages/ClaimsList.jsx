import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Plus, ChevronDown, X, Calendar, Building2, AlertCircle, Circle, ArrowLeft, Briefcase, RefreshCw, Clock, CalendarDays } from 'lucide-react';
import { useClaims } from '../context/ClaimsContext';
import { useCan } from '../context/PermissionsContext';
import { STATUS_COLORS, INSURERS_CONFIG } from '../constants/config';
import { deadlineInfo, isCriticalClaim, urgencyKey, CRITICAL_DAYS } from '../constants/deadline';
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
 * Quanto falta do prazo, dito como o cartão mostra. Usa o início e o
 * vencimento que vêm em cada processo da lista — buscar o prazo de cada cartão
 * seria uma chamada por sinistro.
 */
function prazoInfo(claim) {
    const { state, daysLeft: n } = deadlineInfo(claim);
    if (state === 'closed') return { text: 'Encerrado', tone: 'text-gray-400' };
    if (state === 'waiting') return { text: 'Aguardando documentos', tone: 'text-gray-500' };
    if (state === 'overdue') return { text: 'Vencido', tone: 'text-red-600' };
    const text = n === 0 ? 'Vence hoje' : `${n} ${n === 1 ? 'dia' : 'dias'}`;
    if (n <= CRITICAL_DAYS) return { text, tone: 'text-red-600' };
    if (n < 10) return { text, tone: 'text-amber-600' };
    return { text, tone: 'text-secondary' };
}

function ClaimCard({ claim }) {
    const progress = Math.max(0, Math.min(100, Number(claim.progress) || 0));
    const prazo = prazoInfo(claim);
    return (
        <Link
            to={`${claim.id}`}
            data-testid="album-card"
            aria-label={`SD - ${claim.number}: ${claim.title}`}
            className="group h-full flex flex-col gap-4 p-5 rounded-2xl bg-white/70 backdrop-blur-md border border-white/60 shadow-[0_10px_30px_-12px_rgba(26,43,83,0.12)] hover:shadow-[0_18px_40px_-14px_rgba(26,43,83,0.25)] hover:-translate-y-0.5 hover:border-secondary/30 transition-all outline-none focus-visible:ring-4 focus-visible:ring-secondary/20"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-display text-lg font-extrabold text-primary leading-tight group-hover:text-secondary transition-colors truncate">SD - {claim.number}</p>
                    <p className="text-sm font-semibold text-gray-700 mt-1 line-clamp-2">{claim.title}</p>
                </div>
                <span className="shrink-0"><Badge colorClass={STATUS_COLORS[claim.status] || 'bg-gray-100 text-gray-700'}>{claim.status}</Badge></span>
            </div>

            <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 min-w-0">
                <Building2 size={14} className="text-secondary shrink-0" />
                <span className="truncate">{claim.insurer || 'Seguradora não informada'}</span>
            </p>

            <div>
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Completude</span>
                    <span className="text-xs font-extrabold text-primary" data-testid="album-progress">{progress}%</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-gray-200 overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Completude">
                    <div className="h-full bg-secondary rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                </div>
            </div>

            <div className="mt-auto pt-3 border-t border-gray-100 grid grid-cols-2 gap-3">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1"><Clock size={11} /> Prazo</p>
                    <p className={`text-sm font-extrabold mt-0.5 ${prazo.tone}`} data-testid="album-prazo">{prazo.text}</p>
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1"><CalendarDays size={11} /> Aberto em</p>
                    <p className="text-sm font-extrabold text-primary mt-0.5">{claim.date || '—'}</p>
                </div>
            </div>
        </Link>
    );
}

/**
 * Claims List Page Component.
 * centralized work queue with advanced filtering and robust sorting.
 */
export default function ClaimsList() {
    const { claims, claimsLoading, claimsError, claimsTotal, refreshClaims } = useClaims();
    const can = useCan();

    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [activeTab, setActiveTab] = useState('ativos');
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    // A aba vai para o servidor como filtro de status.
    useEffect(() => {
        if (!refreshClaims) return;
        refreshClaims({
            page,
            limit: PAGE_SIZE,
            ...(activeTab === 'concluidos' ? { status: 'done' } : {}),
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, page]);

    // Trocar de aba volta para a primeira página.
    useEffect(() => { setPage(1); }, [activeTab]);

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

            const matchesCritico = !filterCritico || isCriticalClaim(c);

            return matchesSearch && matchesInsurer && matchesBroker && matchesStatus && matchesCritico && matchesDate;
        });

        // Robust Sorting: Priority to most recent and critical
        return [...filtered].sort((a, b) => {
            const dateA = parseDate(a.lastModified || a.date).getTime();
            const dateB = parseDate(b.lastModified || b.date).getTime();

            if (dateB !== dateA) return dateB - dateA;

            // Tie-breaker: Urgency by SLA
            return urgencyKey(a) - urgencyKey(b);
        });
    }, [claims, searchTerm, filterInsurer, filterBroker, filterStatus, filterCritico, dateRange, activeTab]);

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
                {can('processo.criar') && (
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
                    <button
                        type="button"
                        onClick={() => refreshClaims?.()}
                        disabled={claimsLoading}
                        aria-label="Atualizar lista de sinistros"
                        title="Atualizar"
                        className="px-4 py-4 rounded-2xl border bg-white border-gray-200 text-gray-600 hover:border-secondary hover:text-secondary hover:shadow-md transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={18} className={claimsLoading ? 'animate-spin' : ''} />
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
                                Sinistros Críticos (até {CRITICAL_DAYS} dias)
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

            {/* Álbum: um cartão por sinistro */}
            <div className="animate-slide-up">
                {filteredClaims.length > 0 ? (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5" data-testid="album-sinistros">
                        {filteredClaims.map((claim) => (
                            <li key={claim.id}>
                                <ClaimCard claim={claim} />
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="py-24 px-6 text-center bg-white/70 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm">
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
                                    setFilterBroker('');
                                    setFilterStatus('');
                                    setFilterCritico(false);
                                    setDateRange({ start: '', end: '' });
                                }}
                                className="px-6 py-3 bg-primary/5 hover:bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all border border-primary/5"
                            >
                                Redefinir Filtros
                            </button>
                        </div>
                    </div>
                )}

                {/* Pagination — driven by backend total. Hidden when result fits a single page. */}
                {claimsTotal > PAGE_SIZE && (
                    <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 rounded-2xl bg-white/70 border border-white/60 shadow-sm">
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

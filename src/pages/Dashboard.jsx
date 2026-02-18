import { useMemo } from 'react';
import { BarChart3, Clock, CheckCircle2, AlertCircle, FileText, TrendingUp, Shield, ArrowRight, Search } from 'lucide-react';
import { useClaims } from '../context/ClaimsContext';
import { useNavigate } from 'react-router-dom';

/**
 * Individual Stat Card for the Dashboard.
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - Label of the stat
 * @param {string|number} props.value - Value to display
 * @param {React.ElementType} props.icon - Lucide icon component
 * @param {string} props.color - CSS background color class
 * @param {number} [props.trend] - Percentage trend to meta
 * @param {Function} [props.onClick] - Click handler for navigation
 */
const StatCard = ({ title, value, icon: Icon, color, trend, onClick }) => (
    <div
        onClick={onClick}
        className={`card flex items-start justify-between cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] group ${onClick ? 'hover:shadow-xl hover:border-blue-200' : ''}`}
    >
        <div className="flex-1">
            <p className="text-sm text-gray-500 font-medium mb-1">{title}</p>
            <h3 className="text-2xl font-bold text-gray-900 font-display">{value}</h3>
            {trend && (
                <p className={`text-xs mt-2 flex items-center gap-1 ${trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {trend !== 0 && <TrendingUp size={12} />}
                    <span>{trend > 0 ? '+' : ''}{trend}% em relação à meta</span>
                </p>
            )}
            <div className="mt-4 flex items-center gap-1 text-[10px] font-bold text-blue-600 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                Ver Detalhes <ArrowRight size={10} />
            </div>
        </div>
        <div className={`p-3 rounded-xl ${color} shadow-lg shadow-blue-100`}>
            <Icon size={24} className="text-white" />
        </div>
    </div>
);

/**
 * Operational Dashboard Page.
 * Displays real-time metrics, recent activities, and portfolio health.
 */
export default function Dashboard() {
    const { claims, currentUser } = useClaims();
    const navigate = useNavigate();

    // MEMOIZED: Multi-Tenancy Filter (Simulado)
    const myClaims = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === 'ADMIN') return claims;
        return claims.filter(c => c.insurer === currentUser.company || c.broker === currentUser.company);
    }, [claims, currentUser]);

    // MEMOIZED: Portfolio Calculations
    const portfolioStats = useMemo(() => {
        const total = myClaims.length;
        const inAnal = myClaims.filter(c => c.status === 'Em Análise').length;
        const comp = myClaims.filter(c => c.status === 'Concluído').length;
        const crit = myClaims.filter(c => (c.deadline?.remainingDays || 30) < 5 && !c.deadline?.isSuspended && c.status !== 'Concluído').length;
        const avg = total > 0 ? Math.round(myClaims.reduce((acc, c) => acc + (c.progress || 0), 0) / total) : 0;

        return { total, inAnal, comp, crit, avg };
    }, [myClaims]);

    // MEMOIZED: Activity Feed
    const allActivities = useMemo(() => {
        return myClaims.flatMap(c =>
            (c.activities || []).map(a => ({ ...a, claimNumber: c.number, claimTitle: c.title, claimId: c.id }))
        ).sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
        }).slice(0, 6);
    }, [myClaims]);

    // MEMOIZED: Completion by folder
    const categoryStats = useMemo(() => {
        const categories = [
            { label: 'Causa', key: 'causa', color: 'bg-blue-600' },
            { label: 'Prejuízo', key: 'prejuizo', color: 'bg-amber-500' },
            { label: 'Liquidação', key: 'liquidacao', color: 'bg-indigo-500' },
            { label: 'Gerencial', key: 'gerencial', color: 'bg-green-600' },
        ];

        return categories.map(cat => {
            const avg = portfolioStats.total > 0
                ? Math.round(myClaims.reduce((acc, c) => acc + ((c.folders || []).find(f => f.category === cat.key)?.completion || 0), 0) / portfolioStats.total)
                : 0;
            return { ...cat, value: avg };
        });
    }, [myClaims, portfolioStats.total]);

    const { total, inAnal, comp, crit, avg } = portfolioStats;

    return (
        <div className="space-y-8 animate-fade-in relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 font-display">Painel Operacional {currentUser?.role !== 'ADMIN' && `| ${currentUser?.company}`}</h1>
                    <p className="text-gray-500">Olá, <span className="font-bold text-gray-700">{currentUser?.name}</span>. Resumo da sua carteira hoje.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 text-blue-700 flex items-center gap-2">
                        <Shield size={16} />
                        <span className="text-xs font-bold uppercase tracking-wider">Conformidade: {currentUser?.role}</span>
                    </div>
                </div>
            </div>

            {/* Top Progress Card */}
            <div className="!bg-gradient-to-br !from-slate-900 !to-blue-900 p-8 rounded-[2.5rem] text-white border-0 shadow-2xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full -mr-40 -mt-40 blur-[80px] group-hover:bg-blue-500/20 transition-all duration-1000"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-10 py-4">
                    <div className="w-40 h-40 relative shrink-0">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="16" fill="transparent" className="text-white/5" />
                            <circle
                                cx="80"
                                cy="80"
                                r="70"
                                stroke="currentColor"
                                strokeWidth="16"
                                fill="transparent"
                                strokeDasharray={440}
                                strokeDashoffset={isNaN(avg) ? 440 : 440 - (440 * avg) / 100}
                                strokeLinecap="round"
                                className="text-blue-400 transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(96,165,250,0.5)]"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-4xl font-black">{avg}%</span>
                            <span className="text-[10px] uppercase font-black opacity-40 tracking-widest mt-1">SLA Global</span>
                        </div>
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h2 className="text-3xl font-black font-display mb-3 tracking-tight">Status de Performance</h2>
                        <p className="text-blue-100/70 text-sm max-w-lg leading-relaxed font-medium">
                            {currentUser?.role === 'CORRETOR'
                                ? "Sua eficiência na entrega de documentos impacta diretamente na liquidação do seu cliente."
                                : "Acompanhe o progresso médio dos seus processos e identifique gargalos operacionais."}
                            <br /><br />
                            Você possui <strong className="text-white bg-red-500 px-2 py-0.5 rounded ml-1">{crit} processos críticos</strong> em sua carteira.
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => navigate('/app/sinistros')}
                            className="bg-blue-600 border border-blue-400 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/40"
                        >
                            Ver Carteira Completa
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Processos Ativos"
                    value={total}
                    icon={FileText}
                    color="bg-slate-800"
                    trend={5}
                    onClick={() => navigate('/app/sinistros')}
                />
                <StatCard
                    title="Em Análise"
                    value={inAnal}
                    icon={Clock}
                    color="bg-blue-600"
                    onClick={() => navigate('/app/sinistros?status=Em%20Análise')}
                />
                <StatCard
                    title="Liquidado / Concluído"
                    value={comp}
                    icon={CheckCircle2}
                    color="bg-emerald-600"
                    onClick={() => navigate('/app/sinistros?status=Concluído')}
                />
                <StatCard
                    title="Atenção Crítica"
                    value={crit}
                    icon={AlertCircle}
                    color="bg-red-500"
                    onClick={() => navigate('/app/sinistros?filter=critico')}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Activity */}
                <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl overflow-hidden relative">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-black text-slate-900 font-display uppercase tracking-tight">Timeline de Atualizações</h3>
                            <p className="text-xs text-slate-400 font-medium tracking-tight">Últimas interações nos seus processos</p>
                        </div>
                    </div>
                    <div className="space-y-8 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-50">
                        {allActivities.length > 0 ? allActivities.map((activity, idx) => (
                            <div
                                key={idx}
                                className="flex gap-6 group cursor-pointer relative z-10"
                                onClick={() => navigate(`/app/sinistros/${activity.claimId}`)}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border-4 border-white shadow-sm transition-all duration-300 ${activity.type === 'UPLOAD' ? 'bg-blue-600 text-white' :
                                    activity.type === 'VIEW' ? 'bg-indigo-600 text-white' :
                                        'bg-slate-800 text-white'
                                    }`}>
                                    <FileText size={18} />
                                </div>
                                <div className="flex-1 pb-2">
                                    <p className="text-sm font-bold text-slate-800 leading-tight">
                                        <span className="text-blue-600">{activity.user}</span> {activity.action}
                                    </p>
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-lg font-black uppercase tracking-widest">#{activity.claimNumber}</span>
                                        <span className="text-[10px] text-slate-300 font-bold uppercase">{activity.date}</span>
                                    </div>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ArrowRight size={16} className="text-blue-400" />
                                </div>
                            </div>
                        )) : (
                            <div className="py-20 text-center flex flex-col items-center gap-4">
                                <Search size={40} className="text-slate-100" />
                                <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Sem movimentações recentes.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Performance by Category */}
                <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl">
                    <h3 className="text-lg font-black text-slate-900 font-display uppercase tracking-tight mb-8">Evolução por Fase</h3>
                    <div className="space-y-8">
                        {categoryStats.map((cat) => (
                            <div key={cat.label} className="group">
                                <div className="flex justify-between items-end mb-3">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{cat.label}</span>
                                    <span className="text-sm font-black text-slate-900">{cat.value}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
                                    <div
                                        className={`${cat.color} h-full rounded-full transition-all duration-1000 shadow-md`}
                                        style={{ width: `${cat.value}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-12 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                        <div className="flex items-center gap-3 mb-4">
                            <TrendingUp size={20} className="text-blue-500" />
                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Meta de Performance</p>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">
                            A média do ecossistema para a fase de <strong>Causa</strong> é de 85%. Você está operando {portfolioStats.avg > 80 ? 'acima' : 'abaixo'} da média nacional.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

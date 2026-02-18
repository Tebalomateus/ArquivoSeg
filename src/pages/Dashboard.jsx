import { useMemo } from 'react';
import { BarChart3, Clock, CheckCircle2, AlertCircle, FileText, TrendingUp, Shield, ArrowRight } from 'lucide-react';
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

    // MEMOIZED: Portfolio Calculations
    // Using useMemo to prevent expensive re-calculations on every render
    const portfolioStats = useMemo(() => {
        const safeClaims = claims || [];
        const total = safeClaims.length;
        const inAnal = safeClaims.filter(c => c.status === 'Em Análise').length;
        const comp = safeClaims.filter(c => c.status === 'Concluído').length;
        const crit = safeClaims.filter(c => (c.deadline?.remainingDays || 30) < 5 && !c.deadline?.isSuspended && c.status !== 'Concluído').length;
        const avg = total > 0 ? Math.round(safeClaims.reduce((acc, c) => acc + (c.progress || 0), 0) / total) : 0;

        return { total, inAnal, comp, crit, avg, safeClaims };
    }, [claims]);

    // MEMOIZED: Activity Feed
    const allActivities = useMemo(() => {
        return portfolioStats.safeClaims.flatMap(c =>
            (c.activities || []).map(a => ({ ...a, claimNumber: c.number, claimTitle: c.title, claimId: c.id }))
        ).sort((a, b) => {
            // Robust sorting handling potential invalid dates
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
        }).slice(0, 6);
    }, [portfolioStats.safeClaims]);

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
                ? Math.round(portfolioStats.safeClaims.reduce((acc, c) => acc + ((c.folders || []).find(f => f.category === cat.key)?.completion || 0), 0) / portfolioStats.total)
                : 0;
            return { ...cat, value: avg };
        });
    }, [portfolioStats.safeClaims, portfolioStats.total]);

    const { total, inAnal, comp, crit, avg, safeClaims } = portfolioStats;

    return (
        <div className="space-y-8 animate-fade-in relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 font-display">Dashboard Operacional</h1>
                    <p className="text-gray-500">Olá, <span className="font-bold text-gray-700">{currentUser?.name}</span>. Resumo da carteira hoje ({new Date().toLocaleDateString('pt-BR')}).</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            if (confirm('Isso irá resetar todos os dados e limpar o cache. Continuar?')) {
                                localStorage.clear();
                                window.location.reload();
                            }
                        }}
                        className="text-[10px] font-bold text-gray-400 hover:text-red-500 uppercase tracking-widest transition-colors mr-4"
                    >
                        Resetar Sistema
                    </button>
                    <div className="flex -space-x-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">
                                {String.fromCharCode(64 + i)}
                            </div>
                        ))}
                        <div className="w-8 h-8 rounded-full border-2 border-white bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
                            +5
                        </div>
                    </div>
                    <div className="bg-green-50 px-4 py-2 rounded-xl border border-green-100 text-green-700 flex items-center gap-2">
                        <Shield size={16} />
                        <span className="text-xs font-bold uppercase tracking-wider">Conformidade Ativa</span>
                    </div>
                </div>
            </div>

            {/* Top Progress Card */}
            <div className="!bg-gradient-to-r !from-blue-700 !to-indigo-800 p-8 rounded-[2rem] text-white border-0 shadow-2xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 py-4">
                    <div className="w-32 h-32 relative shrink-0">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle
                                cx="64"
                                cy="64"
                                r="58"
                                stroke="currentColor"
                                strokeWidth="12"
                                fill="transparent"
                                className="text-white/10"
                            />
                            <circle
                                cx="64"
                                cy="64"
                                r="58"
                                stroke="currentColor"
                                strokeWidth="12"
                                fill="transparent"
                                strokeDasharray={364}
                                strokeDashoffset={isNaN(avg) ? 364 : 364 - (364 * avg) / 100}
                                strokeLinecap="round"
                                className="text-white transition-all duration-1000 ease-out"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-black">{avg}%</span>
                            <span className="text-[8px] uppercase font-bold opacity-60">Geral</span>
                        </div>
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h2 className="text-2xl font-bold font-display mb-2">Saúde da Carteira</h2>
                        <p className="text-blue-100 text-sm max-w-md leading-relaxed">
                            A média de completude dos seus sinistros ativos está em <strong className="text-white">{avg}%</strong>.
                            Você possui <strong className="text-white">{crit}</strong> casos em estado crítico que requerem atenção imediata.
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => navigate('/sinistros')}
                            className="bg-white text-blue-700 px-6 py-3 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all shadow-lg"
                        >
                            Gerenciar Carteira
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total de Sinistros"
                    value={total}
                    icon={FileText}
                    color="bg-blue-600"
                    trend={5}
                    onClick={() => navigate('sinistros')}
                />
                <StatCard
                    title="Em Análise"
                    value={inAnal}
                    icon={Clock}
                    color="bg-amber-500"
                    trend={-2}
                    onClick={() => navigate('sinistros?status=Em%20Análise')}
                />
                <StatCard
                    title="Concluídos"
                    value={comp}
                    icon={CheckCircle2}
                    color="bg-green-600"
                    onClick={() => navigate('sinistros?status=Concluído')}
                />
                <StatCard
                    title="Prazos Críticos"
                    value={crit}
                    icon={AlertCircle}
                    color="bg-red-600"
                    onClick={() => navigate('sinistros?filter=critico')}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Activity */}
                <div className="lg:col-span-2 card">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-800 font-display">Atividades Recentes do Time</h3>
                        <button
                            onClick={() => navigate('sinistros')}
                            className="text-sm text-blue-600 font-medium hover:underline"
                        >
                            Ver Audit Trail
                        </button>
                    </div>
                    <div className="space-y-6">
                        {allActivities.length > 0 ? allActivities.map((activity, idx) => (
                            <div
                                key={idx}
                                className="flex gap-4 group cursor-pointer"
                                onClick={() => navigate(`sinistros/${safeClaims.find(c => c.number === activity.claimNumber)?.id}`)}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${activity.type === 'UPLOAD' ? 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white' :
                                    activity.type === 'SLA' ? 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white' :
                                        activity.type === 'VIEW' ? 'bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white' :
                                            'bg-gray-50 text-gray-600 group-hover:bg-gray-600 group-hover:text-white'
                                    }`}>
                                    <FileText size={20} />
                                </div>
                                <div className="flex-1 border-b border-gray-100 pb-4">
                                    <p className="text-sm font-medium text-gray-900 leading-tight">
                                        <span className="font-bold">{activity.user}</span> {activity.action} em
                                        <span className="text-blue-600 font-bold block mt-0.5">Sinistro #{activity.claimNumber}</span>
                                    </p>
                                    <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-wider">{activity.date} • {activity.claimTitle}</p>
                                </div>
                            </div>
                        )) : (
                            <p className="py-10 text-center text-gray-400 font-medium">Nenhuma atividade registrada hoje.</p>
                        )}
                    </div>
                </div>

                {/* Completion Status */}
                <div className="card">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 font-display">Saúde das Pastas (POC)</h3>
                    <div className="space-y-7">
                        {categoryStats.map((cat) => (
                            <div key={cat.label} className="group cursor-default">
                                <div className="flex justify-between text-[11px] mb-2 font-bold uppercase tracking-wider">
                                    <span className="text-gray-500 group-hover:text-blue-600 transition-colors">{cat.label}</span>
                                    <span className="text-gray-900">{cat.value}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden shadow-inner">
                                    <div
                                        className={`${cat.color} h-full rounded-full transition-all duration-1000 ease-in-out group-hover:brightness-110`}
                                        style={{ width: `${cat.value}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-10 p-5 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl shadow-slate-200">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <p className="text-[10px] font-extrabold text-white uppercase tracking-widest">Resiliência Operacional</p>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            Sistema operando sob <strong>Lei 15.040</strong>. Logs de visualização estão sendo gravados em tempo real na trilha de auditoria para conformidade Tokio Marine.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

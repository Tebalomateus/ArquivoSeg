import { useMemo } from 'react';
import {
    Users,
    FileText,
    Link as LinkIcon,
    TrendingUp,
    TrendingDown,
    ShieldCheck,
    AlertCircle,
    Building2,
    BarChart3,
    PieChart,
    Wallet,
    Bell
} from 'lucide-react';
import { useClaims } from '../../context/ClaimsContext';

const BIStatCard = ({ title, value, detail, icon: Icon, color, trend }) => (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-100/50 flex flex-col justify-between group hover:border-blue-200 transition-all">
        <div className="flex items-center justify-between mb-6">
            <div className={`p-4 rounded-2xl ${color} text-white shadow-lg`}>
                <Icon size={24} />
            </div>
            {trend && (
                <div className={`flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded-lg ${trend > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    {trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {Math.abs(trend)}%
                </div>
            )}
        </div>
        <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
            <h3 className="text-3xl font-black text-slate-900 font-display">{value}</h3>
            <p className="text-xs text-slate-500 mt-2 font-medium">{detail}</p>
        </div>
    </div>
);

export default function AdminDashboard() {
    const { claims, claimsLoading, backendUsers, clients } = useClaims();

    const stats = useMemo(() => {
        const totalClaims = claims.length;
        const totalUsers = backendUsers.length;
        const totalClients = clients.length;
        const byStatus = claims.reduce((acc, c) => {
            const k = c.backStatus || 'ready';
            acc[k] = (acc[k] || 0) + 1;
            return acc;
        }, {});
        const completed = byStatus.done || 0;
        const archived = byStatus.archived || 0;
        const inFlight = totalClaims - completed - archived;

        return { totalClaims, totalUsers, totalClients, byStatus, completed, archived, inFlight };
    }, [claims, backendUsers, clients]);

    const STATUS_LABELS = {
        ready: 'Aberto',
        ongoing: 'Em Análise',
        review: 'Em Revisão',
        done: 'Concluído',
        archived: 'Arquivado',
    };
    const STATUS_COLORS = {
        ready: 'bg-blue-500',
        ongoing: 'bg-amber-500',
        review: 'bg-purple-500',
        done: 'bg-green-500',
        archived: 'bg-slate-400',
    };

    return (
        <div className="space-y-10 animate-fade-in relative z-10">
            {/* Admin Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 font-display tracking-tight">Painel de Controle Global</h1>
                    <p className="text-slate-500 font-medium">Bem-vindo ao centro de comando do <span className="text-blue-600 font-bold">ArquivoSeg</span>.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center gap-3 border border-slate-800 shadow-xl">
                        <ShieldCheck size={20} className="text-blue-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Platform Integrity: Active</span>
                    </div>
                </div>
            </div>

            {/* Top Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <BIStatCard
                    title="Sinistros (total)"
                    value={claimsLoading ? '…' : stats.totalClaims}
                    detail={`${stats.inFlight} em andamento · ${stats.completed} concluídos · ${stats.archived} arquivados`}
                    icon={FileText}
                    color="bg-blue-600"
                />
                <BIStatCard
                    title="Clientes B2B"
                    value={stats.totalClients}
                    detail={`${clients.filter(c => c.type === 'SEGURADORA').length} seguradoras · ${clients.filter(c => c.type === 'CORRETORA').length} corretoras`}
                    icon={LinkIcon}
                    color="bg-purple-600"
                />
                <BIStatCard
                    title="Usuários do tenant"
                    value={stats.totalUsers || '—'}
                    detail="Conforme tabela `users` (Zitadel sync)"
                    icon={Users}
                    color="bg-indigo-600"
                />
                <BIStatCard
                    title="Volume Financeiro"
                    value="R$ 145k"
                    detail="Faturamento bruto mensal (placeholder)"
                    icon={Wallet}
                />
            </div>

            {/* Deep Analytics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Platform Health Section */}
                <div className="lg:col-span-2 space-y-10">
                    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-10 w-64 h-64 bg-blue-50/50 rounded-full blur-[100px] -mt-32 -mr-32 group-hover:bg-blue-100/50 transition-all duration-1000"></div>

                        <div className="flex items-center justify-between mb-10 relative z-10">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 font-display uppercase tracking-tight">Monitor de Auditoria em Tempo Real</h3>
                                <p className="text-xs text-slate-500 font-medium">Logs de atividade e integridade de dados</p>
                            </div>
                            <button className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline">Exportar Relatório Full</button>
                        </div>

                        <div className="space-y-6 relative z-10">
                            {/* Sinistros por status (do backend) */}
                            <div className="bg-slate-50 rounded-[2rem] border border-slate-100 p-8 space-y-5">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                        <BarChart3 size={14} /> Sinistros por Status
                                    </p>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stats.totalClaims} total</span>
                                </div>
                                {stats.totalClaims === 0 ? (
                                    <p className="text-xs text-slate-400 font-medium text-center py-8">Nenhum sinistro carregado.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {Object.entries(stats.byStatus).map(([status, count]) => {
                                            const pct = Math.round((count / stats.totalClaims) * 100);
                                            return (
                                                <div key={status} className="space-y-1.5">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="font-bold text-slate-700">{STATUS_LABELS[status] || status}</span>
                                                        <span className="font-black text-slate-900">{count} <span className="text-slate-400 font-bold">({pct}%)</span></span>
                                                    </div>
                                                    <div className="w-full h-2.5 bg-white rounded-full overflow-hidden border border-slate-100">
                                                        <div className={`h-full ${STATUS_COLORS[status] || 'bg-slate-400'} transition-all duration-700`} style={{ width: `${pct}%` }}></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-6 bg-slate-900 rounded-3xl text-white">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Cadeia de Custódia</p>
                                    <h4 className="text-xl font-bold font-display">AES-256 Verified</h4>
                                    <p className="text-[9px] text-slate-400 mt-2">Zero brechas detectadas nas últimas 24h.</p>
                                </div>
                                <div className="p-6 bg-blue-600 rounded-3xl text-white shadow-xl shadow-blue-200">
                                    <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-1">SLA da Plataforma</p>
                                    <h4 className="text-xl font-bold font-display">99.9% Uptime</h4>
                                    <p className="text-[9px] text-blue-100 mt-2">Latência média: 45ms (AWS São Paulo).</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Entities Breakdown */}
                    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-2xl">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-lg font-black text-slate-900 font-display uppercase tracking-tight">Distribuição de Clientes (B2B)</h3>
                            <PieChart className="text-slate-300" size={24} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {['SEGURADORA', 'CORRETORA', 'AUDITORIA'].map(type => (
                                <div key={type} className="p-6 rounded-3xl border border-slate-50 bg-slate-50/30 flex flex-col gap-2">
                                    <Building2 size={24} className="text-blue-500 mb-2" />
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{type}</span>
                                    <h4 className="text-2xl font-black text-slate-900">{clients.filter(c => c.type === type).length}</h4>
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2">
                                        <div className="bg-blue-600 h-full rounded-full" style={{ width: '60%' }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Vertical Sidebar Admin Info */}
                <div className="space-y-8">
                    <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-blue-600 opacity-0 group-hover:opacity-10 transition-opacity duration-700"></div>
                        <div className="relative z-10">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-blue-400 mb-6">Alertas Críticos</h3>
                            <div className="space-y-6">
                                <div className="flex gap-4">
                                    <div className="shrink-0 w-8 h-8 rounded-lg bg-red-500/20 text-red-500 flex items-center justify-center">
                                        <AlertCircle size={16} />
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="text-xs font-bold leading-tight">3 clientes com fatura em atraso</p>
                                        <span className="text-[9px] text-slate-500 font-black uppercase mt-1">Ação imediata requerida</span>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="shrink-0 w-8 h-8 rounded-lg bg-blue-500/20 text-blue-500 flex items-center justify-center">
                                        <Bell size={16} />
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="text-xs font-bold leading-tight">Novo Perito aguardando aprovação</p>
                                        <span className="text-[9px] text-slate-500 font-black uppercase mt-1">Gestão de Usuários</span>
                                    </div>
                                </div>
                            </div>
                            <button className="w-full mt-8 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all">
                                Central de Notificações
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl space-y-6">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                            <ShieldCheck size={16} className="text-blue-600" /> Auditoria Tokio Marine
                        </h3>
                        <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100">
                            <p className="text-[10px] text-blue-800 font-bold leading-relaxed">
                                Última limpeza de logs realizada em: <br />
                                <strong className="block mt-1 uppercase">18/02/2026 - 15:00</strong>
                            </p>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                            O sistema está configurado para retenção de 5 anos em conformidade com as normas regulatórias de seguros.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

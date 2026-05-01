import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    Users,
    FileText,
    Link as LinkIcon,
    ShieldCheck,
    AlertCircle,
    Building2,
    BarChart3,
    PieChart,
    Server,
    Bell,
    Activity,
} from 'lucide-react';
import { useClaims } from '../../context/ClaimsContext';
import { listAudit } from '../../api/audit';

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
    const [healthOk, setHealthOk] = useState(null);
    const [recentAudit, setRecentAudit] = useState([]);

    useEffect(() => {
        const check = async () => {
            try {
                const res = await fetch('/health/ready');
                setHealthOk(res.ok);
            } catch { setHealthOk(false); }
        };
        check();
        const t = setInterval(check, 30000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                const res = await listAudit({ from: since, limit: 200 });
                setRecentAudit(Array.isArray(res?.data) ? res.data : []);
            } catch {
                setRecentAudit([]);
            }
        };
        load();
    }, []);

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

        // Real activity from audit (last 7d)
        const filesUploaded = recentAudit.filter((e) => e.action === 'file.uploaded').length;
        const accessDeniedCount = recentAudit.filter((e) => e.action === 'access.denied').length;
        const lastAuditTs = recentAudit[0]?.timestamp ? new Date(recentAudit[0].timestamp) : null;

        // Inactive users in the last 7d (lower bound from /audit page slice)
        const activeIds = new Set(recentAudit.map((e) => e.actor_user_id).filter(Boolean));
        const inactiveUsers = backendUsers.filter((u) => !activeIds.has(u.id)).length;

        return {
            totalClaims, totalUsers, totalClients, byStatus, completed, archived, inFlight,
            filesUploaded, accessDeniedCount, lastAuditTs, inactiveUsers,
        };
    }, [claims, backendUsers, clients, recentAudit]);

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
                    <div className={`p-3 rounded-2xl flex items-center gap-3 border shadow-xl ${
                        healthOk === null
                            ? 'bg-slate-900 text-white border-slate-800'
                            : healthOk
                              ? 'bg-slate-900 text-white border-slate-800'
                              : 'bg-red-900 text-white border-red-800'
                    }`}>
                        <ShieldCheck size={20} className={healthOk === false ? 'text-red-400' : 'text-blue-400'} />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Backend {healthOk === null ? '…' : healthOk ? 'Online' : 'Offline'}
                        </span>
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
                    title="Documentos enviados (7d)"
                    value={stats.filesUploaded}
                    detail={`${stats.accessDeniedCount} acessos negados na janela`}
                    icon={Activity}
                    color="bg-emerald-600"
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
                            <Link to="/admin/compliance" className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline">Abrir Compliance Center →</Link>
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
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Trilha de Auditoria</p>
                                    <h4 className="text-xl font-bold font-display">Append-only</h4>
                                    <p className="text-[9px] text-slate-400 mt-2">REVOKE UPDATE, DELETE em audit_logs no Postgres.</p>
                                </div>
                                <div className={`p-6 rounded-3xl text-white shadow-xl ${healthOk === false ? 'bg-red-600 shadow-red-200' : 'bg-blue-600 shadow-blue-200'}`}>
                                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${healthOk === false ? 'text-red-200' : 'text-blue-200'}`}>Saúde do Backend</p>
                                    <h4 className="text-xl font-bold font-display">
                                        {healthOk === null ? '…' : healthOk ? 'Operacional' : 'Indisponível'}
                                    </h4>
                                    <p className={`text-[9px] mt-2 ${healthOk === false ? 'text-red-100' : 'text-blue-100'}`}>
                                        DB + S3 verificados via /health/ready a cada 30s.
                                    </p>
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
                                {stats.accessDeniedCount > 0 ? (
                                    <Link to="/admin/compliance" className="flex gap-4 hover:opacity-80 transition-opacity">
                                        <div className="shrink-0 w-8 h-8 rounded-lg bg-red-500/20 text-red-500 flex items-center justify-center">
                                            <AlertCircle size={16} />
                                        </div>
                                        <div className="flex flex-col">
                                            <p className="text-xs font-bold leading-tight">{stats.accessDeniedCount} acessos negados (7d)</p>
                                            <span className="text-[9px] text-slate-500 font-black uppercase mt-1">Compliance Data Center</span>
                                        </div>
                                    </Link>
                                ) : (
                                    <div className="flex gap-4">
                                        <div className="shrink-0 w-8 h-8 rounded-lg bg-green-500/20 text-green-500 flex items-center justify-center">
                                            <ShieldCheck size={16} />
                                        </div>
                                        <div className="flex flex-col">
                                            <p className="text-xs font-bold leading-tight">Nenhum acesso negado nos últimos 7d</p>
                                            <span className="text-[9px] text-slate-500 font-black uppercase mt-1">RBAC sem alertas</span>
                                        </div>
                                    </div>
                                )}
                                {stats.inactiveUsers > 0 && (
                                    <Link to="/admin/usuarios" className="flex gap-4 hover:opacity-80 transition-opacity">
                                        <div className="shrink-0 w-8 h-8 rounded-lg bg-blue-500/20 text-blue-500 flex items-center justify-center">
                                            <Bell size={16} />
                                        </div>
                                        <div className="flex flex-col">
                                            <p className="text-xs font-bold leading-tight">{stats.inactiveUsers} usuários sem atividade (7d)</p>
                                            <span className="text-[9px] text-slate-500 font-black uppercase mt-1">Gestão de Usuários</span>
                                        </div>
                                    </Link>
                                )}
                            </div>
                            <Link
                                to="/admin/notificacoes"
                                className="w-full mt-8 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center"
                            >
                                Central de Notificações
                            </Link>
                        </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl space-y-6">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                            <ShieldCheck size={16} className="text-blue-600" /> Atividade de Auditoria
                        </h3>
                        <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100">
                            <p className="text-[10px] text-blue-800 font-bold leading-relaxed">
                                Eventos lidos nos últimos 7 dias:
                                <strong className="block mt-1 text-2xl font-black text-blue-700">{recentAudit.length}</strong>
                            </p>
                            {stats.lastAuditTs && (
                                <p className="text-[9px] text-blue-700 font-bold uppercase tracking-widest mt-3">
                                    Último evento: {stats.lastAuditTs.toLocaleString('pt-BR')}
                                </p>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                            Retenção sugerida: 5 anos (Lei do Seguro / SUSEP). Trilha append-only ao nível do banco.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

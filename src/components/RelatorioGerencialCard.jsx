import { useMemo } from 'react';
import { BarChart3, Clock, AlertTriangle, CalendarClock } from 'lucide-react';

const STATUS_LABELS_PT = {
    ready: 'Aberto',
    ongoing: 'Em Análise',
    review: 'Em Revisão',
    done: 'Concluído',
    archived: 'Arquivado',
};

// "Relatório Gerencial" pedido pelo usuário final para os 4 papéis — casos
// aberto/fechados, status do processo, contagem de prazo ativo e tempo médio
// de conclusão. Tudo computado client-side a partir dos `claims` já carregados,
// sem chamada nova ao backend. Componente único, reaproveitado em
// Dashboard.jsx (/app) e AdminDashboard.jsx (/admin) para valer pros 4 papéis.
export default function RelatorioGerencialCard({ claims }) {
    const stats = useMemo(() => {
        const list = claims || [];
        const total = list.length;
        const byStatus = { ready: 0, ongoing: 0, review: 0, done: 0, archived: 0 };
        let activeDeadlineCount = 0;
        let criticalCount = 0;
        const doneDurationsDays = [];

        for (const c of list) {
            const st = c.backStatus || 'ready';
            byStatus[st] = (byStatus[st] || 0) + 1;

            const isOpen = st !== 'done' && st !== 'archived';
            const remaining = c.deadline?.remainingDays ?? 30;
            if (isOpen && !c.deadline?.isSuspended && remaining > 0) {
                activeDeadlineCount++;
                if (remaining < 5) criticalCount++;
            }

            if (st === 'done' && c.backCreatedAt && c.backUpdatedAt) {
                const days = (new Date(c.backUpdatedAt) - new Date(c.backCreatedAt)) / 86_400_000;
                if (days >= 0) doneDurationsDays.push(days);
            }
        }

        const closed = byStatus.done + byStatus.archived;
        const avgDays = doneDurationsDays.length > 0
            ? Math.round(doneDurationsDays.reduce((a, b) => a + b, 0) / doneDurationsDays.length)
            : null;

        return { total, open: total - closed, closed, byStatus, activeDeadlineCount, criticalCount, avgDays };
    }, [claims]);

    return (
        <div className="card space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                    <BarChart3 size={20} />
                </div>
                <div>
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Relatório Gerencial</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Status e desenvolvimento dos processos</p>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MiniStat label="Casos abertos" value={stats.open} />
                <MiniStat label="Casos fechados" value={stats.closed} />
                <MiniStat label="Com prazo ativo" value={stats.activeDeadlineCount} icon={CalendarClock} />
                <MiniStat label="SLA crítico (<5d)" value={stats.criticalCount} warn={stats.criticalCount > 0} icon={AlertTriangle} />
            </div>

            <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Por status do processo</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {Object.entries(STATUS_LABELS_PT).map(([key, label]) => (
                        <div key={key} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-center">
                            <p className="text-lg font-black text-gray-900">{stats.byStatus[key] || 0}</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {stats.avgDays != null && (
                <p className="text-xs text-gray-500 font-medium flex items-center gap-2">
                    <Clock size={14} className="text-gray-400" />
                    Tempo médio de conclusão: <span className="font-black text-gray-900">{stats.avgDays} dia{stats.avgDays === 1 ? '' : 's'}</span>
                </p>
            )}
        </div>
    );
}

function MiniStat({ label, value, warn, icon: Icon }) {
    return (
        <div className={`p-4 rounded-2xl border text-center ${warn ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
            {Icon && <Icon size={16} className={`mx-auto mb-1 ${warn ? 'text-red-500' : 'text-gray-400'}`} />}
            <p className={`text-2xl font-black ${warn ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        </div>
    );
}

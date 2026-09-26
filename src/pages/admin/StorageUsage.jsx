import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { HardDrive, RefreshCw, ArrowLeft, ShieldAlert, FileStack, ChevronRight } from 'lucide-react';
import { formatBytes } from '../../api/files';
import { useStorageUsage } from '../../hooks/useStorageUsage';
import { useClaims } from '../../context/ClaimsContext';

const fmtCount = (n) => Number(n || 0).toLocaleString('pt-BR');

/**
 * Onde está o espaço do tenant: o total e cada sinistro do maior para o
 * menor, com uma barra proporcional ao maior — para achar de relance quem
 * está pesando. Cada linha leva ao sinistro.
 */
export default function StorageUsage() {
    const { data, loading, error, forbidden, reload } = useStorageUsage();
    const { claims } = useClaims();

    const numbers = useMemo(() => {
        const map = {};
        for (const c of claims || []) map[String(c.id)] = c.number;
        return map;
    }, [claims]);

    // O servidor já manda do maior para o menor; ordenar aqui garante a
    // promessa da tela mesmo se isso mudar.
    const rows = useMemo(
        () => [...(data?.processes || [])].sort((a, b) => (b.bytes || 0) - (a.bytes || 0)),
        [data]
    );
    const max = rows[0]?.bytes || 0;
    const total = data?.total_bytes || 0;

    return (
        <div className="space-y-8 animate-fade-in relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <Link to="/admin" className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-secondary transition-colors">
                        <ArrowLeft size={12} /> Painel Global
                    </Link>
                    <h1 className="mt-2 text-3xl sm:text-4xl font-black text-primary font-display tracking-tight">Armazenamento</h1>
                    <p className="text-sm text-gray-500 font-medium">Espaço ocupado pelos arquivos de cada sinistro, somando todas as versões.</p>
                </div>
                {!forbidden && (
                    <button
                        type="button"
                        onClick={reload}
                        disabled={loading}
                        aria-label="Atualizar armazenamento"
                        className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white border border-gray-200 text-gray-600 text-[10px] font-black uppercase tracking-widest hover:border-secondary hover:text-secondary transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
                    </button>
                )}
            </div>

            {forbidden ? (
                <div className="p-8 rounded-2xl bg-white/70 border border-white/60 shadow-sm flex items-center gap-4 text-gray-500" data-testid="storage-forbidden">
                    <ShieldAlert size={24} className="text-amber-500 shrink-0" />
                    <p className="text-sm font-semibold">Você não tem permissão para ver o uso de armazenamento.</p>
                </div>
            ) : error ? (
                <div role="alert" className="p-6 rounded-2xl bg-red-50 border border-red-100 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-red-700">Não foi possível carregar o armazenamento.</p>
                    <button type="button" onClick={reload} className="px-4 py-2 rounded-xl bg-white border border-red-200 text-red-700 text-[10px] font-black uppercase tracking-widest hover:bg-red-100">
                        Tentar novamente
                    </button>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                        <Stat icon={HardDrive} label="Total do tenant" value={loading && !data ? null : formatBytes(total)} testId="storage-total" />
                        <Stat icon={FileStack} label="Arquivos" value={loading && !data ? null : fmtCount(data?.file_count)} testId="storage-files" />
                        <Stat icon={HardDrive} label="Sinistros com arquivos" value={loading && !data ? null : fmtCount(rows.filter((r) => r.bytes > 0).length)} />
                    </div>

                    <section className="bg-white/70 backdrop-blur-md border border-white/60 rounded-2xl shadow-[0_10px_30px_-12px_rgba(26,43,83,0.12)] overflow-hidden">
                        <div className="px-5 sm:px-6 py-4 border-b border-gray-100">
                            <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Por sinistro, do maior para o menor</h2>
                        </div>
                        {loading && !data ? (
                            <div className="p-6 space-y-3" data-testid="storage-loading">
                                {[0, 1, 2].map((i) => <div key={i} className="h-10 rounded-xl bg-gray-100 animate-pulse" />)}
                            </div>
                        ) : rows.length === 0 ? (
                            <p className="p-10 text-center text-sm font-semibold text-gray-400" data-testid="storage-empty">Nenhum arquivo guardado ainda.</p>
                        ) : (
                            <table className="w-full text-left table-fixed">
                                <thead className="sr-only sm:table-header-group">
                                    <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        <th scope="col" className="px-5 sm:px-6 py-3 font-black">Sinistro</th>
                                        <th scope="col" className="hidden sm:table-cell w-28 px-3 py-3 font-black text-right">Arquivos</th>
                                        <th scope="col" className="w-[42%] sm:w-[38%] px-5 sm:px-6 py-3 font-black">Tamanho</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {rows.map((r) => {
                                        const pct = max > 0 ? Math.max(1, Math.round((r.bytes / max) * 100)) : 0;
                                        const share = total > 0 ? Math.round((r.bytes / total) * 1000) / 10 : 0;
                                        const number = numbers[String(r.process_id)];
                                        return (
                                            <tr key={r.process_id} data-testid="storage-row" className="group hover:bg-secondary/5 transition-colors">
                                                <td className="px-5 sm:px-6 py-4 min-w-0">
                                                    <Link to={`/admin/sinistros/${r.process_id}`} className="flex items-center gap-2 min-w-0 outline-none focus-visible:underline">
                                                        <span className="min-w-0">
                                                            {number && <span className="block text-[10px] font-black uppercase tracking-widest text-gray-400">SD - {number}</span>}
                                                            <span className="block truncate text-sm font-bold text-primary group-hover:text-secondary transition-colors">{r.title || r.process_id}</span>
                                                            <span className="sm:hidden block text-xs text-gray-400 font-semibold">{fmtCount(r.file_count)} {r.file_count === 1 ? 'arquivo' : 'arquivos'}</span>
                                                        </span>
                                                        <ChevronRight size={14} className="shrink-0 text-gray-300 group-hover:text-secondary" />
                                                    </Link>
                                                </td>
                                                <td className="hidden sm:table-cell px-3 py-4 text-right text-sm font-bold text-gray-600" data-testid="storage-row-files">{fmtCount(r.file_count)}</td>
                                                <td className="px-5 sm:px-6 py-4">
                                                    <div className="flex items-baseline justify-between gap-2">
                                                        <span className="text-sm font-extrabold text-primary whitespace-nowrap" data-testid="storage-row-bytes">{formatBytes(r.bytes)}</span>
                                                        <span className="text-[10px] font-bold text-gray-400">{share.toLocaleString('pt-BR')}%</span>
                                                    </div>
                                                    <div className="mt-1.5 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                                                        <div className="h-full rounded-full bg-secondary" data-testid="storage-row-bar" style={{ width: `${pct}%` }} />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}

function Stat({ icon: Icon, label, value, testId }) {
    return (
        <div className="bg-white/70 backdrop-blur-md border border-white/60 rounded-2xl shadow-sm p-5 flex items-center gap-4">
            <div className="w-11 h-11 shrink-0 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center"><Icon size={20} /></div>
            <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
                {value == null
                    ? <div className="mt-1 h-6 w-24 rounded-lg bg-gray-100 animate-pulse" />
                    : <p className="font-display text-xl font-extrabold text-primary truncate" data-testid={testId}>{value}</p>}
            </div>
        </div>
    );
}

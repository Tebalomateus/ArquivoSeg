import { Link } from 'react-router-dom';
import { HardDrive, ArrowRight, RefreshCw } from 'lucide-react';
import { formatBytes } from '../api/files';
import { useStorageUsage } from '../hooks/useStorageUsage';
import { usePermissions } from '../context/PermissionsContext';

const fmtCount = (n) => Number(n || 0).toLocaleString('pt-BR');

/**
 * Card do dashboard com o total guardado pelo tenant. Sem permissão (403) o
 * card não aparece: não é um erro para quem não pode ver, é só algo que não
 * é dele.
 */
export default function StorageUsageCard() {
    const { data, loading, error, forbidden, reload } = useStorageUsage();
    const { isAdmin } = usePermissions();

    if (forbidden) return null;

    return (
        <section
            data-testid="storage-card"
            aria-labelledby="storage-card-title"
            className="bg-white/70 backdrop-blur-md border border-white/60 rounded-2xl shadow-[0_10px_30px_-12px_rgba(26,43,83,0.12)] p-6 flex flex-col sm:flex-row sm:items-center gap-5"
        >
            <div className="w-12 h-12 shrink-0 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center">
                <HardDrive size={22} />
            </div>
            <div className="flex-1 min-w-0">
                <p id="storage-card-title" className="text-[10px] font-black uppercase tracking-widest text-gray-400">Armazenamento</p>
                {loading && !data ? (
                    <div className="mt-2 h-7 w-40 rounded-lg bg-gray-100 animate-pulse" aria-label="Carregando armazenamento" />
                ) : error ? (
                    <div className="mt-1 flex flex-wrap items-center gap-3" role="alert">
                        <p className="text-sm font-semibold text-gray-500">Não foi possível carregar o armazenamento.</p>
                        <button type="button" onClick={reload} className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-secondary hover:underline">
                            <RefreshCw size={12} /> Tentar novamente
                        </button>
                    </div>
                ) : (
                    <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-display text-2xl font-extrabold text-primary" data-testid="storage-total">{formatBytes(data?.total_bytes ?? 0)}</span>
                        <span className="text-sm font-semibold text-gray-500" data-testid="storage-files">
                            em {fmtCount(data?.file_count)} {data?.file_count === 1 ? 'arquivo' : 'arquivos'}
                        </span>
                    </p>
                )}
            </div>
            {isAdmin && (
                <Link
                    to="/admin/armazenamento"
                    className="self-start sm:self-center inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary/5 hover:bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest transition-colors"
                >
                    Por sinistro <ArrowRight size={12} />
                </Link>
            )}
        </section>
    );
}

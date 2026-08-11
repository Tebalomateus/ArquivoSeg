import { Loader2, AlertTriangle, X } from 'lucide-react';

// Small shared pieces for the four access screens. They exist so the tabs look
// like one feature instead of four, and so a loading or error state is never
// skipped just because writing it again was tedious.

export function Spinner({ label = 'Carregando…' }) {
    return (
        <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
        </div>
    );
}

export function ErrorNote({ error, onRetry }) {
    if (!error) return null;
    return (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div className="flex-1">
                <p className="text-sm font-bold">{error.message || 'Algo falhou.'}</p>
                {error.code && (
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mt-1">{error.code}</p>
                )}
            </div>
            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="text-xs font-black uppercase tracking-widest underline underline-offset-4"
                >
                    Tentar de novo
                </button>
            )}
        </div>
    );
}

export function Empty({ icon: Icon, title, hint }) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            {Icon && <Icon size={32} className="text-slate-300" />}
            <p className="text-sm font-bold text-slate-600">{title}</p>
            {hint && <p className="text-xs text-slate-400 max-w-sm">{hint}</p>}
        </div>
    );
}

export function Modal({ open, title, subtitle, onClose, children, wide = false }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={`bg-white rounded-3xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[88vh] flex flex-col`}
            >
                <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-100">
                    <div>
                        <h2 className="text-lg font-black text-slate-900 font-display tracking-tight">{title}</h2>
                        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">{children}</div>
            </div>
        </div>
    );
}

export function Chip({ children, tone = 'slate' }) {
    const tones = {
        slate: 'bg-slate-100 text-slate-600',
        blue: 'bg-blue-100 text-blue-700',
        purple: 'bg-purple-100 text-purple-700',
        amber: 'bg-amber-100 text-amber-700',
        red: 'bg-red-100 text-red-700',
        green: 'bg-green-100 text-green-700',
    };
    return (
        <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${tones[tone]}`}>
            {children}
        </span>
    );
}

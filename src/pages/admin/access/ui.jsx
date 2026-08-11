import { useMemo, useState } from 'react';
import { Loader2, AlertTriangle, X, Search } from 'lucide-react';

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

/**
 * RolePicker is the "quais papéis" control, shared by the invite modal and the
 * per-person screen so that both stay usable as the tenant's role list grows.
 *
 * The filter only appears past FILTER_FROM roles: with five, a search box is
 * noise; with forty, scrolling is. What is already checked always renders,
 * filter or not — a control that hides the selection while you type is how a
 * role gets removed without anyone meaning to.
 */
const FILTER_FROM = 8;

export function RolePicker({ roles, selected, onToggle, disabled = false, meta }) {
    const [term, setTerm] = useState('');
    const withFilter = roles.length >= FILTER_FROM;

    const visible = useMemo(() => {
        const q = term.trim().toLowerCase();
        if (!q) return roles;
        return roles.filter(
            (r) =>
                selected.includes(r.id) ||
                `${r.name} ${r.key || ''} ${r.description || ''}`.toLowerCase().includes(q),
        );
    }, [roles, term, selected]);

    return (
        <div className="space-y-2">
            {withFilter && (
                <div className="relative">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                        placeholder={`Filtrar ${roles.length} papéis`}
                        className="pl-9 pr-3 py-2 w-full bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            )}
            <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                {visible.map((role) => (
                    <label
                        key={role.id}
                        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50"
                    >
                        <input
                            type="checkbox"
                            checked={selected.includes(role.id)}
                            disabled={disabled}
                            onChange={() => onToggle(role.id)}
                            className="w-4 h-4 rounded accent-blue-600 shrink-0"
                        />
                        <span className="flex-1 min-w-0">
                            <span className="block text-sm font-bold text-slate-700 truncate">{role.name}</span>
                            {role.description && (
                                <span className="block text-[10px] text-slate-400 truncate">{role.description}</span>
                            )}
                        </span>
                        {meta && <span className="text-[10px] text-slate-400 shrink-0">{meta(role)}</span>}
                    </label>
                ))}
                {visible.length === 0 && (
                    <p className="px-4 py-3 text-[10px] font-bold text-slate-400">
                        {roles.length === 0
                            ? 'Nenhum papel cadastrado ainda. Crie um na aba Papéis.'
                            : 'Nenhum papel com esse nome.'}
                    </p>
                )}
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

import { useMemo } from 'react';
import { Asterisk, Info } from 'lucide-react';

/**
 * ActionCatalogPicker renders the permission catalog grouped and readable, and
 * edits a list of stored patterns.
 *
 * The stored value is not the expanded set of actions. A group can be granted as
 * the wildcard `processo.*`, which is a different promise from "these eleven
 * actions": the role then inherits whatever a future deploy adds to that group,
 * the way `s3:*` does. That is why the wildcard toggle is a separate control
 * from "all boxes ticked", and why it carries a warning instead of a tooltip —
 * the admin is granting access to things that do not exist yet.
 */
export default function ActionCatalogPicker({ catalog, value, onChange, disabled = false }) {
    const selected = useMemo(() => new Set(value || []), [value]);

    const isWildcard = (group) => selected.has(`${group}.*`);

    const groupActions = (group) => group.actions.map((a) => a.name);

    const allTicked = (group) =>
        groupActions(group).length > 0 && groupActions(group).every((n) => selected.has(n));

    const toggleAction = (name) => {
        const next = new Set(selected);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        onChange([...next]);
    };

    const toggleWildcard = (group) => {
        const next = new Set(selected);
        const pattern = `${group.group}.*`;
        if (next.has(pattern)) {
            next.delete(pattern);
        } else {
            // The wildcard subsumes the individual picks in its group; keeping
            // both would show two rules that say the same thing and then drift.
            for (const name of groupActions(group)) next.delete(name);
            next.add(pattern);
        }
        onChange([...next]);
    };

    const toggleAllInGroup = (group) => {
        const next = new Set(selected);
        if (allTicked(group)) {
            for (const name of groupActions(group)) next.delete(name);
        } else {
            next.delete(`${group.group}.*`);
            for (const name of groupActions(group)) next.add(name);
        }
        onChange([...next]);
    };

    return (
        <div className="space-y-4">
            {(catalog || []).map((group) => {
                const wildcard = isWildcard(group);
                return (
                    <div
                        key={group.group}
                        className={`rounded-2xl border overflow-hidden transition-colors ${
                            wildcard ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-white'
                        }`}
                    >
                        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-inherit bg-slate-50/60">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-700">
                                    {group.group}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">
                                    {group.actions.length} ações
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => toggleAllInGroup(group)}
                                    className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 disabled:opacity-40"
                                >
                                    {allTicked(group) ? 'Desmarcar todas' : 'Marcar todas'}
                                </button>
                                <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => toggleWildcard(group)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-40 ${
                                        wildcard
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                    }`}
                                    title={`Conceder o curinga ${group.group}.*`}
                                >
                                    <Asterisk size={12} />
                                    {group.group}.*
                                </button>
                            </div>
                        </div>

                        {wildcard ? (
                            <div className="flex items-start gap-2 px-4 py-4 text-amber-800">
                                <Info size={16} className="mt-0.5 shrink-0" />
                                <p className="text-xs font-medium leading-relaxed">
                                    Curinga <code className="font-black">{group.group}.*</code> concedido. Inclui as{' '}
                                    {group.actions.length} ações atuais{' '}
                                    <strong>e automaticamente novas permissões de {group.group} lançadas no futuro</strong>.
                                </p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {group.actions.map((action) => (
                                    <li key={action.name}>
                                        <label className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors">
                                            <input
                                                type="checkbox"
                                                disabled={disabled}
                                                checked={selected.has(action.name)}
                                                onChange={() => toggleAction(action.name)}
                                                className="mt-1 w-4 h-4 rounded accent-blue-600"
                                            />
                                            <span className="flex-1">
                                                <span className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-slate-800">{action.label}</span>
                                                    {action.deprecated && (
                                                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-red-100 text-red-700 uppercase tracking-wider">
                                                            obsoleta
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="block text-xs text-slate-500 mt-0.5">{action.description}</span>
                                                <code className="block text-[10px] text-slate-400 mt-1">{action.name}</code>
                                            </span>
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

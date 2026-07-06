import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, Circle, ChevronDown, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { getChecklistDef, updateChecklistState } from '../api/checklist';

export default function ChecklistPanel({ claim }) {
    const [def, setDef] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [state, setState] = useState(claim.checklistState || {});
    const [expandedStages, setExpandedStages] = useState({});
    const debounceRef = useRef(null);

    useEffect(() => {
        if (!claim.claimType) return;
        setLoading(true);
        setError(null);
        getChecklistDef(claim.claimType)
            .then(data => {
                setDef(data);
                // Expand all stages by default
                const initial = {};
                (data.stages || []).forEach(s => { initial[s.id] = true; });
                setExpandedStages(initial);
            })
            .catch(err => setError(err.message || 'Erro ao carregar checklist'))
            .finally(() => setLoading(false));
    }, [claim.claimType]);

    // Sync state from claim prop when it changes (e.g. after reload)
    useEffect(() => {
        setState(claim.checklistState || {});
    }, [claim.id]);

    const persistState = useCallback((nextState) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            updateChecklistState(claim.id, nextState).catch(console.error);
        }, 500);
    }, [claim.id]);

    const toggleItem = (stageId, itemId) => {
        const key = `${stageId}.${itemId}`;
        const nextState = { ...state, [key]: !state[key] };
        setState(nextState);
        persistState(nextState);
    };

    const toggleStage = (stageId) => {
        setExpandedStages(prev => ({ ...prev, [stageId]: !prev[stageId] }));
    };

    if (!claim.claimType) {
        return (
            <div className="card py-12 text-center">
                <AlertCircle size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-400 font-medium">Este sinistro não possui tipo definido.</p>
                <p className="text-gray-300 text-sm mt-1">Edite o sinistro para selecionar um tipo e ativar a checklist.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="card py-12 flex items-center justify-center gap-3 text-gray-400">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm font-medium">Carregando checklist...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card py-8 text-center">
                <AlertCircle size={28} className="mx-auto text-red-400 mb-2" />
                <p className="text-red-600 font-medium text-sm">{error}</p>
            </div>
        );
    }

    if (!def) return null;

    const allItems = def.stages.flatMap(s => s.items.map(i => `${s.id}.${i.id}`));
    const checkedCount = allItems.filter(k => state[k]).length;
    const totalCount = allItems.length;
    const percent = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="card border-l-[6px] border-blue-600 py-5">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">{def.title}</h3>
                        <p className="text-[10px] text-gray-400 mt-0.5">Versão {def.version}</p>
                    </div>
                    <div className="text-right">
                        <span className="text-2xl font-black text-blue-600">{percent}%</span>
                        <p className="text-[10px] text-gray-400">{checkedCount} de {totalCount} itens</p>
                    </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                        className="h-2 rounded-full bg-blue-600 transition-all duration-500"
                        style={{ width: `${percent}%` }}
                    />
                </div>
            </div>

            {/* Stages */}
            {def.stages.map(stage => {
                const stageKeys = stage.items.map(i => `${stage.id}.${i.id}`);
                const stageChecked = stageKeys.filter(k => state[k]).length;
                const stageTotal = stageKeys.length;
                const isExpanded = expandedStages[stage.id] ?? true;

                return (
                    <div key={stage.id} className="card overflow-hidden">
                        <button
                            type="button"
                            onClick={() => toggleStage(stage.id)}
                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                {isExpanded
                                    ? <ChevronDown size={16} className="text-gray-400" />
                                    : <ChevronRight size={16} className="text-gray-400" />
                                }
                                <span className="font-black text-xs uppercase tracking-widest text-gray-900">{stage.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {stageChecked === stageTotal && stageTotal > 0 && (
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700">
                                        Completo
                                    </span>
                                )}
                                <span className="text-[10px] font-bold text-gray-400">
                                    {stageChecked}/{stageTotal}
                                </span>
                            </div>
                        </button>

                        {isExpanded && (
                            <div className="border-t border-gray-100">
                                {stage.items.map((item, idx) => {
                                    const key = `${stage.id}.${item.id}`;
                                    const checked = !!state[key];
                                    return (
                                        <label
                                            key={item.id}
                                            className={`flex items-center gap-4 px-6 py-3.5 cursor-pointer transition-colors hover:bg-gray-50 ${idx !== stage.items.length - 1 ? 'border-b border-gray-50' : ''}`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => toggleItem(stage.id, item.id)}
                                                className="flex-shrink-0 focus:outline-none"
                                                aria-label={checked ? 'Desmarcar' : 'Marcar'}
                                            >
                                                {checked
                                                    ? <CheckCircle2 size={20} className="text-green-500" />
                                                    : <Circle size={20} className="text-gray-300" />
                                                }
                                            </button>
                                            <span className={`text-sm ${checked ? 'line-through text-gray-400' : 'text-gray-700'} transition-all`}>
                                                {item.label}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

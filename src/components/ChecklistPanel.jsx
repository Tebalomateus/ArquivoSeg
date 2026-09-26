import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, Circle, ChevronDown, ChevronRight, AlertCircle, Loader2, Plus, Trash2, X, History } from 'lucide-react';
import { getChecklistDef, updateChecklistState, addChecklistItem, removeChecklistItem } from '../api/checklist';
import { useConfirm } from './ConfirmDialog';

export default function ChecklistPanel({ claim }) {
    const ask = useConfirm();
    const [def, setDef] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [state, setState] = useState(claim.checklistState || {});
    const [adhocItems, setAdhocItems] = useState(claim.checklistAdhocItems || []);
    const [removedItems, setRemovedItems] = useState(claim.checklistRemovedItems || []);
    const [expandedStages, setExpandedStages] = useState({});
    const [addingToStage, setAddingToStage] = useState(null);
    const [newItemLabel, setNewItemLabel] = useState('');
    const [addingBusy, setAddingBusy] = useState(false);
    const [removeBusy, setRemoveBusy] = useState(false);
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
        setAdhocItems(claim.checklistAdhocItems || []);
        setRemovedItems(claim.checklistRemovedItems || []);
    }, [claim.id]);

    const persistState = useCallback((nextState) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            updateChecklistState(claim.id, nextState).catch(console.error);
        }, 500);
    }, [claim.id]);

    const toggleItem = async (stageId, itemId) => {
        const key = `${stageId}.${itemId}`;
        const willBeChecked = !state[key];
        // Marking as done is a claim ("this document arrived") — require an explicit
        // confirmation so a stray click doesn't silently give a document a false pass.
        // Unmarking is always safe to reverse and stays instant.
        if (willBeChecked && !await ask({
            title: 'Marcar como recebido?',
            message: 'Isto afirma que o documento chegou e foi conferido — é o que o resto do time vai ler como verdade.',
            confirmLabel: 'Confirmar recebimento',
        })) return;
        const nextState = { ...state, [key]: willBeChecked };
        setState(nextState);
        persistState(nextState);
    };

    const toggleStage = (stageId) => {
        setExpandedStages(prev => ({ ...prev, [stageId]: !prev[stageId] }));
    };

    const startAddItem = (stageId) => {
        setAddingToStage(stageId);
        setNewItemLabel('');
    };

    const cancelAddItem = () => {
        setAddingToStage(null);
        setNewItemLabel('');
    };

    const submitAddItem = async (stageId) => {
        const label = newItemLabel.trim();
        if (!label || addingBusy) return;
        setAddingBusy(true);
        try {
            const item = await addChecklistItem(claim.id, { stageId, label });
            setAdhocItems(prev => [...prev, item]);
            setAddingToStage(null);
            setNewItemLabel('');
        } catch (err) {
            alert(err.message || 'Erro ao adicionar item');
        } finally {
            setAddingBusy(false);
        }
    };

    const removeItem = async (itemKey, label) => {
        if (removeBusy) return;
        const answer = await ask({
            title: 'Remover item da checklist?',
            message: 'O item deixa de ser cobrado neste sinistro. Fica registrado quem removeu e por quê.',
            detail: label,
            confirmLabel: 'Remover item',
            tone: 'danger',
            reason: { label: 'Justificativa', placeholder: 'Explique por que este item não se aplica (registrado para auditoria).' },
        });
        if (!answer) return;
        setRemoveBusy(true);
        try {
            const removal = await removeChecklistItem(claim.id, itemKey, answer.reason);
            setRemovedItems(prev => [...prev.filter(r => r.itemKey !== removal.itemKey), removal]);
            setState(prev => {
                if (!(itemKey in prev)) return prev;
                const next = { ...prev };
                delete next[itemKey];
                return next;
            });
        } catch (err) {
            alert(err.message || 'Erro ao remover item');
        } finally {
            setRemoveBusy(false);
        }
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

    const removedByKey = new Map(removedItems.map(r => [r.itemKey, r]));
    const adhocByStage = new Map();
    for (const item of adhocItems) {
        if (!adhocByStage.has(item.stageId)) adhocByStage.set(item.stageId, []);
        adhocByStage.get(item.stageId).push(item);
    }

    const allKeys = [
        ...def.stages.flatMap(s => s.items.map(i => `${s.id}.${i.id}`)),
        ...adhocItems.map(i => `${i.stageId}.${i.id}`),
    ].filter(k => !removedByKey.has(k));
    const checkedCount = allKeys.filter(k => state[k]).length;
    const totalCount = allKeys.length;
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
                const rows = [
                    ...stage.items.map(i => ({ id: i.id, label: i.label, isAdhoc: false })),
                    ...(adhocByStage.get(stage.id) || []).map(i => ({ id: i.id, label: i.label, isAdhoc: true })),
                ];
                const activeKeys = rows.map(r => `${stage.id}.${r.id}`).filter(k => !removedByKey.has(k));
                const stageChecked = activeKeys.filter(k => state[k]).length;
                const stageTotal = activeKeys.length;
                const isExpanded = expandedStages[stage.id] ?? true;
                const isAdding = addingToStage === stage.id;

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
                                {rows.map((item, idx) => {
                                    const key = `${stage.id}.${item.id}`;
                                    const checked = !!state[key];
                                    const removal = removedByKey.get(key);
                                    return (
                                        <div
                                            key={key}
                                            className={`px-6 py-3.5 ${idx !== rows.length - 1 || isAdding ? 'border-b border-gray-50' : ''} ${removal ? 'bg-gray-50/60' : ''}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <button
                                                    type="button"
                                                    onClick={() => !removal && toggleItem(stage.id, item.id)}
                                                    disabled={!!removal}
                                                    className="flex-shrink-0 focus:outline-none disabled:cursor-not-allowed"
                                                    aria-label={checked ? 'Desmarcar' : 'Marcar'}
                                                >
                                                    {checked
                                                        ? <CheckCircle2 size={20} className={removal ? 'text-gray-300' : 'text-green-500'} />
                                                        : <Circle size={20} className="text-gray-300" />
                                                    }
                                                </button>
                                                <span className={`flex-1 text-sm ${checked || removal ? 'line-through text-gray-400' : 'text-gray-700'} transition-all`}>
                                                    {item.label}
                                                </span>
                                                {item.isAdhoc && !removal && (
                                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-600 uppercase tracking-wide">
                                                        Adicional
                                                    </span>
                                                )}
                                                {!removal && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(key, item.label)}
                                                        className="flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors focus:outline-none"
                                                        aria-label="Remover item"
                                                        title="Remover item"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                            {removal && (
                                                <div className="mt-1.5 ml-9 flex items-start gap-1.5 text-[11px] text-red-600">
                                                    <History size={12} className="mt-0.5 flex-shrink-0" />
                                                    <span>
                                                        <span className="font-bold">Removido:</span> {removal.reason}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {isAdding ? (
                                    <div className="px-6 py-3.5 flex items-center gap-2">
                                        <input
                                            type="text"
                                            autoFocus
                                            value={newItemLabel}
                                            onChange={e => setNewItemLabel(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') submitAddItem(stage.id);
                                                if (e.key === 'Escape') cancelAddItem();
                                            }}
                                            placeholder="Descrição do novo item"
                                            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => submitAddItem(stage.id)}
                                            disabled={!newItemLabel.trim() || addingBusy}
                                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            {addingBusy ? '...' : 'Adicionar'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={cancelAddItem}
                                            className="text-gray-400 hover:text-gray-600 focus:outline-none"
                                            aria-label="Cancelar"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => startAddItem(stage.id)}
                                        className="w-full flex items-center gap-2 px-6 py-3 text-xs font-bold text-blue-600 hover:bg-blue-50/50 transition-colors focus:outline-none"
                                    >
                                        <Plus size={14} />
                                        Adicionar item
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

        </div>
    );
}

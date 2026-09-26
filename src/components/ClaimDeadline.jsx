import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, X } from 'lucide-react';
import { loadDeadline, saveDeadlineAdjust } from '../services/claimSidebar';

/**
 * Prazo regulatório no cartão lateral do sinistro.
 *
 * O prazo não é mais suspenso à mão: ele só começa quando o último documento
 * obrigatório chega (o servidor grava o início sozinho) e, a partir daí, corre
 * até o vencimento. Criador e admin corrigem início ou vencimento com
 * justificativa, e cada correção fica no histórico logo abaixo.
 */

const DAY_MS = 86_400_000;
const MIN_JUSTIFICATION = 5;

const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
};
const formatWhen = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};
// <input type="date"> dá "AAAA-MM-DD"; o servidor quer RFC3339. Meia-noite
// local, para a data mostrada ser a mesma que a pessoa escolheu.
const dateInputToISO = (v) => (v ? new Date(`${v}T00:00:00`).toISOString() : undefined);

const FIELD_LABEL = { start_at: 'Início', due_at: 'Vencimento' };

function errorMessage(err) {
    if (err?.code === 'DEADLINE_FORBIDDEN' || err?.status === 403) {
        return 'Só quem criou o sinistro ou um administrador pode ajustar o prazo.';
    }
    return err?.message || 'Não foi possível ajustar o prazo.';
}

export function daysLeft(dueAt, now = Date.now()) {
    const due = Date.parse(dueAt);
    if (Number.isNaN(due)) return null;
    return Math.ceil((due - now) / DAY_MS);
}

export default function ClaimDeadline({ claim, currentUser }) {
    // undefined = carregando; null = falhou.
    const [deadline, setDeadline] = useState(undefined);
    const [modalOpen, setModalOpen] = useState(false);
    const [showAll, setShowAll] = useState(false);

    // O início é gravado pelo servidor quando o último obrigatório é cumprido,
    // então o progresso mudar é motivo para reler.
    useEffect(() => {
        let off = false;
        loadDeadline(claim).then(d => { if (!off) setDeadline(d || null); }).catch(() => { if (!off) setDeadline(null); });
        return () => { off = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [claim.id, claim.progress]);

    const history = deadline?.history || [];
    const visible = showAll ? history : history.slice(0, 2);

    let main;
    if (deadline === undefined) {
        main = <span className="text-sm font-extrabold text-gray-400">…</span>;
    } else if (deadline === null) {
        main = <span className="text-[11px] font-semibold text-gray-400">Prazo indisponível.</span>;
    } else if (!deadline.start_at) {
        main = (
            <>
                <p className="text-[13px] font-extrabold text-amber-600 leading-snug" data-testid="deadline-status">Aguardando documentos obrigatórios</p>
                <p className="text-[10.5px] text-gray-400 leading-snug mt-0.5">
                    Os {deadline.total_days || 30} dias começam a contar quando o último obrigatório for entregue.
                </p>
            </>
        );
    } else {
        const left = daysLeft(deadline.due_at);
        const overdue = left !== null && left < 0;
        const urgent = left !== null && left <= 5;
        const text = left === null ? '—'
            : overdue ? `Vencido há ${-left} ${-left === 1 ? 'dia' : 'dias'}`
                : left === 0 ? 'Vence hoje'
                    : `${left} ${left === 1 ? 'dia restante' : 'dias restantes'}`;
        main = (
            <>
                <p className={`text-sm font-extrabold leading-snug ${urgent ? 'text-red-600' : 'text-primary'}`}
                    data-testid="deadline-status" data-state={overdue ? 'overdue' : urgent ? 'urgent' : 'running'}>
                    {text}
                </p>
                <p className="text-[10.5px] text-gray-500 leading-snug mt-0.5" data-testid="deadline-start">
                    Início {formatDate(deadline.start_at)}{' '}
                    <span className="text-gray-400">· {deadline.start_source === 'manual' ? 'ajustado' : 'automático'}</span>
                </p>
                <p className="text-[10.5px] text-gray-500 leading-snug">
                    Vence {formatDate(deadline.due_at)}
                    {deadline.due_source === 'manual' && <span className="text-gray-400"> · ajustado</span>}
                </p>
            </>
        );
    }

    return (
        <div data-testid="claim-deadline">
            <div className="flex items-center justify-between gap-2">
                <span className="lbl inline-flex items-center gap-1"><Clock size={14} className="text-amber-500" />Prazo</span>
                {deadline?.can_adjust && (
                    <button type="button" onClick={() => setModalOpen(true)} className="text-[11px] font-semibold text-secondary hover:underline">
                        Ajustar prazo
                    </button>
                )}
            </div>
            <div className="mt-1">{main}</div>

            {history.length > 0 && (
                <div className="mt-2" data-testid="deadline-history">
                    <p className="text-[9.5px] font-bold uppercase tracking-widest text-gray-400">Histórico do prazo</p>
                    <ul className="mt-1 space-y-1.5">
                        {visible.map((h, i) => (
                            <li key={`${h.at}-${h.field}-${i}`} className="text-[10.5px] leading-snug text-gray-500 border-l-2 border-gray-200 pl-2">
                                <span className="font-semibold text-gray-700">{h.by_name || h.by_email || (h.source === 'auto' ? 'Sistema' : '—')}</span>
                                {' · '}{formatWhen(h.at)}
                                <br />
                                {FIELD_LABEL[h.field] || h.field}: {h.from ? formatDate(h.from) : '—'} → {formatDate(h.to)}
                                {h.justification && (<><br /><span className="italic">“{h.justification}”</span></>)}
                            </li>
                        ))}
                    </ul>
                    {history.length > 2 && (
                        <button type="button" onClick={() => setShowAll(v => !v)} className="mt-1 text-[10.5px] font-semibold text-secondary hover:underline">
                            {showAll ? 'mostrar menos' : `ver todos (${history.length})`}
                        </button>
                    )}
                </div>
            )}

            {/* Portal: o cartão usa backdrop-filter, que vira o bloco de
                contenção de qualquer "fixed" dentro dele — o modal ficaria
                preso ao cartão e atrás das abas. */}
            {modalOpen && deadline && createPortal(
                <AdjustDeadlineModal
                    deadline={deadline}
                    onClose={() => setModalOpen(false)}
                    onSave={async (body) => {
                        const next = await saveDeadlineAdjust(claim, body, currentUser);
                        setDeadline(next);
                        setModalOpen(false);
                    }}
                />,
                document.body,
            )}
        </div>
    );
}

function AdjustDeadlineModal({ deadline, onClose, onSave }) {
    const [start, setStart] = useState('');
    const [due, setDue] = useState('');
    const [justification, setJustification] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const justOk = justification.trim().length >= MIN_JUSTIFICATION;
    const canSubmit = justOk && (start || due) && !busy;

    const submit = async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setBusy(true);
        setError('');
        try {
            await onSave({
                ...(start ? { start_at: dateInputToISO(start) } : {}),
                ...(due ? { due_at: dateInputToISO(due) } : {}),
                justification: justification.trim(),
            });
        } catch (err) {
            setError(errorMessage(err));
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <form role="dialog" aria-modal="true" aria-labelledby="deadline-modal-title" data-testid="deadline-modal"
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()} onSubmit={submit}>
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h3 id="deadline-modal-title" className="text-lg font-black text-gray-900 font-display">Ajustar prazo</h3>
                    <button type="button" onClick={onClose} aria-label="Fechar" className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl">
                        <X size={18} />
                    </button>
                </div>
                <p className="text-xs text-gray-500 leading-snug">
                    Preencha só o que muda. Sem novo vencimento, ele passa a ser o início mais {deadline.total_days || 30} dias.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Novo início</span>
                        <input type="date" value={start} onChange={e => setStart(e.target.value)}
                            className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                        <span className="text-[10.5px] text-gray-400">Atual: {deadline.start_at ? formatDate(deadline.start_at) : 'não iniciado'}</span>
                    </label>
                    <label className="block">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Novo vencimento</span>
                        <input type="date" value={due} onChange={e => setDue(e.target.value)}
                            className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                        <span className="text-[10.5px] text-gray-400">Atual: {formatDate(deadline.due_at)}</span>
                    </label>
                </div>
                <label className="block">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Justificativa *</span>
                    <textarea value={justification} onChange={e => setJustification(e.target.value.slice(0, 500))} rows={3}
                        className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                    <span className={`text-[10.5px] ${justOk ? 'text-gray-400' : 'text-amber-600'}`}>
                        Mínimo de {MIN_JUSTIFICATION} caracteres. Fica no histórico do prazo e na auditoria.
                    </span>
                </label>
                {error && <p role="alert" className="text-sm font-semibold text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
                <div className="flex gap-2 pt-1">
                    <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold">Cancelar</button>
                    <button type="submit" disabled={!canSubmit} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed">
                        {busy ? 'Salvando…' : 'Salvar ajuste'}
                    </button>
                </div>
            </form>
        </div>
    );
}

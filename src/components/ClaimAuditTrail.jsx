import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, GitCommitVertical, Lock, RefreshCw } from 'lucide-react';
import { listProcessAudit } from '../api/processAudit';
import { mockListProcessAudit } from '../api/mockProcessAudit';
import { isMockEnabled } from '../api/client';
import {
    ACTION_GROUPS, EXTERNAL_ACTOR, absoluteTime, actionLabel, actorKey, actorName,
    assignColor, describeEvent, relativeTime,
} from '../constants/auditTrail';

const PAGE_SIZE = 50;
// Altura, dentro da linha, onde fica o ponto. Fixa (e não 50%) porque a linha
// cresce quando há justificativa: o ponto acompanha o título, não o meio.
const DOT_Y = 20;

const selectClass = 'w-full appearance-none bg-white/80 border border-gray-200 rounded-xl pl-3 pr-9 py-2.5 text-xs font-semibold text-gray-700 outline-none focus:border-secondary focus:ring-4 focus:ring-secondary/10 transition';

/**
 * Trilha de auditoria de um sinistro, em forma de grafo.
 *
 * Cada pessoa tem uma raia (coluna) com uma cor só dela; cada evento é um
 * ponto na raia de quem o fez, e a raia fica traçada enquanto aquela pessoa
 * está ativa no período — do evento mais novo ao mais antigo dela na tela,
 * como um git graph lido de cima para baixo. Acesso por link público ou
 * documento rastreado, que não tem autor, vai para a raia neutra "Acesso
 * externo".
 *
 * Sem polling: auditoria é consulta, e quem consulta pede de novo no botão.
 */
export default function ClaimAuditTrail({ processId }) {
    const [events, setEvents] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState('loading'); // loading | ready | error | forbidden
    const [loadingMore, setLoadingMore] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [personFilter, setPersonFilter] = useState('');
    const [actionFilter, setActionFilter] = useState('');

    // key → { name, email, color }. Só cresce: filtrar ou carregar mais nunca
    // troca a cor de ninguém nem tira a pessoa da legenda.
    const colorsRef = useRef(new Map());
    const [people, setPeople] = useState([]);
    const requestSeq = useRef(0);

    const remember = useCallback((batch) => {
        let changed = false;
        const known = new Map(people.map((p) => [p.key, p]));
        for (const ev of batch) {
            const key = actorKey(ev);
            if (known.has(key)) continue;
            known.set(key, { key, name: actorName(ev), email: ev.actor_email || null, color: assignColor(key, colorsRef.current) });
            changed = true;
        }
        if (changed) setPeople([...known.values()]);
    }, [people]);

    const fetchPage = useCallback(async (nextPage) => {
        const seq = ++requestSeq.current;
        const opts = {
            page: nextPage,
            limit: PAGE_SIZE,
            // "Acesso externo" não tem id para o servidor filtrar; o recorte é
            // feito aqui, sobre o que veio.
            actorUserId: personFilter && personFilter !== EXTERNAL_ACTOR ? personFilter : undefined,
            action: actionFilter || undefined,
        };
        const fetcher = isMockEnabled() ? mockListProcessAudit : listProcessAudit;
        const res = await fetcher(processId, opts);
        if (seq !== requestSeq.current) return null; // resposta de um filtro antigo
        return { data: Array.isArray(res?.data) ? res.data : [], total: typeof res?.total === 'number' ? res.total : 0 };
    }, [processId, personFilter, actionFilter]);

    const load = useCallback(async () => {
        setStatus('loading');
        setErrorMessage('');
        try {
            const res = await fetchPage(1);
            if (!res) return;
            setEvents(res.data);
            setTotal(res.total);
            setPage(1);
            setStatus('ready');
        } catch (err) {
            if (err?.status === 403) { setStatus('forbidden'); return; }
            setErrorMessage(err?.message || '');
            setStatus('error');
        }
    }, [fetchPage]);

    useEffect(() => { if (processId) load(); }, [processId, load]);
    useEffect(() => { remember(events); }, [events]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadMore = async () => {
        setLoadingMore(true);
        try {
            const res = await fetchPage(page + 1);
            if (!res) return;
            setEvents((prev) => {
                const seen = new Set(prev.map((e) => e.id));
                return [...prev, ...res.data.filter((e) => !seen.has(e.id))];
            });
            setTotal(res.total);
            setPage((p) => p + 1);
        } catch (err) {
            if (err?.status === 403) setStatus('forbidden');
            else { setErrorMessage(err?.message || ''); setStatus('error'); }
        } finally {
            setLoadingMore(false);
        }
    };

    const visible = useMemo(
        () => (personFilter === EXTERNAL_ACTOR ? events.filter((e) => !e.actor_user_id) : events),
        [events, personFilter],
    );

    // Raias na ordem em que a pessoa aparece de cima para baixo: carregar mais
    // só acrescenta raias à direita, nunca reordena as que já existem.
    const graph = useMemo(() => {
        const lanes = [];
        const laneOf = new Map();
        visible.forEach((ev, row) => {
            const key = actorKey(ev);
            if (!laneOf.has(key)) {
                laneOf.set(key, lanes.length);
                lanes.push({ key, first: row, last: row });
            } else {
                lanes[laneOf.get(key)].last = row;
            }
        });
        return { lanes, laneOf };
    }, [visible]);

    const colorOf = (key) => colorsRef.current.get(key) || assignColor(key, colorsRef.current);
    const hasMore = events.length < total;
    const filtering = Boolean(personFilter || actionFilter);

    return (
        <section className="bg-white/70 backdrop-blur-md border border-white/60 rounded-2xl shadow-[0_10px_30px_-12px_rgba(26,43,83,0.12)] p-4 sm:p-6" data-testid="audit-trail" aria-labelledby="audit-trail-title">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Auditoria</p>
                    <h3 id="audit-trail-title" className="font-display text-lg font-extrabold text-primary leading-tight">Trilha do sinistro</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {status === 'ready'
                            ? `${total} ${total === 1 ? 'evento' : 'eventos'}${filtering ? ' com os filtros aplicados' : ''}`
                            : 'Quem fez o quê, e quando.'}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={load}
                    disabled={status === 'loading'}
                    className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-[10px] font-black uppercase tracking-widest text-gray-600 hover:text-primary hover:border-primary/30 transition disabled:opacity-50"
                    aria-label="Atualizar trilha de auditoria"
                >
                    <RefreshCw size={14} className={status === 'loading' ? 'animate-spin' : ''} />
                    <span className="hidden sm:inline">Atualizar</span>
                </button>
            </div>

            {status !== 'forbidden' && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pessoa</span>
                        <span className="relative block mt-1">
                            <select value={personFilter} onChange={(e) => setPersonFilter(e.target.value)} className={selectClass} aria-label="Filtrar por pessoa">
                                <option value="">Todas as pessoas</option>
                                {people.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </span>
                    </label>
                    <label className="block">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Tipo de ação</span>
                        <span className="relative block mt-1">
                            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className={selectClass} aria-label="Filtrar por tipo de ação">
                                <option value="">Todas as ações</option>
                                {ACTION_GROUPS.map((g) => (
                                    <optgroup key={g.label} label={g.label}>
                                        {Object.entries(g.actions).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                                    </optgroup>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </span>
                    </label>
                </div>
            )}

            {people.length > 0 && status !== 'forbidden' && (
                <ul className="mt-4 flex flex-wrap gap-2" aria-label="Legenda de pessoas" data-testid="audit-legend">
                    {people.map((p) => (
                        <li key={p.key}>
                            <button
                                type="button"
                                onClick={() => setPersonFilter((cur) => (cur === p.key ? '' : p.key))}
                                aria-pressed={personFilter === p.key}
                                title={p.email || p.name}
                                className={`inline-flex items-center gap-2 pl-2 pr-3 py-1 rounded-full border text-[11px] font-semibold transition ${personFilter === p.key ? 'bg-primary text-white border-primary' : 'bg-white/80 border-gray-200 text-gray-700 hover:border-gray-300'}`}
                            >
                                <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={p.key === EXTERNAL_ACTOR
                                        ? { border: `2px solid ${p.color}`, background: 'white' }
                                        : { background: p.color }}
                                    data-color={p.color}
                                />
                                {p.name}
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <div className="mt-5">
                {status === 'loading' && (
                    <div className="space-y-3" data-testid="audit-loading" aria-busy="true">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-3 animate-pulse">
                                <div className="w-3 h-3 rounded-full bg-gray-200" />
                                <div className="flex-1 space-y-1.5">
                                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                                    <div className="h-2.5 bg-gray-100 rounded w-1/3" />
                                </div>
                            </div>
                        ))}
                        <span className="sr-only">Carregando auditoria…</span>
                    </div>
                )}

                {status === 'forbidden' && (
                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200" role="status">
                        <Lock size={18} className="text-slate-400 mt-0.5 shrink-0" />
                        <p className="text-sm font-semibold text-slate-600">Você não tem permissão para ver a auditoria deste sinistro.</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200" role="alert">
                        <AlertCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-red-800">Não foi possível carregar a auditoria.</p>
                            {errorMessage && <p className="text-xs text-red-700 mt-0.5 break-words">{errorMessage}</p>}
                        </div>
                        <button type="button" onClick={load} className="shrink-0 px-3 py-1.5 rounded-xl bg-white border border-red-200 text-[10px] font-black uppercase tracking-widest text-red-700 hover:bg-red-100">
                            Tentar novamente
                        </button>
                    </div>
                )}

                {status === 'ready' && visible.length === 0 && (
                    <div className="py-10 flex flex-col items-center text-center gap-2" data-testid="audit-empty">
                        <GitCommitVertical size={32} className="text-gray-300" />
                        <p className="text-sm font-bold text-gray-500">
                            {filtering ? 'Nenhum evento com esses filtros.' : 'Nenhum evento registrado neste sinistro ainda.'}
                        </p>
                        {filtering && (
                            <button type="button" onClick={() => { setPersonFilter(''); setActionFilter(''); }} className="text-xs font-bold text-secondary hover:underline">
                                Limpar filtros
                            </button>
                        )}
                    </div>
                )}

                {status === 'ready' && visible.length > 0 && (
                    <ol className="[--lane:12px] sm:[--lane:20px]" data-testid="audit-graph" data-lanes={graph.lanes.length}>
                        {visible.map((ev, row) => {
                            const key = actorKey(ev);
                            const lane = graph.laneOf.get(key);
                            const color = colorOf(key);
                            const { subject, detail, note } = describeEvent(ev);
                            const external = key === EXTERNAL_ACTOR;
                            return (
                                <li key={ev.id ?? row} className="flex items-stretch" data-testid="audit-event" data-actor={key} data-lane={lane} data-action={ev.action}>
                                    <div
                                        className="relative shrink-0"
                                        style={{ width: `calc(var(--lane) * ${graph.lanes.length} + 6px)` }}
                                        aria-hidden="true"
                                    >
                                        {graph.lanes.map((l, i) => {
                                            if (row < l.first || row > l.last || l.first === l.last) return null;
                                            const top = row === l.first ? DOT_Y : 0;
                                            return (
                                                <span
                                                    key={l.key}
                                                    className="absolute w-0.5 rounded-full"
                                                    style={{
                                                        left: `calc(var(--lane) * ${i} + var(--lane) / 2 - 1px)`,
                                                        top,
                                                        ...(row === l.last ? { height: DOT_Y - top } : { bottom: 0 }),
                                                        background: colorOf(l.key),
                                                        opacity: 0.45,
                                                    }}
                                                />
                                            );
                                        })}
                                        <span
                                            className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white shadow-sm"
                                            style={{
                                                left: `calc(var(--lane) * ${lane} + var(--lane) / 2)`,
                                                top: DOT_Y,
                                                background: external ? 'white' : color,
                                                border: external ? `2.5px solid ${color}` : 'none',
                                            }}
                                        />
                                    </div>
                                    <div className={`flex-1 min-w-0 pl-2 sm:pl-3 py-2.5 ${row < visible.length - 1 ? 'border-b border-gray-100/80' : ''}`}>
                                        <p className="text-[13px] leading-snug text-gray-800">
                                            <span className="font-bold text-primary">{actionLabel(ev.action)}</span>
                                            {subject && <span className="font-semibold text-gray-700 [overflow-wrap:anywhere]"> · {subject}</span>}
                                            {detail && <span className="text-gray-500"> · {detail}</span>}
                                        </p>
                                        {note && (
                                            <p className="mt-1 text-xs text-gray-600 italic border-l-2 pl-2 break-words" style={{ borderColor: color }}>
                                                “{note}”
                                            </p>
                                        )}
                                        <p className="mt-1 text-[11px] text-gray-500 flex flex-wrap items-center gap-x-1.5">
                                            <span className="font-bold" style={{ color }} title={ev.actor_email || undefined}>{actorName(ev)}</span>
                                            <span aria-hidden="true">·</span>
                                            <time dateTime={ev.timestamp} title={absoluteTime(ev.timestamp)}>{relativeTime(ev.timestamp)}</time>
                                            <span aria-hidden="true" className="hidden sm:inline">·</span>
                                            <span className="hidden sm:inline text-gray-400">{absoluteTime(ev.timestamp)}</span>
                                        </p>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                )}

                {status === 'ready' && hasMore && (
                    <div className="mt-4 flex justify-center">
                        <button
                            type="button"
                            onClick={loadMore}
                            disabled={loadingMore}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/5 border border-primary/10 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition disabled:opacity-50"
                        >
                            {loadingMore ? 'Carregando…' : `Carregar mais (${total - events.length})`}
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}

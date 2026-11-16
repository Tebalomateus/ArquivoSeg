import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Search, Loader2, Pencil, Trash2, Send, MessageSquare } from 'lucide-react';
import { useCan } from '../context/PermissionsContext';
import { useConfirm } from './ConfirmDialog';
import {
    listDeckComments, createDeckComment, updateDeckComment, deleteDeckComment,
    beforeReturn, isOwnComment,
} from '../api/deckComments';

const TEAL_GRAD = 'linear-gradient(160deg,#17B39C,#0E8A78)';

const fmt = (iso) => {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return '';
    return new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Fila de comentários de um deck: o que cada pessoa disse sobre aquela
// comprovação, do mais antigo ao mais novo. Um comentário vale como prova do
// deck (dá para enviar sem arquivo), então a fila mostra também o que deixou de
// valer: o que veio antes de uma devolução e o que era de um deck desfeito.
//
// "Todos os decks" busca no sinistro inteiro, inclusive nos decks que já não
// estão no quadro — o comentário é do deck, e o histórico fica.
export default function DeckComments({ claimId, deck, decks, online, currentUser, onClose, onChanged }) {
    const can = useCan();
    const ask = useConfirm();
    const canList = can('comentario.listar');
    const canCreate = can('comentario.criar');

    const [scope, setScope] = useState('deck'); // 'deck' | 'all'
    const [query, setQuery] = useState('');
    const [q, setQ] = useState('');             // query com debounce
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [editing, setEditing] = useState(null); // { id, body }
    const listRef = useRef(null);

    const deckById = useMemo(() => new Map((decks || []).map(d => [d.id, d])), [decks]);

    useEffect(() => {
        const t = setTimeout(() => setQ(query.trim()), 300);
        return () => clearTimeout(t);
    }, [query]);

    const load = useCallback(async () => {
        if (!canList) { setLoading(false); return; }
        setLoading(true);
        setError('');
        try {
            const list = await listDeckComments(claimId, { deckId: scope === 'deck' ? deck.id : undefined, q }, { online, decks });
            setItems(list);
        } catch (err) {
            setError(err?.message || 'Falha ao carregar os comentários.');
        } finally {
            setLoading(false);
        }
    }, [canList, claimId, scope, deck.id, q, online, decks]);

    useEffect(() => { load(); }, [load]);

    // A fila cresce para baixo; quem abre quer ver o último.
    useEffect(() => {
        if (!loading && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, [loading, items.length]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' && !editing) onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, editing]);

    const send = async () => {
        const body = draft.trim();
        if (!body || sending) return;
        setSending(true);
        setError('');
        try {
            await createDeckComment(claimId, deck, body, { online, currentUser });
            setDraft('');
            await load();
            onChanged?.();
        } catch (err) {
            setError(err?.code === 'DECK_NOT_FOUND'
                ? 'Este deck não está mais no quadro; não aceita comentário novo.'
                : (err?.message || 'Falha ao enviar o comentário.'));
        } finally {
            setSending(false);
        }
    };

    const saveEdit = async () => {
        const body = editing.body.trim();
        if (!body) return;
        try {
            await updateDeckComment(claimId, editing.id, body, { online });
            setEditing(null);
            await load();
        } catch (err) {
            setError(err?.message || 'Falha ao salvar o comentário.');
        }
    };

    const remove = async (c) => {
        const ok = await ask({
            title: 'Excluir o comentário?',
            message: 'Se ele era a única comprovação do deck, o deck volta a precisar de arquivo ou de outro comentário para ser enviado.',
            detail: c.body.length > 120 ? `${c.body.slice(0, 120)}…` : c.body,
            confirmLabel: 'Excluir',
            tone: 'danger',
        });
        if (!ok) return;
        try {
            await deleteDeckComment(claimId, c.id, { online });
            await load();
            onChanged?.();
        } catch (err) {
            setError(err?.message || 'Falha ao excluir o comentário.');
        }
    };

    const mayEdit = (c) => can('comentario.editarQualquer') || (can('comentario.editarProprio') && isOwnComment(c, currentUser));
    const mayDelete = (c) => can('comentario.excluirQualquer') || (can('comentario.excluirProprio') && isOwnComment(c, currentUser));

    // Devolvido e ainda sem comentário depois da devolução: o que está na fila
    // não serve mais de prova.
    const needsNew = !!deck.devolvidoAt && scope === 'deck' && !q
        && !items.some(c => !beforeReturn(c, deck));

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}
            onClick={onClose} className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(15,23,42,.42)] p-4 backdrop-blur-[3px]">
            <motion.div initial={{ opacity: 0, y: 12, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.99 }}
                transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }} onClick={(e) => e.stopPropagation()}
                role="dialog" aria-label={`Comentários do ${deck.codigo}`} data-testid="deck-comments"
                className="flex max-h-[88vh] w-full max-w-[560px] flex-col rounded-[20px] bg-white p-6 shadow-[0_40px_80px_-30px_rgba(15,23,42,.5)]">
                <div className="flex items-center gap-2">
                    <p className="text-[10px] font-extrabold tracking-[0.14em] text-slate-400 uppercase">Comentários</p>
                    <span className="rounded-lg bg-[#2563EB] px-[9px] py-[5px] text-[10px] font-extrabold uppercase tracking-wider text-white">{deck.codigo}</span>
                    <button type="button" onClick={onClose} aria-label="Fechar" className="ml-auto text-slate-400 hover:text-slate-700"><X size={18} /></button>
                </div>

                {!canList ? (
                    <p className="mt-4 rounded-[12px] bg-[#F4F7FB] p-4 text-[12.5px] font-semibold text-slate-500">
                        Você não tem permissão para ver os comentários deste sinistro.
                    </p>
                ) : (
                    <>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <div className="flex rounded-[10px] bg-[#F4F7FB] p-[3px]" role="group" aria-label="Onde buscar">
                                {[['deck', 'Este deck'], ['all', 'Todos os decks']].map(([v, label]) => (
                                    <button key={v} type="button" onClick={() => setScope(v)} aria-pressed={scope === v}
                                        data-testid={`deck-comments-scope-${v}`}
                                        className={`rounded-[8px] px-[11px] py-[6px] text-[11px] font-extrabold ${scope === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <label className="flex min-w-[180px] flex-1 items-center gap-2 rounded-[10px] border border-[#D7E0EC] bg-white px-[10px] py-[7px]">
                                <Search size={13} className="shrink-0 text-slate-400" />
                                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar nos comentários…"
                                    aria-label="Buscar nos comentários" data-testid="deck-comments-search"
                                    className="min-w-0 flex-1 text-[12.5px] font-semibold text-slate-700 outline-none placeholder:font-medium placeholder:text-slate-400" />
                                {query && <button type="button" onClick={() => setQuery('')} aria-label="Limpar busca" className="text-slate-400 hover:text-slate-700"><X size={13} /></button>}
                            </label>
                        </div>

                        <div ref={listRef} className="mt-3 min-h-[120px] flex-1 space-y-2 overflow-y-auto pr-1" data-testid="deck-comments-list">
                            {loading ? (
                                <div className="flex items-center justify-center gap-2 p-6 text-[12px] font-bold text-slate-400"><Loader2 size={14} className="animate-spin" /> Carregando…</div>
                            ) : items.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 p-6 text-center text-[12px] font-semibold text-slate-400">
                                    <MessageSquare size={20} />
                                    {q ? 'Nenhum comentário com esse texto.' : scope === 'deck' ? 'Nenhum comentário neste deck ainda.' : 'Nenhum comentário nos decks deste sinistro.'}
                                </div>
                            ) : items.map(c => {
                                const own = deckById.get(c.deckId);
                                const old = !c.deckDesfeito && beforeReturn(c, own);
                                const isEditing = editing?.id === c.id;
                                return (
                                    <div key={c.id} data-testid="deck-comment-item"
                                        className={`rounded-[12px] border p-[10px_12px] ${c.deckDesfeito || old ? 'border-[#E8ECF2] bg-[#F8FAFC]' : 'border-[#E4EBF6] bg-white'}`}>
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                            <span className="text-[12px] font-extrabold text-slate-800">{c.authorName || c.authorEmail || 'Usuário removido'}</span>
                                            <span className="text-[10.5px] font-bold text-slate-400">{fmt(c.createdAt)}</span>
                                            {scope === 'all' && c.deckCodigo && (
                                                <span data-testid={c.deckDesfeito ? 'deck-comment-desfeito' : undefined}
                                                    className={`rounded-md px-[7px] py-[2px] text-[9.5px] font-extrabold uppercase tracking-wider ${c.deckDesfeito ? 'bg-slate-200 text-slate-500' : 'bg-[#EAF1FE] text-[#2563EB]'}`}>
                                                    {c.deckCodigo}{c.deckDesfeito ? ' desfeito' : ''}
                                                </span>
                                            )}
                                            {scope === 'deck' && c.deckDesfeito && (
                                                <span data-testid="deck-comment-desfeito" className="rounded-md bg-slate-200 px-[7px] py-[2px] text-[9.5px] font-extrabold uppercase tracking-wider text-slate-500">desfeito</span>
                                            )}
                                            {old && (
                                                <span data-testid="deck-comment-before-return"
                                                    title="Escrito antes da devolução; não comprova mais o deck."
                                                    className="rounded-md bg-[#FEF3E2] px-[7px] py-[2px] text-[9.5px] font-extrabold uppercase tracking-wider text-[#B45309]">
                                                    anterior à devolução
                                                </span>
                                            )}
                                            {!isEditing && (mayEdit(c) || mayDelete(c)) && (
                                                <span className="ml-auto flex items-center gap-1">
                                                    {mayEdit(c) && (
                                                        <button type="button" onClick={() => setEditing({ id: c.id, body: c.body })} aria-label="Editar comentário"
                                                            className="rounded p-1 text-slate-400 hover:text-[#2563EB]"><Pencil size={12} /></button>
                                                    )}
                                                    {mayDelete(c) && (
                                                        <button type="button" onClick={() => remove(c)} aria-label="Excluir comentário"
                                                            className="rounded p-1 text-slate-400 hover:text-[#E11D48]"><Trash2 size={12} /></button>
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                        {isEditing ? (
                                            <div className="mt-2">
                                                <textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                                                    onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditing(null); } }}
                                                    aria-label="Editar comentário" rows={3} autoFocus
                                                    className="w-full resize-y rounded-[10px] border border-[#D7E0EC] p-[8px_10px] text-[12.5px] text-slate-700 outline-none focus:border-[#12A08B]" />
                                                <div className="mt-1.5 flex justify-end gap-2">
                                                    <button type="button" onClick={() => setEditing(null)} className="rounded-[9px] px-3 py-[6px] text-[11px] font-extrabold text-slate-500 hover:text-slate-800">Cancelar</button>
                                                    <button type="button" onClick={saveEdit} disabled={!editing.body.trim()} style={{ background: TEAL_GRAD }}
                                                        className="rounded-[9px] px-3 py-[6px] text-[11px] font-extrabold text-white disabled:opacity-50">Salvar</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className={`mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed ${c.deckDesfeito || old ? 'text-slate-500' : 'text-slate-700'}`}>{c.body}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {error && <p role="alert" className="mt-2 text-[11.5px] font-bold text-[#E11D48]">{error}</p>}

                {needsNew && !loading && items.length > 0 && (
                    <p data-testid="deck-comments-needs-new" className="mt-2 rounded-[10px] border border-[#FBE3BF] bg-[#FEF9F1] p-[7px_9px] text-[11px] leading-snug text-[#B45309]">
                        O deck foi devolvido depois desses comentários. Para reenviar sem arquivo, escreva um comentário novo.
                    </p>
                )}

                {canCreate && (
                    <div className="mt-3 flex items-end gap-2 border-t border-[#EEF2F7] pt-3">
                        <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}
                            placeholder={`Comentar no ${deck.codigo}…`} aria-label="Novo comentário" rows={2} maxLength={10000}
                            data-testid="deck-comment-input"
                            className="min-w-0 flex-1 resize-none rounded-[12px] border border-[#D7E0EC] p-[9px_11px] text-[12.5px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#12A08B]" />
                        <button type="button" onClick={send} disabled={!draft.trim() || sending} data-testid="deck-comment-send"
                            style={{ background: TEAL_GRAD }}
                            className="flex items-center gap-1 rounded-[10px] px-[14px] py-[10px] text-[11.5px] font-extrabold text-white disabled:opacity-50">
                            {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Comentar
                        </button>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}

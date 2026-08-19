import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Upload, ArrowRight, Loader2, Plus, Eye, Download, Link2, FolderInput } from 'lucide-react';
import { uploadFile, listFiles, formatBytes, openDocument, parseFolderFromFileName } from '../api/files';
import { isMockEnabled, getToken } from '../api/client';
import * as deckApi from '../api/decks';
import * as board from '../api/deckBoard';
import { useCan } from '../context/PermissionsContext';

const { STATUS } = board;

// Group accent palette — the checklist stages are dynamic, so we cycle a fixed
// palette (blue = analista/CAUSA, amber = PREJUÍZO, teal = DOCUMENTOS, …) by tab index.
const GROUP_STYLES = [
    { text: '#2563EB', chipBg: '#EAF1FE' },
    { text: '#B45309', chipBg: '#FEF3E2' },
    { text: '#0E8A78', chipBg: '#E7F6F2' },
    { text: '#7C3AED', chipBg: '#F1EAFE' },
];

const TEAL_GRAD = 'linear-gradient(160deg,#17B39C,#0E8A78)';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Extension badge text: uppercase, max 4 chars, "DOC" fallback.
function extBadge(name) {
    const m = /\.([A-Za-z0-9]+)$/.exec(name || '');
    if (!m) return 'DOC';
    return m[1].toUpperCase().slice(0, 4);
}

const persistKey = (claimId) => `deckboard_${claimId}`;
const filesKey = (claimId) => `deckfiles_${claimId}`;

// O arquivo do processo, como o board precisa dele. O nome vem do servidor com o
// prefixo de pasta que o upload embute ("causa__laudo.pdf"); quem lê a tela quer
// o nome do documento.
const toFileRef = (fv) => ({
    fileVerId: fv.id || fv.ID,
    nome: parseFolderFromFileName(fv.file_name || fv.fileName || '').name,
    tamanho: fv.size_bytes ?? fv.sizeBytes,
});

/**
 * Kanban de Comprovação Documental (Decks de Arquivos).
 * A deck groups N files × N checklist tasks and moves Pendente → Enviado → Atendido.
 * Rendered as a view-mode inside ClaimDetails, scoped to a single process.
 */
export default function KanbanBoard({ claim, currentUser, folderId, onCreateTask }) {
    const [tabs, setTabs] = useState([]);       // [{ id, title, tasks: [{key,label}] }] — one per repository folder
    const [tab, setTab] = useState(folderId || null);
    const [state, setState] = useState(board.emptyBoard());
    const [loading, setLoading] = useState(true);

    const [sel, setSel] = useState({});         // taskKey -> true (loose tasks only)
    const [upload, setUpload] = useState(null); // { title, onFiles, joinHint }
    const [joinHint, setJoinHint] = useState(false);
    const [reviewId, setReviewId] = useState(null);
    const [busy, setBusy] = useState(false);
    const [processFiles, setProcessFiles] = useState([]); // todo arquivo do processo, com deck ou sem
    const [linking, setLinking] = useState(null);         // arquivo avulso escolhido para vincular
    const [newTask, setNewTask] = useState('');           // rascunho do nome da tarefa avulsa
    const [addingTask, setAddingTask] = useState(false);
    const [zipping, setZipping] = useState(null); // deckId whose archive is downloading

    // Drag state (discriminated by kind, per the handoff).
    const drag = useRef({ kind: null, id: null });
    const [hotDeck, setHotDeck] = useState(null);
    const [hotCol, setHotCol] = useState(false);

    const can = useCan();
    const online = !isMockEnabled() && !!getToken();
    const actor = currentUser?.name || currentUser?.email || '';
    // Reviewing a deck is a permission now, not a rung on the role ladder: a
    // tenant can hand deck.analisar to whoever it wants. The demo switch stays
    // flag-gated and still simulates the two sides of that permission.
    const canAnalyse = can('deck.analisar');
    const demoSwitch = import.meta.env.VITE_DEMO_ROLE_SWITCH === 'true';
    // null = ninguém tocou no interruptor, então ele segue a permissão. Guardar
    // canAnalyse no estado inicial congelava o lado errado: as permissões chegam
    // por HTTP, e na primeira renderização elas ainda não chegaram.
    const [demoRole, setDemoRole] = useState(null);
    const effectiveDemoRole = demoRole ?? (canAnalyse ? 'analista' : 'perito');
    const isAnalyst = demoSwitch ? effectiveDemoRole === 'analista' : canAnalyse;

    // ── Groups = repository folders (driven by the left sidebar in ClaimDetails).
    // One group per folder; tasks come from that folder's checklist.
    useEffect(() => {
        const built = (claim.folders || [])
            .map(f => ({ id: f.id, title: f.name, tasks: (f.checklist || []).map(i => ({ key: `${f.id}.${i.id}`, label: i.name })) }));
        setTabs(built);
    }, [claim.folders]);

    // The active group follows the folder selected in the left sidebar.
    useEffect(() => {
        if (folderId) setTab(folderId);
    }, [folderId]);

    // ── Board load (server, or persisted mock) ──────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        const load = async () => {
            if (online) {
                try {
                    const raw = await deckApi.listDecks(claim.id);
                    if (!cancelled) setState(board.normalizeBoard(raw));
                } catch {
                    if (!cancelled) setState(board.emptyBoard());
                }
            } else {
                let stored = null;
                try { stored = JSON.parse(sessionStorage.getItem(persistKey(claim.id)) || 'null'); } catch { /* ignore */ }
                if (!cancelled) setState(board.normalizeBoard(stored));
            }
            if (!cancelled) setLoading(false);
        };
        load();
        return () => { cancelled = true; };
    }, [claim.id, online]);

    // Persist the mock board so switching view-modes doesn't lose work.
    useEffect(() => {
        if (!online && !loading) {
            try { sessionStorage.setItem(persistKey(claim.id), JSON.stringify(state)); } catch { /* ignore */ }
        }
    }, [state, online, loading, claim.id]);

    // ── Arquivos do processo ────────────────────────────────────────────────────
    // O que sobra depois de tirar o que já está em algum deck é o avulso. Guardar
    // uma lista própria de "soltos" seria uma segunda verdade sobre os mesmos
    // arquivos, e as duas divergiriam no primeiro erro de rede.
    useEffect(() => {
        let cancelled = false;
        if (online) {
            listFiles(claim.id)
                .then(res => { if (!cancelled) setProcessFiles((Array.isArray(res?.data) ? res.data : res || []).map(toFileRef)); })
                .catch(() => { /* sem arquivo.listar o painel fica vazio, e é o correto */ });
        } else {
            let stored = null;
            try { stored = JSON.parse(sessionStorage.getItem(filesKey(claim.id)) || 'null'); } catch { /* ignore */ }
            if (!cancelled) setProcessFiles(Array.isArray(stored) ? stored : []);
        }
        return () => { cancelled = true; };
    }, [claim.id, online]);

    useEffect(() => {
        if (!online && !loading) {
            try { sessionStorage.setItem(filesKey(claim.id), JSON.stringify(processFiles)); } catch { /* ignore */ }
        }
    }, [processFiles, online, loading, claim.id]);

    // Changing tab clears the ephemeral selection and any open review modal.
    useEffect(() => { setSel({}); setReviewId(null); }, [tab]);

    // ── Derived view data (scoped to the active tab) ────────────────────────────
    const activeTab = tabs.find(t => t.id === tab);
    const tabIndex = Math.max(0, tabs.findIndex(t => t.id === tab));
    const accent = GROUP_STYLES[tabIndex % GROUP_STYLES.length];

    const inDeck = useMemo(() => {
        const s = new Set();
        state.decks.forEach(d => d.tarefaIds.forEach(k => s.add(k)));
        return s;
    }, [state.decks]);

    const looseTasks = (activeTab?.tasks || []).filter(t => !inDeck.has(t.key));

    // Arquivo avulso: está no processo e nenhum deck o referencia. Vale para o
    // sinistro inteiro, não para a pasta aberta — quem sobe um documento antes de
    // saber a que tarefa ele responde normalmente ainda não escolheu a pasta.
    const looseFiles = useMemo(() => {
        const used = new Set();
        state.decks.forEach(d => { d.arquivos.forEach(f => { used.add(f.fileVerId); }); });
        return processFiles.filter(f => f.fileVerId && !used.has(f.fileVerId));
    }, [processFiles, state.decks]);
    const tabDecks = state.decks.filter(d => d.grupo === tab);
    const pendingDecks = tabDecks.filter(d => d.status === STATUS.PENDENTE);
    const sentDecks = tabDecks.filter(d => d.status === STATUS.ENVIADO);
    const doneDecks = tabDecks.filter(d => d.status === STATUS.ATENDIDO);

    const selCount = Object.keys(sel).length;
    const reviewDeck = state.decks.find(d => d.id === reviewId) || null;

    // Per-tab progress = atendidas / total (scoped to the active tab).
    const progress = useMemo(() => {
        const tasks = activeTab?.tasks || [];
        const done = tasks.filter(t => state.taskStatus[t.key] === STATUS.ATENDIDO).length;
        return { done, total: tasks.length };
    }, [activeTab, state.taskStatus]);

    const labelFor = useCallback((key) => {
        for (const t of tabs) { const hit = t.tasks.find(x => x.key === key); if (hit) return hit.label; }
        return key;
    }, [tabs]);

    // ── Mutations: apply locally (optimistic), reconcile with server, rollback ──
    const run = useCallback(async (optimistic, remote) => {
        if (busy) return;
        const prev = state;
        let next;
        try { next = optimistic(); } catch (err) { alert(err.message); return; }
        setState(next.board);
        if (!online) return;
        setBusy(true);
        try {
            const raw = await remote();
            if (raw) setState(board.normalizeBoard(raw));
        } catch (err) {
            setState(prev); // rollback — the board never lies about persisted state
            alert(err?.message || 'Falha ao salvar. Recarregue e tente de novo.');
        } finally {
            setBusy(false);
        }
    }, [busy, state, online]);

    // Turn selected File objects into deck file refs (real upload, or mock stub).
    const toRefs = useCallback(async (files) => {
        const refs = [];
        for (const file of files) {
            if (online) {
                const fv = await uploadFile(claim.id, file, null);
                refs.push({ fileVerId: fv?.id || fv?.ID, nome: file.name, tamanho: file.size });
            } else {
                // Mock: no backend to store bytes, so keep a session object-URL for preview.
                refs.push({ fileVerId: `mock-${Math.random().toString(36).slice(2, 10)}`, nome: file.name, tamanho: file.size, url: URL.createObjectURL(file) });
            }
        }
        return refs;
    }, [online, claim.id]);

    const openUploadForTask = (taskKey) => setUpload({
        title: labelFor(taskKey),
        // Subir por uma tarefa é o caminho que todo mundo acha sozinho, e ele
        // cria um deck de uma tarefa só. Quem para por aí acaba com quatro decks
        // de um documento cada, quando o analista queria um. A dica é lançada
        // daqui — o momento em que a pessoa acabou de fazer exatamente isso.
        joinHint: looseTasks.length > 1,
        onFiles: async (files) => {
            const arquivos = await toRefs(files);
            await run(
                () => board.createDeck(state, { tarefaIds: [taskKey], arquivos }, actor),
                () => deckApi.createDeck(claim.id, { tarefaIds: [taskKey], arquivos }),
            );
        },
    });

    const openUploadForSelection = () => {
        const keys = Object.keys(sel);
        setUpload({
            title: plural(keys.length, 'tarefa selecionada', 'tarefas selecionadas'),
            onFiles: async (files) => {
                const arquivos = await toRefs(files);
                await run(
                    () => board.createDeck(state, { tarefaIds: keys, arquivos }, actor),
                    () => deckApi.createDeck(claim.id, { tarefaIds: keys, arquivos }),
                );
                setSel({});
            },
        });
    };

    const openUploadForDeck = (deckId) => setUpload({
        title: `Adicionar arquivo ao ${state.decks.find(d => d.id === deckId)?.codigo || 'deck'}`,
        onFiles: async (files) => {
            const arquivos = await toRefs(files);
            await run(
                () => board.addFiles(state, deckId, arquivos),
                () => deckApi.addDeckFiles(claim.id, deckId, arquivos),
            );
        },
    });

    // Subir sem tarefa nenhuma. O documento chega antes da conversa sobre a qual
    // item ele responde — e obrigar a escolher agora faz a pessoa chutar, o que
    // custa mais caro do que deixá-lo esperando aqui.
    const openUploadLoose = () => setUpload({
        title: 'Documentos avulsos',
        note: 'Ficam guardados no sinistro sem comprovar nada até você vinculá-los a uma tarefa.',
        onFiles: async (files) => {
            const arquivos = await toRefs(files);
            setProcessFiles(prev => [...prev, ...arquivos]);
        },
    });

    // Vincular um avulso: a um deck que já existe, ou a uma tarefa ainda solta —
    // aí o deck nasce com ele dentro.
    const linkFileToDeck = (file, deckId) => {
        setLinking(null);
        run(
            () => board.addFiles(state, deckId, [file]),
            () => deckApi.addDeckFiles(claim.id, deckId, [file]),
        );
    };

    const linkFileToTask = (file, taskKey) => {
        setLinking(null);
        run(
            () => board.createDeck(state, { tarefaIds: [taskKey], arquivos: [file] }, actor),
            () => deckApi.createDeck(claim.id, { tarefaIds: [taskKey], arquivos: [file] }),
        );
    };

    // Tarefa que o checklist do tipo de sinistro não previu. Ela nasce solta em
    // Pendente, na pasta aberta, e daí em diante é uma tarefa como as outras.
    const submitNewTask = async () => {
        const name = newTask.trim();
        if (!name || !tab || addingTask) return;
        setAddingTask(true);
        try {
            await onCreateTask(tab, name);
            setNewTask('');
        } catch (err) {
            alert(err?.message || 'Não foi possível criar a tarefa.');
        } finally {
            setAddingTask(false);
        }
    };

    const attachSelectionTo = (deckId) => {
        const keys = Object.keys(sel);
        run(
            () => board.attachTasks(state, deckId, keys),
            () => deckApi.attachTasks(claim.id, deckId, keys),
        );
        setSel({});
    };

    const attachTaskTo = (deckId, taskKey) => run(
        () => board.attachTasks(state, deckId, [taskKey]),
        () => deckApi.attachTasks(claim.id, deckId, [taskKey]),
    );

    const detachTask = (deckId, key) => run(
        () => board.detachTask(state, deckId, key),
        () => deckApi.detachTask(claim.id, deckId, key),
    );

    const removeFile = (deckId, fileVerId) => run(
        () => board.removeFile(state, deckId, fileVerId),
        () => deckApi.removeDeckFile(claim.id, deckId, fileVerId),
    );

    const submit = (deckId) => run(
        () => board.submitDeck(state, deckId),
        () => deckApi.submitDeck(claim.id, deckId),
    );

    // Open a deck file: session object-URL in mock, presigned download in prod.
    const viewFile = useCallback(async (f) => {
        if (f?.url) { window.open(f.url, '_blank', 'noopener,noreferrer'); return; }
        if (online && f?.fileVerId) {
            try { await openDocument(f.fileVerId); }
            catch (err) { alert(`Falha ao abrir o documento: ${err?.message || err}`); }
            return;
        }
        alert('Pré-visualização indisponível para este arquivo (envie novamente nesta sessão ou use o backend real).');
    }, [online]);

    // Baixar o deck inteiro. O servidor monta o zip enquanto responde — não há
    // "preparando o arquivo" para esperar nem nada empacotado guardado no S3, o
    // que também significa que o que chega é o deck como ele está agora.
    //
    // O <a download> tem de ser criado aqui porque a rota exige o Bearer: um href
    // direto sai sem cabeçalho nenhum e volta 401.
    const canDownloadArchive = online && can('deck.baixarArquivos');

    const downloadArchive = useCallback(async (deck) => {
        if (!online || zipping) return;
        setZipping(deck.id);
        try {
            const { blob, fileName } = await deckApi.downloadDeckArchive(claim.id, deck.id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName || `${deck.codigo || 'deck'}.zip`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            // Revogar no próximo tick: revogar em seguida ao click chega a vencer
            // o download em alguns navegadores, e o arquivo sai vazio.
            setTimeout(() => URL.revokeObjectURL(url), 0);
        } catch (err) {
            alert(`Falha ao baixar os arquivos do deck: ${err?.message || err}`);
        } finally {
            setZipping(null);
        }
    }, [claim.id, online, zipping]);

    const analyze = (deckId, devolvidas, motivo) => {
        run(
            () => board.analyzeDeck(state, deckId, devolvidas, motivo, actor),
            () => deckApi.analyzeDeck(claim.id, deckId, { devolvidas, motivo }),
        );
        setReviewId(null);
    };

    // ── Selection ────────────────────────────────────────────────────────────────
    const toggleSel = (key) => setSel(prev => {
        const n = { ...prev };
        if (n[key]) delete n[key]; else n[key] = true;
        return n;
    });

    const clickTask = (key) => {
        if (selCount > 0) toggleSel(key);       // with selection active, body click toggles too
        else openUploadForTask(key);
    };

    // ── Drag & drop ──────────────────────────────────────────────────────────────
    const startDragTask = (e, key) => { drag.current = { kind: 'task', id: key }; e.dataTransfer.effectAllowed = 'move'; };
    const startDragDeck = (e, deckId) => { drag.current = { kind: 'deck', id: deckId }; e.dataTransfer.effectAllowed = 'move'; };
    const endDrag = () => { drag.current = { kind: null, id: null }; setHotDeck(null); setHotCol(false); };

    const onDeckDragOver = (e, deckId) => {
        if (drag.current.kind !== 'task') return; // only tasks drop onto decks
        e.preventDefault();
        if (hotDeck !== deckId) setHotDeck(deckId);
    };
    const onDeckDrop = (e, deckId) => {
        if (drag.current.kind !== 'task') return;
        e.preventDefault();
        const key = drag.current.id;
        if (!inDeck.has(key)) attachTaskTo(deckId, key);
        endDrag();
    };
    const onSentColDragOver = (e) => {
        if (drag.current.kind !== 'deck') return;
        e.preventDefault();
        if (!hotCol) setHotCol(true);
    };
    const onSentColDrop = (e) => {
        if (drag.current.kind !== 'deck') return;
        e.preventDefault();
        submit(drag.current.id);
        endDrag();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-3 py-24 text-slate-400">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm font-bold">Carregando board…</span>
            </div>
        );
    }

    if (tabs.length === 0) {
        return (
            <div className="py-20 text-center text-sm font-semibold text-slate-400">
                Este sinistro não tem checklist com itens para montar o board.
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Header: eyebrow + per-tab progress */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-[10.5px] font-bold tracking-[0.14em] text-slate-400 uppercase">Checklist de comprovação</p>
                    <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Relação de documentos</h2>
                </div>
                <div className="flex items-center gap-4">
                    {demoSwitch && (
                        <div className="flex rounded-xl border border-[#E9EEF5] bg-[#F4F7FB] p-1">
                            {['perito', 'analista'].map(rl => (
                                <button key={rl} onClick={() => setDemoRole(rl)}
                                    className={`rounded-[9px] px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider transition-all ${effectiveDemoRole === rl ? 'bg-white text-[#0E8A78] shadow' : 'text-slate-400'}`}>
                                    {rl}
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="flex items-center gap-3 rounded-2xl border border-[#E9EEF5] bg-white px-[18px] py-[14px]">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E9F8EF] text-[#16A34A]">
                            <Check size={20} />
                        </div>
                        <div>
                            <p className="text-[9.5px] font-bold tracking-[0.14em] text-slate-400 uppercase">Atendidas em {activeTab?.title}</p>
                            <p className="text-[19px] font-extrabold text-slate-900 leading-tight">{plural(progress.done, 'de ' + progress.total, 'de ' + progress.total)}</p>
                            <div className="mt-1 h-[7px] w-[150px] overflow-hidden rounded-full bg-[#EDF1F7]">
                                <div className="h-full rounded-full transition-[width] duration-300"
                                    style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`, background: 'linear-gradient(90deg,#17B39C,#2563EB)' }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Documentos avulsos: no sinistro, fora de qualquer tarefa */}
            {can('arquivo.subir') && (
                <LoosePanel files={looseFiles} onUpload={openUploadLoose} onLink={setLinking} onView={viewFile} />
            )}

            {/* Board: 3 columns (the active group is driven by the folder sidebar) */}
            <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-3">
                {/* Pendente */}
                <Column title="Pendente" dot="#94A3B8" count={pendingDecks.length + looseTasks.length}
                    onDragOver={(e) => { if (drag.current.kind) e.preventDefault(); }} onDrop={endDrag}>
                    {selCount > 0 && (
                        <div className="sticky top-[6px] z-[5] flex items-center gap-[10px] rounded-[14px] bg-[#0F172A] p-[11px_12px] shadow-[0_16px_30px_-18px_rgba(15,23,42,.9)]">
                            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-[#12A08B] text-[11px] font-extrabold text-white">{selCount}</span>
                            <span className="flex-1 text-[11.5px] font-bold text-slate-200">{plural(selCount, 'tarefa selecionada', 'tarefas selecionadas')}</span>
                            <button onClick={() => setSel({})} className="text-[11px] font-extrabold text-slate-400 hover:text-white">Limpar</button>
                            <button onClick={openUploadForSelection} style={{ background: TEAL_GRAD }} className="rounded-[9px] px-3 py-2 text-[11px] font-extrabold text-white">Juntar num deck</button>
                        </div>
                    )}

                    <div className="rounded-xl border border-dashed border-[#D7E0EC] bg-white p-[10px_12px] text-[11.5px] leading-relaxed text-[#7C8798]">
                        Clique numa tarefa para <b className="text-[#0F172A]">enviar o arquivo</b> e criar um deck. Marque o quadradinho de várias para <b className="text-[#0F172A]">juntá-las num deck</b>, ou arraste-as sobre um deck.
                    </div>

                    {pendingDecks.map(d => (
                        <DeckCard key={d.id} deck={d} accentOf={grupoAccent(tabs, d.grupo)} labelFor={labelFor} taskReturns={state.taskReturns}
                            role={isAnalyst ? 'analista' : 'perito'} hot={hotDeck === d.id} selCount={selCount}
                            onDragStart={(e) => startDragDeck(e, d.id)} onDragEnd={endDrag}
                            onDragOver={(e) => onDeckDragOver(e, d.id)} onDrop={(e) => onDeckDrop(e, d.id)}
                            onAddFile={() => openUploadForDeck(d.id)} onSubmit={() => submit(d.id)}
                            onDetach={(k) => detachTask(d.id, k)} onRemoveFile={(f) => removeFile(d.id, f)}
                            onJoinSelection={() => attachSelectionTo(d.id)}
                            onDownloadAll={canDownloadArchive ? () => downloadArchive(d) : null} downloading={zipping === d.id} />
                    ))}

                    {looseTasks.map(t => (
                        <TaskCard key={t.key} task={t} accent={grupoAccent(tabs, tab)} selected={!!sel[t.key]} devolucao={state.taskReturns[t.key]}
                            onToggle={() => toggleSel(t.key)} onClick={() => clickTask(t.key)}
                            onDragStart={(e) => startDragTask(e, t.key)} onDragEnd={endDrag} />
                    ))}

                    {pendingDecks.length === 0 && looseTasks.length === 0 && <Empty>Nada pendente por aqui.</Empty>}

                    {/* Tarefa que o checklist do tipo não previu */}
                    {onCreateTask && (
                        <div className="flex items-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-[#D7E0EC] bg-white p-[10px_11px]">
                            <Plus size={14} className="shrink-0 text-slate-400" />
                            <input value={newTask} onChange={(e) => setNewTask(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') submitNewTask(); if (e.key === 'Escape') setNewTask(''); }}
                                placeholder="Pedir outro documento…" aria-label="Nova tarefa"
                                className="min-w-0 flex-1 text-[12.5px] font-semibold text-slate-700 outline-none placeholder:font-medium placeholder:text-slate-400" />
                            {newTask.trim() && (
                                <button type="button" onClick={submitNewTask} disabled={addingTask}
                                    style={{ background: TEAL_GRAD }} className="shrink-0 rounded-[9px] px-3 py-[7px] text-[11px] font-extrabold text-white disabled:opacity-50">
                                    {addingTask ? '…' : 'Criar'}
                                </button>
                            )}
                        </div>
                    )}
                </Column>

                {/* Enviado */}
                <Column title="Enviado" dot="#2563EB" count={sentDecks.length}
                    hot={hotCol} onDragOver={onSentColDragOver} onDrop={onSentColDrop} onDragLeave={() => setHotCol(false)}>
                    {hotCol && (
                        <div className="rounded-[10px] border-[1.5px] border-dashed border-[#2563EB] bg-[#EAF1FE] p-[9px] text-center text-[11.5px] font-extrabold text-[#2563EB]">
                            Soltar o deck para enviar à análise
                        </div>
                    )}
                    {sentDecks.map(d => (
                        <DeckCard key={d.id} deck={d} accentOf={grupoAccent(tabs, d.grupo)} labelFor={labelFor} taskReturns={state.taskReturns}
                            role={isAnalyst ? 'analista' : 'perito'} onAnalyze={() => setReviewId(d.id)}
                            onDownloadAll={canDownloadArchive ? () => downloadArchive(d) : null} downloading={zipping === d.id} />
                    ))}
                    {sentDecks.length === 0 && <Empty>Nenhum deck em análise.<br />Envie um deck da coluna pendente.</Empty>}
                </Column>

                {/* Atendido */}
                <Column title="Atendido" dot="#16A34A" count={doneDecks.length}
                    onDragOver={(e) => { if (drag.current.kind) e.preventDefault(); }} onDrop={endDrag}>
                    {doneDecks.map(d => (
                        <DeckCard key={d.id} deck={d} accentOf={grupoAccent(tabs, d.grupo)} labelFor={labelFor} taskReturns={state.taskReturns} role="done"
                            onDownloadAll={canDownloadArchive ? () => downloadArchive(d) : null} downloading={zipping === d.id} />
                    ))}
                    {doneDecks.length === 0 && <Empty>Decks aprovados pelo analista aparecem aqui.</Empty>}
                </Column>
            </div>

            {/* Modals */}
            <AnimatePresence>
                {upload && (
                    <UploadModal title={upload.title} note={upload.note} busy={busy}
                        onClose={() => setUpload(null)}
                        onConfirm={async (files) => {
                            // Quem já juntou tarefas alguma vez não precisa da
                            // dica: para essa pessoa ela é só uma caixa piscando.
                            const hint = upload.joinHint && !state.decks.some(d => d.tarefaIds.length > 1);
                            await upload.onFiles(files);
                            setUpload(null);
                            if (hint) setJoinHint(true);
                        }} />
                )}
                {reviewDeck && (
                    <AnalysisModal deck={reviewDeck} labelFor={labelFor} accentOf={grupoAccent(tabs, reviewDeck.grupo)}
                        onView={viewFile} onClose={() => setReviewId(null)} onConfirm={(dev, motivo) => analyze(reviewDeck.id, dev, motivo)}
                        onDownloadAll={canDownloadArchive ? () => downloadArchive(reviewDeck) : null} downloading={zipping === reviewDeck.id} />
                )}
                {linking && (
                    <LinkFileModal file={linking} decks={pendingDecks} tasks={looseTasks} labelFor={labelFor}
                        onClose={() => setLinking(null)}
                        onDeck={(deckId) => linkFileToDeck(linking, deckId)}
                        onTask={(taskKey) => linkFileToTask(linking, taskKey)} />
                )}
                {joinHint && <JoinHintToast onClose={() => setJoinHint(false)} />}
            </AnimatePresence>
        </div>
    );
}

// ── Documentos avulsos ──────────────────────────────────────────────────────────
// O documento chega quando chega, e nem sempre com a tarefa junto: o segurado
// manda uma foto no WhatsApp, o corretor encaminha o e-mail da oficina. Ter de
// escolher a tarefa na hora do upload fazia a pessoa chutar uma — e um chute
// dentro de um deck é mais caro de desfazer do que um arquivo esperando aqui.
function LoosePanel({ files, onUpload, onLink, onView }) {
    return (
        <div data-testid="loose-panel" className="rounded-[18px] border border-[#E4EAF3] bg-white p-[14px_16px]">
            <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[10px] bg-[#F1F5F9] text-slate-500">
                    <FolderInput size={16} />
                </span>
                <div className="flex-1">
                    <p className="text-[12.5px] font-extrabold text-slate-800">Documentos avulsos</p>
                    <p className="text-[11.5px] font-semibold text-slate-400">
                        {files.length === 0
                            ? 'Suba um documento agora e diga depois a qual tarefa ele responde.'
                            : `${plural(files.length, 'documento à espera', 'documentos à espera')} de uma tarefa.`}
                    </p>
                </div>
                <button type="button" onClick={onUpload} data-testid="loose-upload"
                    className="rounded-[10px] border border-[#D7E0EC] bg-white px-[13px] py-[8px] text-[11.5px] font-extrabold text-slate-700 hover:border-[#12A08B] hover:text-[#0E8A78]">
                    Enviar sem tarefa
                </button>
            </div>

            {files.length > 0 && (
                <div className="mt-3 space-y-1.5">
                    {files.map(f => (
                        <div key={f.fileVerId} data-testid={`loose-file-${f.fileVerId}`}
                            className="flex items-center gap-2 rounded-[10px] border border-[#E4EBF6] bg-[#F7FAFF] p-[7px_9px]">
                            <span className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[9px] bg-white text-[8.5px] font-extrabold text-slate-600">{extBadge(f.nome)}</span>
                            <span className="flex-1 truncate text-[12px] font-bold text-slate-700">{f.nome}</span>
                            <span className="text-[10.5px] font-bold text-slate-400">{typeof f.tamanho === 'number' ? formatBytes(f.tamanho) : f.tamanho}</span>
                            <button type="button" onClick={() => onView(f)} className="flex items-center gap-1 text-[11px] font-extrabold text-slate-400 hover:text-[#2563EB]">
                                <Eye size={12} /> Ver
                            </button>
                            <button type="button" onClick={() => onLink(f)} className="flex items-center gap-1 text-[11px] font-extrabold text-[#2563EB] hover:underline">
                                <Link2 size={12} /> Vincular
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Onde o avulso vai parar: dentro de um deck que já existe, ou numa tarefa ainda
// solta — e aí o deck nasce com ele. São as duas únicas coisas que se pode fazer
// com um arquivo aqui, então a escolha é a tela inteira.
function LinkFileModal({ file, decks, tasks, labelFor, onClose, onDeck, onTask }) {
    const nada = decks.length === 0 && tasks.length === 0;
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}
            onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,.42)] p-4 backdrop-blur-[3px]">
            <motion.div initial={{ opacity: 0, y: 12, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.99 }}
                transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }} onClick={(e) => e.stopPropagation()}
                role="dialog" aria-label="Vincular documento avulso" data-testid="link-modal"
                className="flex max-h-[80vh] w-full max-w-[520px] flex-col rounded-[20px] bg-white p-6 shadow-[0_40px_80px_-30px_rgba(15,23,42,.5)]">
                <p className="text-[10px] font-extrabold tracking-[0.14em] text-slate-400 uppercase">Documento avulso</p>
                <h3 className="mt-1 truncate text-[19px] font-extrabold text-slate-900">{file.nome}</h3>
                <p className="mt-1 text-[12.5px] text-slate-500">Escolha o que este documento comprova.</p>

                <div className="mt-4 overflow-y-auto">
                    {nada && (
                        <p className="rounded-[12px] border border-dashed border-[#D7E0EC] p-4 text-center text-[12px] font-semibold text-slate-400">
                            Não há tarefa solta nem deck pendente nesta pasta. Troque de pasta na lateral ou crie a tarefa em Pendente.
                        </p>
                    )}

                    {decks.length > 0 && (
                        <>
                            <p className="text-[9.5px] font-extrabold tracking-[0.12em] text-slate-400 uppercase">Juntar a um deck pendente</p>
                            <div className="mt-1.5 space-y-1.5">
                                {decks.map(d => (
                                    <button key={d.id} type="button" onClick={() => onDeck(d.id)}
                                        className="flex w-full items-center gap-2 rounded-[10px] border border-[#E4EBF6] bg-white p-[9px_11px] text-left hover:border-[#2563EB]">
                                        <span className="rounded-lg bg-[#2563EB] px-[9px] py-[5px] text-[10px] font-extrabold uppercase tracking-wider text-white">{d.codigo}</span>
                                        <span className="flex-1 truncate text-[12.5px] font-bold text-slate-700">{d.tarefaIds.map(labelFor).join(', ')}</span>
                                        <ArrowRight size={14} className="text-slate-300" />
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {tasks.length > 0 && (
                        <>
                            <p className={`text-[9.5px] font-extrabold tracking-[0.12em] text-slate-400 uppercase ${decks.length > 0 ? 'mt-4' : ''}`}>Abrir um deck para a tarefa</p>
                            <div className="mt-1.5 space-y-1.5">
                                {tasks.map(t => (
                                    <button key={t.key} type="button" onClick={() => onTask(t.key)}
                                        className="flex w-full items-center gap-2 rounded-[10px] border border-[#E4EBF6] bg-white p-[9px_11px] text-left hover:border-[#12A08B]">
                                        <span className="h-2 w-2 rounded-full bg-[#12A08B]" />
                                        <span className="flex-1 truncate text-[12.5px] font-bold text-slate-700">{t.label}</span>
                                        <ArrowRight size={14} className="text-slate-300" />
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className="mt-5 flex justify-end border-t border-[#E9EEF5] pt-4">
                    <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-xs font-extrabold text-slate-500 hover:bg-slate-100">Cancelar</button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// A dica de juntar tarefas, dita logo depois de alguém criar um deck de uma
// tarefa só. Ela se apaga sozinha: é um aviso, não mais uma coisa para fechar.
function JoinHintToast({ onClose }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 9000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.18 }}
            data-testid="join-hint"
            role="status"
            className="fixed bottom-6 right-6 z-50 flex max-w-[360px] items-start gap-3 rounded-[16px] bg-[#0F172A] p-4 shadow-[0_24px_48px_-24px_rgba(15,23,42,.9)]"
        >
            <span className="mt-[2px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] bg-[#12A08B] text-white">
                <Plus size={13} />
            </span>
            <div className="flex-1">
                <p className="text-[12px] font-extrabold text-white">Documento enviado</p>
                <p className="mt-1 text-[11.5px] font-semibold leading-relaxed text-slate-300">
                    Dá para mandar várias tarefas num deck só: marque as que faltam aqui em Pendente,
                    ou arraste uma até um deck que já existe.
                </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar aviso"
                className="shrink-0 rounded-[7px] p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white">
                <X size={14} />
            </button>
        </motion.div>
    );
}

// grupoAccent resolves the accent palette for a given group id by its tab index.
function grupoAccent(tabs, grupoId) {
    const i = Math.max(0, tabs.findIndex(t => t.id === grupoId));
    return GROUP_STYLES[i % GROUP_STYLES.length];
}

// ── Column ──────────────────────────────────────────────────────────────────────
function Column({ title, dot, count, children, hot, ...dnd }) {
    return (
        <div {...dnd} data-testid={`column-${title.toLowerCase()}`} className={`flex flex-col gap-3 rounded-[18px] border bg-[#EEF2F8] p-[14px] min-h-[520px] ${hot ? 'border-[#2563EB]' : 'border-[#E4EAF3]'}`}>
            <div className="flex items-center gap-2">
                <span className="h-[9px] w-[9px] rounded-full" style={{ background: dot }} />
                <span className="text-[11.5px] font-extrabold tracking-[0.12em] text-slate-600 uppercase">{title}</span>
                <span className="ml-auto rounded-full border border-[#E4EAF3] bg-white px-2 py-0.5 text-[10.5px] font-extrabold text-slate-400">{count}</span>
            </div>
            {children}
        </div>
    );
}

function Empty({ children }) {
    return <p className="px-[10px] py-[26px] text-center text-xs font-semibold text-[#9AA5B4]">{children}</p>;
}

// ── Task card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, accent, selected, devolucao, onToggle, onClick, onDragStart, onDragEnd }) {
    return (
        <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onClick} data-testid={`task-${task.key}`}
            className={`cursor-grab rounded-[14px] border-[1.5px] bg-white p-[12px_13px] shadow-[0_1px_2px_rgba(15,23,42,.04)] transition-all hover:-translate-y-px ${selected ? 'border-[#12A08B] shadow-[0_10px_22px_-16px_rgba(18,160,139,.9)]' : 'border-[#E9EEF5] hover:border-[#B9CDF3]'}`}>
            <div className="flex items-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-label={selected ? 'Desmarcar tarefa' : 'Selecionar tarefa'}
                    className={`flex h-[17px] w-[17px] items-center justify-center rounded-md border-[1.5px] transition-all ${selected ? 'border-[#12A08B] bg-[#12A08B]' : 'border-[#D7E0EC] bg-white'}`}>
                    {selected && <Check size={10} className="text-white" strokeWidth={3.5} />}
                </button>
                <span className="rounded-md px-[7px] py-[3px] text-[9px] font-extrabold uppercase tracking-wider" style={{ color: accent.text, background: accent.chipBg }}>
                    {task.label.length > 22 ? task.label.slice(0, 20) + '…' : task.label}
                </span>
                {devolucao && (
                    <span className="ml-auto rounded-md bg-[#FEF3E2] px-[7px] py-[3px] text-[9px] font-extrabold uppercase tracking-wide text-[#B45309]">Devolvido</span>
                )}
            </div>
            <p className="mt-2 text-[13.5px] font-bold leading-tight text-slate-800">{task.label}</p>
            {devolucao && (
                <p className="mt-2 rounded-[9px] border border-[#FBE3BF] bg-[#FEF9F1] p-[7px_9px] text-[11px] leading-snug text-[#B45309]">{devolucao.motivo}</p>
            )}
            <p className="mt-2 flex items-center gap-1 text-[10.5px] font-bold text-slate-400"><Upload size={11} /> Clique para enviar arquivo</p>
        </div>
    );
}

// ── Deck card ─────────────────────────────────────────────────────────────────
function DeckCard({ deck, accentOf, labelFor, taskReturns, role, hot, selCount = 0,
    onDragStart, onDragEnd, onDragOver, onDrop, onAddFile, onSubmit, onDetach, onRemoveFile, onJoinSelection, onAnalyze,
    onDownloadAll, downloading }) {
    const done = deck.status === STATUS.ATENDIDO;
    const sent = deck.status === STATUS.ENVIADO;
    const draggable = deck.status === STATUS.PENDENTE;
    const badgeBg = done ? '#16A34A' : '#2563EB';
    return (
        <div draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragOver={onDragOver} onDrop={onDrop}
            data-testid={`deck-${deck.codigo}`} className="relative mt-[9px]">
            {/* stacked "sheet" behind the card */}
            <span className="pointer-events-none absolute left-[10px] right-[10px] top-[-7px] z-0 h-[14px] rounded-t-[14px] border-[1.5px] border-b-0"
                style={{ background: done ? '#D6EEDE' : '#fff', borderColor: done ? '#BFE9CE' : '#DCE7F9' }} />
            <div className={`relative z-[1] rounded-[16px] border-[1.5px] p-[14px] ${draggable ? 'cursor-grab' : ''}`}
                style={{
                    background: done ? '#fff' : sent ? '#fff' : '#F7FAFF',
                    borderColor: done ? '#BFE9CE' : hot ? '#2563EB' : '#C9DDFF',
                    boxShadow: done ? '0 10px 24px -18px rgba(22,163,74,.5)' : '0 10px 24px -18px rgba(37,99,235,.55)',
                }}>
                {/* header */}
                <div className="flex items-center gap-2">
                    <span className="rounded-lg px-[9px] py-[5px] text-[10px] font-extrabold uppercase tracking-wider text-white" style={{ background: badgeBg }}>{deck.codigo}</span>
                    {done && <span className="rounded-lg bg-[#E9F8EF] px-[9px] py-[5px] text-[10px] font-extrabold uppercase tracking-wider text-[#16A34A]">Aprovado</span>}
                    <span className="ml-auto text-[10.5px] font-bold text-[#7C8798]">
                        {plural(deck.tarefaIds.length, 'tarefa', 'tarefas')} · {plural(deck.arquivos.length, 'arquivo', 'arquivos')}
                    </span>
                </div>

                {/* tasks */}
                <p className="mt-3 text-[9.5px] font-extrabold tracking-[0.12em] text-slate-400 uppercase">Tarefas comprovadas</p>
                <div className="mt-1.5 space-y-1.5">
                    {deck.tarefaIds.map(k => (
                        <div key={k} className="flex items-center gap-2 rounded-[10px] border p-[7px_9px]"
                            style={{ background: done ? '#F6FBF8' : '#fff', borderColor: done ? '#E2F0E8' : '#E4EBF6' }}>
                            {done
                                ? <Check size={13} className="text-[#16A34A]" strokeWidth={3} />
                                : <span className="h-2 w-2 rounded-full" style={{ background: accentOf.text }} />}
                            <span className="flex-1 truncate text-[12.5px] font-semibold text-slate-700">{labelFor(k)}</span>
                            {taskReturns[k] && !done && <span className="text-[9px] font-extrabold uppercase text-[#B45309]">dev.</span>}
                            {onDetach && !sent && !done && (
                                <button onClick={() => onDetach(k)} className="text-[#B6C0CE] hover:text-[#E11D48]" aria-label="Desanexar tarefa"><X size={14} /></button>
                            )}
                        </div>
                    ))}
                </div>

                {/* files */}
                {deck.arquivos.length > 0 && (
                    <>
                        <div className="mt-3 flex items-center gap-2">
                            <p className="text-[9.5px] font-extrabold tracking-[0.12em] text-slate-400 uppercase">Arquivos do deck</p>
                            {onDownloadAll && (
                                <button type="button" onClick={onDownloadAll} disabled={downloading}
                                    className="ml-auto flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-[#2563EB] hover:underline disabled:text-slate-300 disabled:no-underline">
                                    {downloading ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                                    {downloading ? 'Baixando' : 'Baixar todos'}
                                </button>
                            )}
                        </div>
                        <div className="mt-1.5 space-y-1.5">
                            {deck.arquivos.map(f => (
                                <div key={f.fileVerId} className="flex items-center gap-2 rounded-[10px] border border-[#E4EBF6] bg-white p-[7px_9px]">
                                    <span className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[9px] bg-[#F1F5F9] text-[8.5px] font-extrabold text-slate-600">{extBadge(f.nome)}</span>
                                    <span className="flex-1 truncate text-[12px] font-bold text-slate-700">{f.nome}</span>
                                    <span className="text-[10.5px] font-bold text-slate-400">{typeof f.tamanho === 'number' ? formatBytes(f.tamanho) : f.tamanho}</span>
                                    {onRemoveFile && !sent && !done && (
                                        <button onClick={() => onRemoveFile(f.fileVerId)} className="text-[#B6C0CE] hover:text-[#E11D48]" aria-label="Remover arquivo"><X size={14} /></button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* drop zone hint */}
                {hot && (
                    <div className="mt-3 rounded-[10px] border-[1.5px] border-dashed border-[#2563EB] bg-[#EAF1FE] p-[9px] text-center text-[11.5px] font-extrabold text-[#2563EB]">
                        Soltar aqui para incluir no deck
                    </div>
                )}

                {/* join selection */}
                {onJoinSelection && selCount > 0 && !sent && !done && (
                    <button onClick={onJoinSelection} className="mt-3 w-full rounded-[10px] bg-[#0F172A] p-[10px] text-[11.5px] font-extrabold text-white hover:bg-[#1E293B]">
                        Juntar {plural(selCount, 'selecionada', 'selecionadas')} a este deck
                    </button>
                )}

                {/* actions */}
                {!sent && !done && (onAddFile || onSubmit) && (
                    <div className="mt-3 flex gap-2">
                        <button onClick={onAddFile} className="flex-1 rounded-[10px] border border-[#D7E0EC] bg-white p-[9px] text-[11.5px] font-extrabold text-slate-700 hover:border-[#12A08B] hover:text-[#0E8A78]">+ Arquivo</button>
                        <button onClick={onSubmit} style={{ background: TEAL_GRAD }} className="flex-[1.4] rounded-[10px] p-[9px] text-[11.5px] font-extrabold text-white shadow-[0_8px_16px_-10px_rgba(14,138,120,.9)] hover:brightness-105 flex items-center justify-center gap-1">
                            Enviar deck <ArrowRight size={14} />
                        </button>
                    </div>
                )}

                {/* submitted: analyst can review, perito waits */}
                {sent && (
                    role === 'analista' && onAnalyze ? (
                        <button onClick={onAnalyze} className="mt-3 w-full rounded-[10px] bg-[#2563EB] p-[10px] text-[11.5px] font-extrabold text-white shadow-[0_8px_16px_-10px_rgba(37,99,235,.9)]">Analisar documentos</button>
                    ) : (
                        <div className="mt-3 rounded-[10px] bg-[#EAF1FE] p-[10px] text-center text-[11px] font-extrabold uppercase tracking-wide text-[#2563EB]">Aguardando análise</div>
                    )
                )}
            </div>
        </div>
    );
}

// ── Upload modal ────────────────────────────────────────────────────────────────
function UploadModal({ title, note, busy, onClose, onConfirm }) {
    const [files, setFiles] = useState([]);
    const inputRef = useRef(null);
    const [working, setWorking] = useState(false);

    const confirm = async () => {
        if (files.length === 0 || working) return;
        setWorking(true);
        try { await onConfirm(files); } finally { setWorking(false); }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}
            onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,.42)] p-4 backdrop-blur-[3px]">
            <motion.div initial={{ opacity: 0, y: 12, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.99 }}
                transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }} onClick={(e) => e.stopPropagation()}
                role="dialog" aria-label="Upload de arquivos do deck" data-testid="upload-modal"
                className="w-full max-w-[520px] rounded-[20px] bg-white p-6 shadow-[0_40px_80px_-30px_rgba(15,23,42,.5)]">
                <p className="text-[10px] font-extrabold tracking-[0.14em] text-slate-400 uppercase">Upload seguro</p>
                <h3 className="mt-1 text-[19px] font-extrabold text-slate-900">{title}</h3>
                <p className="mt-1 text-[12.5px] text-slate-500">{note || 'O arquivo passa a comprovar esta tarefa. Depois você pode arrastar outras tarefas para o mesmo deck.'}</p>

                <div className="mt-4 rounded-[14px] border-[1.5px] border-dashed border-[#C9DDFF] bg-[#F7FAFF] p-[22px] text-center">
                    <input ref={inputRef} type="file" multiple hidden onChange={(e) => setFiles(Array.from(e.target.files || []))} />
                    <button onClick={() => inputRef.current?.click()} style={{ background: TEAL_GRAD }} className="rounded-xl px-5 py-3 text-[13px] font-extrabold text-white">Escolher arquivo</button>
                    <p className="mt-3 text-[11px] font-bold text-slate-400">PDF, JPG, PNG ou ZIP até 25 MB</p>
                    {files.length > 0 && (
                        <div className="mt-4 space-y-1.5 text-left">
                            {files.map((f, i) => (
                                <div key={i} className="flex items-center gap-2 rounded-[10px] border border-[#E4EBF6] bg-white p-[7px_9px]">
                                    <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-[#F1F5F9] text-[8px] font-extrabold text-slate-600">{extBadge(f.name)}</span>
                                    <span className="flex-1 truncate text-[12px] font-bold text-slate-700">{f.name}</span>
                                    <span className="text-[10.5px] font-bold text-slate-400">{formatBytes(f.size)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-5 flex justify-end gap-2">
                    <button onClick={onClose} className="rounded-lg px-4 py-2 text-xs font-extrabold text-slate-500 hover:bg-slate-100">Cancelar</button>
                    <button onClick={confirm} disabled={files.length === 0 || working || busy}
                        style={{ background: files.length ? TEAL_GRAD : undefined }}
                        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-extrabold ${files.length ? 'text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {working && <Loader2 size={13} className="animate-spin" />} Confirmar
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ── Analysis modal ──────────────────────────────────────────────────────────────
function AnalysisModal({ deck, labelFor, accentOf, onView, onClose, onConfirm, onDownloadAll, downloading }) {
    const [returns, setReturns] = useState({}); // key -> true (devolver)
    const [note, setNote] = useState('');
    const devolvidas = Object.keys(returns).filter(k => returns[k]);
    const total = deck.tarefaIds.length;
    const nDev = devolvidas.length;

    let label = 'Aprovar deck', grad = 'linear-gradient(160deg,#22C55E,#16A34A)';
    if (nDev === total && total > 0) { label = 'Devolver deck'; grad = 'linear-gradient(160deg,#F59E0B,#D97706)'; }
    else if (nDev > 0) { label = 'Concluir análise'; grad = 'linear-gradient(160deg,#F59E0B,#D97706)'; }

    const summary = nDev === 0
        ? 'Todas as tarefas serão marcadas como atendidas.'
        : `${plural(total - nDev, 'atende', 'atendem')} · ${plural(nDev, 'volta', 'voltam')} para pendente`;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}
            onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,.42)] p-4 backdrop-blur-[3px]">
            <motion.div initial={{ opacity: 0, y: 12, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.99 }}
                transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }} onClick={(e) => e.stopPropagation()}
                role="dialog" aria-label="Análise do deck" data-testid="analysis-modal"
                className="flex max-h-[88vh] w-full max-w-[620px] flex-col rounded-[20px] bg-white p-6 shadow-[0_40px_80px_-30px_rgba(15,23,42,.5)]">
                <div className="flex items-center gap-2">
                    <p className="text-[10px] font-extrabold tracking-[0.14em] text-slate-400 uppercase">Análise do deck</p>
                    <span className="rounded-lg bg-[#2563EB] px-[9px] py-[5px] text-[10px] font-extrabold uppercase tracking-wider text-white">{deck.codigo}</span>
                </div>
                <h3 className="mt-1 text-[19px] font-extrabold text-slate-900">Conferir documentos e decidir por tarefa</h3>

                <div className="mt-4 overflow-y-auto">
                    {deck.arquivos.length > 0 && (
                        <>
                            <div className="flex items-center gap-2">
                                <p className="text-[9.5px] font-extrabold tracking-[0.12em] text-slate-400 uppercase">Arquivos anexados</p>
                                {onDownloadAll && (
                                    <button type="button" onClick={onDownloadAll} disabled={downloading}
                                        className="ml-auto flex items-center gap-1.5 rounded-[9px] border border-[#C9DDFF] bg-[#EAF1FE] px-[11px] py-[6px] text-[11px] font-extrabold text-[#2563EB] hover:border-[#2563EB] disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400">
                                        {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                        {downloading ? 'Preparando o download…' : 'Baixar todos os arquivos'}
                                    </button>
                                )}
                            </div>
                            <div className="mt-1.5 space-y-1.5">
                                {deck.arquivos.map(f => (
                                    <div key={f.fileVerId} className="flex items-center gap-2 rounded-[10px] border border-[#E4EBF6] bg-white p-[7px_9px]">
                                        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[#F1F5F9] text-[8.5px] font-extrabold text-slate-600">{extBadge(f.nome)}</span>
                                        <span className="flex-1 truncate text-[12.5px] font-bold text-slate-700">{f.nome}</span>
                                        <span className="text-[10.5px] font-bold text-slate-400">{typeof f.tamanho === 'number' ? formatBytes(f.tamanho) : f.tamanho}</span>
                                        <button type="button" onClick={() => onView?.(f)} className="flex items-center gap-1 text-[11px] font-extrabold text-[#2563EB] hover:underline">
                                            <Eye size={12} /> Visualizar
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    <p className="mt-4 text-[9.5px] font-extrabold tracking-[0.12em] text-slate-400 uppercase">Tarefas do deck</p>
                    <div className="mt-1.5 space-y-1.5">
                        {deck.tarefaIds.map(k => {
                            const dev = !!returns[k];
                            return (
                                <div key={k} className={`flex items-center gap-3 rounded-[10px] border p-[9px_11px] ${dev ? 'border-[#FBE3BF] bg-[#FEF9F1]' : 'border-[#E4EBF6] bg-white'}`}>
                                    <span className="h-2 w-2 rounded-full" style={{ background: accentOf.text }} />
                                    <span className="flex-1 text-[13px] font-bold text-slate-800">{labelFor(k)}</span>
                                    <button onClick={() => setReturns(r => ({ ...r, [k]: false }))}
                                        className={`rounded-[9px] px-[11px] py-[7px] text-[10.5px] font-extrabold ${dev ? 'bg-[#F4F7FB] text-slate-400' : 'bg-[#E9F8EF] text-[#16A34A]'}`}>Atende</button>
                                    <button onClick={() => setReturns(r => ({ ...r, [k]: true }))}
                                        className={`rounded-[9px] px-[11px] py-[7px] text-[10.5px] font-extrabold ${dev ? 'bg-[#F59E0B] text-white' : 'bg-[#F4F7FB] text-slate-400'}`}>Devolver</button>
                                </div>
                            );
                        })}
                    </div>

                    {nDev > 0 && (
                        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: fotos ilegíveis, reenviar com data visível."
                            className="mt-3 min-h-[66px] w-full rounded-[12px] border border-[#E9EEF5] p-[11px_12px] text-[12.5px] outline-none focus:border-[#2563EB]" />
                    )}
                </div>

                <div className="mt-5 flex items-center gap-3 border-t border-[#E9EEF5] pt-4">
                    <span className="flex-1 text-[11.5px] font-semibold text-slate-500">{summary}</span>
                    <button onClick={onClose} className="rounded-lg px-4 py-2 text-xs font-extrabold text-slate-500 hover:bg-slate-100">Cancelar</button>
                    <button onClick={() => onConfirm(devolvidas, note)} style={{ background: grad }} className="rounded-lg px-4 py-2 text-xs font-extrabold text-white">{label}</button>
                </div>
            </motion.div>
        </motion.div>
    );
}

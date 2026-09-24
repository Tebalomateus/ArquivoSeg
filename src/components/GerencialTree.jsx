import { useState, useEffect, useMemo, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Folder, FolderInput, Loader2, Layers } from 'lucide-react';
import { formatBytes, openDocument, downloadDocument } from '../api/files';
import { isMockEnabled, getToken } from '../api/client';
import { getGerencial } from '../api/gerencial';
import { buildGerencialTree, LOOSE_ID } from '../api/gerencialTree';
import { normalizeBoard, persistKey, filesKey } from '../api/deckBoard';
import { useCan } from '../context/PermissionsContext';
import { FileActions, ShareFileModal, extBadge } from './FileActions';

/**
 * Visão gerencial do sinistro: só leitura, em árvore.
 *
 * A pasta "Gerencial" deixou de ser um kanban. O que ela mostra é o sinistro
 * inteiro dobrado numa lista: cada pasta do repositório, dentro dela cada
 * tarefa do checklist com o estado que o board dá a ela, e debaixo de cada
 * tarefa os documentos do deck que a comprova — com as mesmas ações de arquivo
 * do cartão. Quem chega aqui quer conferir, não mexer: não há upload, vínculo
 * nem análise.
 *
 * Contra o servidor a árvore vem pronta de GET /processes/{id}/gerencial; no
 * mock ela é montada localmente do mesmo material que o kanban usa.
 */

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// As mesmas cores das colunas do kanban, para a tarefa dizer onde está.
const STATUS_PILL = {
    pendente: { label: 'Pendente', color: '#64748B', bg: '#F1F5F9', dot: '#94A3B8' },
    enviado: { label: 'Enviado', color: '#2563EB', bg: '#EAF1FE', dot: '#2563EB' },
    atendido: { label: 'Atendido', color: '#16A34A', bg: '#E9F8EF', dot: '#16A34A' },
};

export default function GerencialTree({ claim }) {
    const can = useCan();
    const online = !isMockEnabled() && !!getToken();

    const [tree, setTree] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [collapsed, setCollapsed] = useState({}); // id → true quando fechado (tudo aberto por padrão)
    const [sharing, setSharing] = useState(null);

    // ── Carga: servidor ou montagem local ───────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        const load = async () => {
            if (online) {
                try {
                    const res = await getGerencial(claim.id);
                    if (!cancelled) setTree(res?.data ?? res ?? null);
                } catch (err) {
                    if (!cancelled) {
                        setTree(null);
                        setError(err?.code === 'INSUFFICIENT_PERMISSION'
                            ? 'Você não tem permissão para ver a visão gerencial deste sinistro.'
                            : (err?.message || 'Não foi possível carregar a visão gerencial.'));
                    }
                }
            } else {
                let board = null; let files = null;
                try { board = JSON.parse(sessionStorage.getItem(persistKey(claim.id)) || 'null'); } catch { /* ignore */ }
                try { files = JSON.parse(sessionStorage.getItem(filesKey(claim.id)) || 'null'); } catch { /* ignore */ }
                if (!cancelled) setTree(buildGerencialTree(claim.folders || [], normalizeBoard(board), Array.isArray(files) ? files : [], claim.id));
            }
            if (!cancelled) setLoading(false);
        };
        load();
        return () => { cancelled = true; };
    }, [claim.id, claim.folders, online]);

    const pastas = tree?.pastas || [];

    const totals = useMemo(() => {
        let tarefas = 0; let arquivos = 0;
        const seen = new Set();
        for (const p of pastas) {
            tarefas += p.tarefas?.length || 0;
            for (const t of p.tarefas || []) for (const f of t.arquivos || []) seen.add(f.fileVerId);
            for (const f of p.arquivos || []) seen.add(f.fileVerId);
        }
        arquivos = seen.size;
        return { tarefas, arquivos };
    }, [pastas]);

    // ── Abrir/fechar ────────────────────────────────────────────────────────────
    const isOpen = (id) => !collapsed[id];
    const toggle = (id) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
    const anyCollapsed = Object.values(collapsed).some(Boolean);
    const setAll = (open) => {
        if (open) { setCollapsed({}); return; }
        const next = {};
        for (const p of pastas) { next[p.id] = true; for (const t of p.tarefas || []) next[t.chave] = true; }
        setCollapsed(next);
    };

    // ── Ações de arquivo: as mesmas do cartão do deck ───────────────────────────
    const viewFile = useCallback(async (f) => {
        if (f?.url) { window.open(f.url, '_blank', 'noopener,noreferrer'); return; }
        if (online && f?.fileVerId) {
            try { await openDocument(f.fileVerId); }
            catch (err) { alert(`Falha ao abrir o documento: ${err?.message || err}`); }
            return;
        }
        alert('Pré-visualização indisponível para este arquivo (envie novamente nesta sessão ou use o backend real).');
    }, [online]);

    const downloadFile = useCallback(async (f) => {
        if (online && f?.fileVerId) {
            try { await downloadDocument(f.fileVerId, f.nome); }
            catch (err) { alert(`Falha ao baixar o documento: ${err?.message || err}`); }
            return;
        }
        if (f?.url) {
            const a = document.createElement('a');
            a.href = f.url;
            a.download = f.nome || 'documento';
            document.body.appendChild(a);
            a.click();
            a.remove();
            return;
        }
        alert('Download indisponível para este arquivo (envie novamente nesta sessão ou use o backend real).');
    }, [online]);

    const fileActions = {
        onView: viewFile,
        onDownload: can('arquivo.baixar') ? downloadFile : null,
        onShare: online && can('compartilhamento.criar') ? (f) => setSharing(f) : null,
    };

    // ── Render ──────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-5" data-testid="gerencial-tree">
            {/* Cabeçalho próprio, compacto: a barra de progresso é do kanban. */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-[10.5px] font-bold tracking-[0.14em] text-slate-400 uppercase">Visão consolidada</p>
                    <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Visão gerencial</h2>
                    <p className="mt-1 text-[12.5px] font-semibold text-slate-500">
                        Todas as pastas do sinistro, com as tarefas de cada uma e os documentos que as comprovam. Somente leitura.
                    </p>
                </div>
                {!loading && !error && (
                    <div className="flex items-center gap-3 rounded-2xl border border-[#E9EEF5] bg-white px-[18px] py-[14px]">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF1FE] text-[#2563EB]">
                            <Layers size={20} />
                        </div>
                        <div>
                            <p className="text-[9.5px] font-bold tracking-[0.14em] text-slate-400 uppercase">No sinistro</p>
                            <p className="text-[15px] font-extrabold leading-tight text-slate-900">
                                {plural(totals.tarefas, 'tarefa', 'tarefas')} · {plural(totals.arquivos, 'arquivo', 'arquivos')}
                            </p>
                        </div>
                        <button type="button" onClick={() => setAll(anyCollapsed)}
                            className="ml-2 rounded-[10px] border border-[#D7E0EC] bg-white px-[12px] py-[8px] text-[11px] font-extrabold text-slate-600 hover:border-[#2563EB] hover:text-[#2563EB]">
                            {anyCollapsed ? 'Expandir tudo' : 'Recolher tudo'}
                        </button>
                    </div>
                )}
            </div>

            {loading && (
                <div className="flex items-center justify-center gap-3 py-24 text-slate-400">
                    <Loader2 size={20} className="animate-spin" />
                    <span className="text-sm font-bold">Carregando visão gerencial…</span>
                </div>
            )}

            {!loading && error && (
                <p role="alert" className="rounded-[14px] border border-[#FECACA] bg-[#FEF2F2] p-[12px_14px] text-[12.5px] font-semibold text-[#B91C1C]">
                    {error}
                </p>
            )}

            {!loading && !error && (
                <div className="rounded-[18px] border border-[#E4EAF3] bg-[#EEF2F8] p-[10px]">
                    {pastas.length === 0 && (
                        <p className="px-[10px] py-[26px] text-center text-xs font-semibold text-[#9AA5B4]">Este sinistro ainda não tem pastas.</p>
                    )}
                    <div className="space-y-2">
                        {pastas.map(p => (
                            <FolderNode key={p.id} pasta={p} open={isOpen(p.id)} onToggle={() => toggle(p.id)}
                                isTaskOpen={isOpen} onToggleTask={toggle} fileActions={fileActions} />
                        ))}
                    </div>
                </div>
            )}

            <AnimatePresence>
                {sharing && <ShareFileModal file={sharing} onClose={() => setSharing(null)} />}
            </AnimatePresence>
        </div>
    );
}

// ── Pasta ───────────────────────────────────────────────────────────────────────
function FolderNode({ pasta, open, onToggle, isTaskOpen, onToggleTask, fileActions }) {
    const loose = pasta.categoria === LOOSE_ID;
    const tarefas = pasta.tarefas || [];
    const arquivos = pasta.arquivos || [];
    const nFiles = loose
        ? arquivos.length
        : new Set(tarefas.flatMap(t => (t.arquivos || []).map(f => f.fileVerId))).size;
    const empty = tarefas.length === 0 && arquivos.length === 0;

    return (
        <div data-testid={`gerencial-folder-${pasta.id}`} className="rounded-[14px] border border-[#E4EAF3] bg-white">
            <button type="button" onClick={onToggle} aria-expanded={open}
                className="flex w-full items-center gap-3 rounded-[14px] px-[12px] py-[11px] text-left hover:bg-[#F7FAFF]">
                <span className="text-slate-400">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
                <span className={`flex h-[30px] w-[30px] items-center justify-center rounded-[10px] ${loose ? 'bg-[#F1F5F9] text-slate-500' : 'bg-[#EAF1FE] text-[#2563EB]'}`}>
                    {loose ? <FolderInput size={16} /> : <Folder size={16} />}
                </span>
                <span className="flex-1 text-[13px] font-extrabold uppercase tracking-tight text-slate-800">{pasta.nome}</span>
                <span className="text-[10.5px] font-bold text-slate-400">
                    {loose ? plural(nFiles, 'arquivo', 'arquivos') : `${plural(tarefas.length, 'tarefa', 'tarefas')} · ${plural(nFiles, 'arquivo', 'arquivos')}`}
                </span>
            </button>

            {open && (
                <div className="border-t border-[#EEF2F8] px-[12px] pb-[10px] pt-[6px]">
                    {empty && <p className="py-[14px] pl-[36px] text-[12px] font-semibold text-[#9AA5B4]">Nenhum documento nesta pasta ainda.</p>}

                    {tarefas.length > 0 && (
                        <div className="space-y-1.5">
                            {tarefas.map(t => (
                                <TaskNode key={t.chave} tarefa={t} open={isTaskOpen(t.chave)} onToggle={() => onToggleTask(t.chave)} fileActions={fileActions} />
                            ))}
                        </div>
                    )}

                    {loose && arquivos.length > 0 && (
                        <div className="space-y-1.5 pl-[36px]">
                            {arquivos.map(f => <FileRow key={f.fileVerId} file={f} {...fileActions} />)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Tarefa ──────────────────────────────────────────────────────────────────────
function TaskNode({ tarefa, open, onToggle, fileActions }) {
    const arquivos = tarefa.arquivos || [];
    const hasFiles = arquivos.length > 0;
    const pill = tarefa.status ? STATUS_PILL[tarefa.status] : null;

    return (
        <div data-testid={`gerencial-task-${tarefa.chave}`} className="ml-[24px]">
            <button type="button" onClick={hasFiles ? onToggle : undefined} aria-expanded={hasFiles ? open : undefined}
                className={`flex w-full items-center gap-2 rounded-[10px] px-[8px] py-[7px] text-left ${hasFiles ? 'hover:bg-[#F7FAFF]' : 'cursor-default'}`}>
                <span className="w-4 text-slate-400">
                    {hasFiles ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="ml-[5px] block h-[6px] w-[6px] rounded-full bg-[#D7E0EC]" />}
                </span>
                <span className="flex-1 truncate text-[12.5px] font-bold text-slate-700">{tarefa.rotulo}</span>
                {tarefa.deckCodigo && (
                    <span className="rounded-md bg-[#0F172A] px-[7px] py-[3px] text-[9px] font-extrabold uppercase tracking-wider text-white">{tarefa.deckCodigo}</span>
                )}
                {pill ? (
                    <span className="flex items-center gap-1.5 rounded-md px-[7px] py-[3px] text-[9.5px] font-extrabold uppercase tracking-wider" style={{ color: pill.color, background: pill.bg }}>
                        <span className="h-[7px] w-[7px] rounded-full" style={{ background: pill.dot }} />
                        {pill.label}
                    </span>
                ) : (
                    <span className="rounded-md bg-[#F8FAFC] px-[7px] py-[3px] text-[9.5px] font-extrabold uppercase tracking-wider text-slate-400">Sem deck</span>
                )}
                <span className="w-[62px] text-right text-[10.5px] font-bold text-slate-400">{plural(arquivos.length, 'arquivo', 'arquivos')}</span>
            </button>

            {hasFiles && open && (
                <div className="mt-1 space-y-1.5 pl-[32px]">
                    {arquivos.map(f => <FileRow key={f.fileVerId} file={f} {...fileActions} />)}
                </div>
            )}
        </div>
    );
}

// ── Arquivo ─────────────────────────────────────────────────────────────────────
function FileRow({ file, onView, onDownload, onShare }) {
    const size = typeof file.tamanho === 'number' ? formatBytes(file.tamanho) : (file.tamanho || '');
    return (
        <div data-testid={`gerencial-file-${file.fileVerId}`} className="flex items-center gap-2 rounded-[10px] border border-[#E4EBF6] bg-[#F7FAFF] p-[7px_9px]">
            <span className="flex h-[28px] w-[28px] flex-shrink-0 items-center justify-center rounded-[9px] bg-white text-[8.5px] font-extrabold text-slate-600">{extBadge(file.nome)}</span>
            <span className="min-w-[56px] flex-1 truncate text-[12px] font-bold text-slate-700" title={file.nome}>{file.nome}</span>
            {size && <span className="text-[10.5px] font-bold text-slate-400">{size}</span>}
            {file.versao != null && <span className="rounded-md bg-white px-[6px] py-[2px] text-[9.5px] font-extrabold text-slate-400">v{file.versao}</span>}
            <FileActions file={file} onView={onView} onDownload={onDownload} onShare={onShare} />
        </div>
    );
}

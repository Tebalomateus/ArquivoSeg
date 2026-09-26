import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    Activity,
    ArrowLeft,
    Calendar,
    Clock,
    FolderInput,
    Gauge,
    HardDrive,
    Info,
    ListChecks,
    Lock,
    MessageSquare,
    Pause,
    Pencil,
    Play,
    Share2,
    Shield,
    X,
} from 'lucide-react';
import ChecklistPanel from '../components/ChecklistPanel';
import KanbanBoard, { LOOSE_FOLDER_ID } from '../components/KanbanBoard';
import GerencialTree from '../components/GerencialTree';
import { useClaims } from '../context/ClaimsContext';
import { useCan } from '../context/PermissionsContext';
import { useConfirm } from '../components/ConfirmDialog';
import ClaimAuditTrail from '../components/ClaimAuditTrail';
import { actorLabelFromDbId } from '../api/auth';
import { formatBytes } from '../api/files';
import { ACTION_LABELS } from '../api/audit';
import { loadStorage, loadLastActivity } from '../services/claimSidebar';

const GERENCIAL_TAB = 'gerencial';
const AUDIT_TAB = 'auditoria';

const STATUS_PILL = {
    ready: 'bg-blue-100 text-blue-700',
    ongoing: 'bg-amber-100 text-amber-700',
    review: 'bg-purple-100 text-purple-700',
    done: 'bg-green-100 text-green-700',
    archived: 'bg-gray-200 text-gray-600',
};

const formatWhen = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const STATUS_LABELS_PT = {
    ready: 'Aberto',
    ongoing: 'Em Análise',
    review: 'Em Revisão',
    done: 'Concluído',
    archived: 'Arquivado',
};

/**
 * Página do sinistro (variante C, "cartão lateral"): à esquerda um cartão com
 * identidade, números e última atividade; à direita uma aba por pasta, os
 * documentos avulsos, a visão gerencial e a auditoria. Abaixo de ~1024px as
 * duas colunas empilham.
 */
export default function ClaimDetails() {
    const { id } = useParams();
    const {
        currentUser,
        claims,
        refreshClaimFiles,
        listFileShares,
        createFileShare,
        revokeFileShare,
        archiveClaim,
        updateClaimFields,
        fetchSingleClaim,
        resolveActorLabel,
        addChecklistItem,
        toggleDeadline,
        updateClaimObservations,
    } = useClaims();

    const [tab, setTab] = useState(null); // id da pasta, LOOSE_FOLDER_ID, GERENCIAL_TAB ou AUDIT_TAB
    // Documentos sem tarefa, contados pelo board; null até ele contar.
    const [looseCount, setLooseCount] = useState(null);
    const [viewMode, setViewMode] = useState('decks');
    const [localObs, setLocalObs] = useState('');
    const [shares, setShares] = useState([]);
    const [sharesLoading, setSharesLoading] = useState(false);
    const [shareForm, setShareForm] = useState({ fileVerId: '', label: '', expiresInDays: '30' });

    const claim = claims.find(c => c.id === id);

    useEffect(() => {
        if (claim) setLocalObs(claim.observations || '');
    }, [claim]);

    useEffect(() => {
        if (id && refreshClaimFiles) refreshClaimFiles(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Direct GET /processes/:id when the route is opened cold (refresh F5).
    // Avoids the "Sinistro não encontrado" flicker before refreshClaims finishes.
    const claimMissing = !claims.find(c => c.id === id);
    useEffect(() => {
        if (id && claimMissing && fetchSingleClaim) fetchSingleClaim(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, claimMissing]);

    const can = useCan();
    const ask = useConfirm();
    const canManageShares = can('compartilhamento.listar');
    const allFiles = (claim?.folders || []).flatMap(f => f.documents || []).filter(d => d.backFileVerId);

    const refreshShares = async () => {
        if (!canManageShares || !listFileShares || allFiles.length === 0) {
            setShares([]);
            return;
        }
        setSharesLoading(true);
        try {
            const lists = await Promise.all(allFiles.map(async (doc) => {
                const items = await listFileShares(doc.backFileVerId);
                return items.map(s => ({ ...s, _file: doc }));
            }));
            setShares(lists.flat());
        } finally {
            setSharesLoading(false);
        }
    };

    useEffect(() => {
        if (viewMode === 'management') refreshShares();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewMode, claim?.folders?.length, allFiles.length]);

    const handleCreateShare = async (e) => {
        e.preventDefault();
        if (!shareForm.fileVerId) return alert('Selecione um arquivo!');
        const days = parseInt(shareForm.expiresInDays, 10);
        let expiresAt = null;
        if (days && days > 0) {
            expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
        }
        try {
            await createFileShare(shareForm.fileVerId, { label: shareForm.label || null, expiresAt });
            setShareForm({ fileVerId: '', label: '', expiresInDays: '30' });
            await refreshShares();
        } catch (err) {
            alert(`Falha ao criar share: ${err?.message || err}`);
        }
    };

    const handleRevokeShare = async (tokenId) => {
        if (!await ask({
            title: 'Revogar este link público?',
            message: 'Quem estiver com o endereço perde o acesso na hora. Não dá para reativar o mesmo link — só gerar outro.',
            confirmLabel: 'Revogar link', tone: 'danger',
        })) return;
        try {
            await revokeFileShare(tokenId);
            await refreshShares();
        } catch (err) {
            alert(`Falha ao revogar: ${err?.message || err}`);
        }
    };

    const canArchive = can('processo.arquivar');
    const canEditClaimMeta = can('processo.editar');

    const [editClaimModal, setEditClaimModal] = useState({ open: false, title: '', description: '' });
    const openEditClaim = () => setEditClaimModal({
        open: true,
        title: claim?.title || '',
        description: claim?.description || '',
    });
    const handleSaveClaimEdit = async (e) => {
        e.preventDefault();
        try {
            await updateClaimFields(claim.id, {
                title: editClaimModal.title,
                description: editClaimModal.description,
            });
            setEditClaimModal({ open: false, title: '', description: '' });
        } catch (err) { console.error(err); }
    };
    // O status avança sozinho conforme o trabalho; a única ação manual que
    // sobrou no painel é arquivar.
    const handleArchive = async () => {
        if (!canArchive) return;
        if (!await ask({
            title: `Arquivar o sinistro #${claim.number}?`,
            message: 'O sinistro sai do fluxo de trabalho e deixa de aceitar movimentação.',
            confirmLabel: 'Arquivar sinistro', tone: 'warning',
        })) return;
        await archiveClaim(claim.id);
    };

    const canSeeGerencial = can('processo.verGerencial');
    const canSeeAudit = can('processo.verAuditoria');

    // Armazenamento e última atividade vêm de rotas próprias (ou, no mock, do
    // que o navegador guarda). Falha em qualquer uma só apaga o número.
    const docCount = (claim?.folders || []).reduce((n, f) => n + (f.documents?.length || 0), 0);
    const [storage, setStorage] = useState(null);
    useEffect(() => {
        if (!claim) return undefined;
        let off = false;
        loadStorage(claim).then(s => { if (!off) setStorage(s); }).catch(() => { if (!off) setStorage(null); });
        return () => { off = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [claim?.id, docCount, looseCount]);

    // undefined = carregando; null = nada a mostrar.
    const [lastActivity, setLastActivity] = useState(undefined);
    useEffect(() => {
        if (!claim || !canSeeAudit) return undefined;
        let off = false;
        loadLastActivity(claim).then(a => { if (!off) setLastActivity(a); }).catch(() => { if (!off) setLastActivity(null); });
        return () => { off = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [claim?.id, canSeeAudit]);

    if (!claim) return <div className="p-20 text-center font-bold text-gray-500 h-full flex items-center justify-center">Sinistro não encontrado.</div>;

    // Verificações de segurança para evitar crash
    if (!currentUser) return null;

    const canManageDocuments = can('arquivo.subir');
    const canSeeLoose = canManageDocuments;

    // Abas do sinistro: uma por pasta de trabalho, depois os avulsos, a visão
    // gerencial e a auditoria. A pasta "gerencial" do metadata não vira aba de
    // pasta — a aba Gerencial é a árvore consolidada de todas, e quem a vê é
    // quem tem processo.verGerencial (o servidor recusa a rota sem ela).
    const folderTabs = claim.folders.filter(f => f.category !== 'gerencial');
    const tabIds = [
        ...folderTabs.map(f => f.id),
        ...(canSeeLoose ? [LOOSE_FOLDER_ID] : []),
        ...(canSeeGerencial ? [GERENCIAL_TAB] : []),
        ...(canSeeAudit ? [AUDIT_TAB] : []),
    ];
    const activeTab = tabIds.includes(tab) ? tab : tabIds[0];
    const currentFolder = folderTabs.find(f => f.id === activeTab) || null;

    const handleSaveObs = () => {
        updateClaimObservations(claim.id, localObs);
        alert('Observações salvas com sucesso!');
    };

    const handleToggleDeadline = () => {
        if (!canEditClaimMeta) return alert('Acesso negado: você não tem permissão para alterar prazos.');
        const reason = claim.deadline.isSuspended ? '' : prompt('Motivo da suspensão (SLA Art. 86):');
        if (!claim.deadline.isSuspended && !reason) return;
        toggleDeadline(claim.id, reason);
    };

    // Só o nome e o e-mail que o servidor manda; o resolvedor antigo (lista de
    // usuários, que nem todo papel pode ler) fica para processos sem esses campos.
    const creatorName = claim.backCreatedByName
        || (!claim.backCreatedByEmail && claim.backCreatedBy
            ? (resolveActorLabel?.(claim.backCreatedBy) || actorLabelFromDbId(claim.backCreatedBy, null))
            : null);
    const creatorEmail = claim.backCreatedByEmail;

    const statusPill = STATUS_PILL[claim.backStatus] || (claim.status === 'Concluído' ? STATUS_PILL.done : STATUS_PILL.ready);

    const tabClass = (on) => `relative flex items-center gap-1.5 px-4 py-3 text-sm font-bold border-b-2 -mb-px whitespace-nowrap transition ${on ? 'border-secondary text-primary' : 'border-transparent text-gray-500 hover:text-primary'}`;
    const segClass = (on) => `px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${on ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`;

    const renderFolderContent = () => {
        if (viewMode === 'decks') {
            return (
                <KanbanBoard claim={claim} currentUser={currentUser} folderId={currentFolder.id}
                    onLooseCount={setLooseCount}
                    onCreateTask={canEditClaimMeta ? (fid, name) => addChecklistItem(claim.id, fid, name) : null} />
            );
        }
        if (viewMode === 'checklist' || !canManageDocuments) return <ChecklistPanel claim={claim} />;
        return (
            <div className="space-y-6">
                {/* Management View: Workflow / Status */}
                <div className="card border-l-[6px] border-purple-600">
                    <h3 className="text-lg font-black text-gray-900 font-display uppercase tracking-tight flex items-center gap-3 mb-2">
                        <Shield size={22} className="text-purple-600" /> Workflow do Sinistro
                    </h3>
                    <p className="text-xs text-gray-500 font-medium mb-6">Status atual: <span className="font-black text-gray-900">{STATUS_LABELS_PT[claim.backStatus] || claim.backStatus}</span>.</p>
                    {claim.backStatus === 'archived' ? (
                        <p className="text-xs text-amber-700 font-medium">Sinistro arquivado — não aceita mais movimentação.</p>
                    ) : canArchive ? (
                        <button
                            type="button"
                            onClick={handleArchive}
                            className="px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all bg-red-50 text-red-600 hover:bg-red-100 border border-red-100"
                        >
                            Arquivar
                        </button>
                    ) : (
                        <p className="text-xs text-amber-700 font-medium">Seu perfil não pode arquivar sinistros.</p>
                    )}
                </div>

                {/* Management View: External Sharing & Invite */}
                <div className="card border-l-[6px] border-blue-600">
                    <h3 className="text-lg font-black text-gray-900 font-display uppercase tracking-tight flex items-center gap-3 mb-2">
                        <Share2 size={22} className="text-blue-600" /> Links Públicos por Documento
                    </h3>
                    <p className="text-xs text-gray-500 font-medium mb-6">Cada link aponta para um arquivo específico do sinistro. O destinatário não precisa de login; cada acesso é registrado na auditoria.</p>

                    {!canManageShares && (
                        <p className="text-xs text-amber-700 font-medium">Apenas perfis manager+ podem gerenciar links.</p>
                    )}

                    {canManageShares && (
                        <>
                            <form onSubmit={handleCreateShare} className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <select
                                    value={shareForm.fileVerId}
                                    onChange={(e) => setShareForm({ ...shareForm, fileVerId: e.target.value })}
                                    className="md:col-span-5 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Selecione um arquivo...</option>
                                    {allFiles.map(f => (
                                        <option key={f.backFileVerId} value={f.backFileVerId}>{f.name}</option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    value={shareForm.label}
                                    onChange={(e) => setShareForm({ ...shareForm, label: e.target.value })}
                                    placeholder="Rótulo (opcional)"
                                    className="md:col-span-3 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <select
                                    value={shareForm.expiresInDays}
                                    onChange={(e) => setShareForm({ ...shareForm, expiresInDays: e.target.value })}
                                    className="md:col-span-2 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="7">7 dias</option>
                                    <option value="30">30 dias</option>
                                    <option value="90">90 dias</option>
                                    <option value="0">Sem expiração</option>
                                </select>
                                <button
                                    type="submit"
                                    disabled={!shareForm.fileVerId}
                                    className={`md:col-span-2 px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 ${shareForm.fileVerId ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                                >
                                    Gerar Link
                                </button>
                            </form>

                            {sharesLoading && <p className="text-xs text-gray-400">Carregando links...</p>}

                            {!sharesLoading && shares.length === 0 && (
                                <p className="text-xs text-gray-500 text-center py-6">Nenhum link público criado ainda. Use o formulário acima.</p>
                            )}

                            {shares.map(s => {
                                const url = `${window.location.origin}/portal/${s.token}`;
                                const expires = s.expires_at ? new Date(s.expires_at).toLocaleDateString('pt-BR') : 'sem expiração';
                                const creatorLabel = s.created_by ? (resolveActorLabel?.(s.created_by) || actorLabelFromDbId(s.created_by, '—')) : '—';
                                return (
                                    <div key={s.id} className={`flex flex-col gap-2 p-4 rounded-2xl border mb-3 ${s.revoked ? 'bg-red-50/40 border-red-100' : 'bg-white border-gray-100'}`}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-black text-gray-900 truncate">{s._file?.name || s.file_ver_id}</p>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                                    {s.label || 'sem rótulo'} · expira {expires} · criado por {creatorLabel} · {s.revoked ? 'REVOGADO' : 'ATIVO'}
                                                </p>
                                            </div>
                                            {!s.revoked && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => { navigator.clipboard.writeText(url); alert('Link copiado!'); }}
                                                        className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-100"
                                                    >
                                                        Copiar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRevokeShare(s.id)}
                                                        className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-100"
                                                    >
                                                        Revogar
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                        <input readOnly value={url} className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-[11px] font-mono text-gray-600" />
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>

                {/* Management View: Administrator Observations */}
                <div className="card border-l-[6px] border-amber-500">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-black text-gray-900 font-display uppercase tracking-tight flex items-center gap-3">
                            <MessageSquare size={24} className="text-amber-500" /> Observações do Gestor
                        </h3>
                        <button
                            onClick={handleSaveObs}
                            className="text-[10px] font-black uppercase text-blue-600 hover:underline tracking-widest"
                        >
                            Salvar Alterações
                        </button>
                    </div>
                    <textarea
                        value={localObs}
                        onChange={(e) => setLocalObs(e.target.value)}
                        placeholder="Adicione notas internas sobre o andamento do processo, ligações com seguradoras ou orientações para o perito..."
                        className="w-full h-40 p-6 bg-amber-50/30 border border-amber-100 rounded-2xl text-sm font-medium text-gray-700 outline-none focus:ring-4 focus:ring-amber-50 transition-all shadow-inner"
                    />
                    <p className="mt-4 text-[10px] text-amber-600 font-bold uppercase tracking-widest italic flex items-center gap-2">
                        <Info size={12} /> Notas internas não são visíveis para Usuários Tipo 1.
                    </p>
                </div>


                {/* Management View: SLA History */}
                <div className="card border-gray-100">
                    <h3 className="text-lg font-black text-gray-900 mb-6 font-display uppercase tracking-tight flex items-center gap-3">
                        <Clock size={24} className="text-amber-600" /> Trilha de Prazos (SLA)
                    </h3>
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-inner">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50/80 border-b border-gray-100">
                                    <th className="px-6 py-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Data</th>
                                    <th className="px-6 py-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Ação / Evento</th>
                                    <th className="px-6 py-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Responsável</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {claim.deadline?.history?.map((entry, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-xs font-black text-gray-700">{entry.date}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ring-4 ring-opacity-10 ${entry.action.includes('Suspenso') ? 'bg-red-50 text-red-600 ring-red-50' : 'bg-green-50 text-green-600 ring-green-50'}`}>
                                                {entry.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">ArquivoSeg Admin</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="relative z-10 animate-fade-in pb-20">
            {/* "sinistros/:id" é um segmento de rota só: ".." sobe para o
                portal e o link dizia "Lista de Sinistros" levando ao
                dashboard. Relativo continua valendo sob /app e /admin. */}
            <Link to="../sinistros" className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-primary transition">
                <ArrowLeft size={14} strokeWidth={2.5} />
                Lista de Sinistros
            </Link>

            <div className="mt-3 flex flex-col lg:flex-row gap-6 items-stretch lg:items-start">
                {/* Cartão lateral: identidade e números do sinistro. */}
                <aside className="w-full lg:w-64 shrink-0" aria-label="Resumo do sinistro">
                    <div className="glass-card rounded-2xl p-4 lg:sticky lg:top-[88px] space-y-4" data-testid="claim-card">
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-[11px] font-black font-mono text-gray-600">SD - {claim.number}</h1>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${statusPill}`}>
                                    {claim.status}
                                </span>
                            </div>
                            <div className="flex items-baseline gap-1.5 mt-1.5">
                                <p className="text-base font-extrabold text-primary leading-tight tracking-tight uppercase break-words min-w-0">
                                    {claim.title}
                                    {claim.insurer && (<><span className="text-gray-300 mx-1">|</span>{claim.insurer}</>)}
                                </p>
                                {canEditClaimMeta && (
                                    <button type="button" onClick={openEditClaim} className="text-secondary hover:text-primary shrink-0" title="Editar sinistro" aria-label="Editar sinistro">
                                        <Pencil size={14} strokeWidth={2.2} />
                                    </button>
                                )}
                            </div>
                            {(creatorName || creatorEmail) && (
                                <p className="text-[11px] text-gray-500 mt-1.5 leading-snug" data-testid="claim-creator">
                                    Criado por <span className="font-semibold text-gray-700">{creatorName || creatorEmail}</span>
                                    {creatorName && creatorEmail && (<><br /><span className="break-all">{creatorEmail}</span></>)}
                                </p>
                            )}
                        </div>

                        <div className="h-px bg-gray-100" />

                        <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                            <div className="col-span-2 lg:col-span-1">
                                <div className="flex items-center justify-between">
                                    <span className="lbl inline-flex items-center gap-1"><Gauge size={14} className="text-secondary" />Conclusão</span>
                                    <span className="text-sm font-extrabold text-primary">{claim.progress}%</span>
                                </div>
                                <div className="mt-1.5 w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
                                    <div className="h-full bg-secondary rounded-full transition-all duration-700" style={{ width: `${claim.progress}%` }} />
                                </div>
                            </div>
                            <div>
                                <div className="lbl inline-flex items-center gap-1"><Clock size={14} className="text-amber-500" />Prazo</div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm font-extrabold text-primary">{claim.deadline?.remainingDays ?? 30} dias{claim.deadline?.isSuspended && ' (suspenso)'}</span>
                                    {canEditClaimMeta && (
                                        <button type="button" onClick={handleToggleDeadline} title={claim.deadline?.isSuspended ? 'Retomar prazo' : 'Suspender prazo'}
                                            className="w-6 h-6 rounded-md bg-white border border-gray-200 text-gray-500 hover:text-primary flex items-center justify-center">
                                            {claim.deadline?.isSuspended ? <Play size={12} /> : <Pause size={12} />}
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div>
                                <div className="lbl inline-flex items-center gap-1"><Calendar size={14} className="text-primary/70" />Data de abertura</div>
                                <div className="text-sm font-extrabold text-primary mt-1">{claim.date}</div>
                            </div>
                            <div>
                                <div className="lbl inline-flex items-center gap-1"><HardDrive size={14} className="text-primary/70" />Armazenamento</div>
                                <div className="text-sm font-extrabold text-primary mt-1" data-testid="claim-storage">
                                    {storage ? formatBytes(storage.bytes) : '—'}
                                    {storage && (
                                        <span className="ml-1 text-[11px] font-semibold text-gray-400">
                                            · {storage.file_count} {storage.file_count === 1 ? 'arquivo' : 'arquivos'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {canSeeAudit && (
                            <>
                                <div className="h-px bg-gray-100" />
                                <div data-testid="claim-last-activity">
                                    <div className="lbl">Última atividade</div>
                                    {lastActivity ? (
                                        <p className="text-[11px] text-gray-600 mt-1 leading-snug flex items-start gap-1.5">
                                            <Activity size={14} className="text-secondary mt-0.5 shrink-0" />
                                            <span>
                                                <span className="font-semibold text-gray-700">{lastActivity.actor}</span>{' '}
                                                {lastActivity.text || (ACTION_LABELS[lastActivity.action] || lastActivity.action || '').toLowerCase()}
                                                <br />
                                                <span className="text-gray-400">
                                                    {lastActivity.when || formatWhen(lastActivity.timestamp)} ·{' '}
                                                    <button type="button" onClick={() => setTab(AUDIT_TAB)} className="text-secondary font-semibold hover:underline">ver auditoria</button>
                                                </span>
                                            </span>
                                        </p>
                                    ) : (
                                        <p className="text-[11px] text-gray-400 mt-1">
                                            {lastActivity === undefined ? 'Carregando…' : 'Nenhuma atividade registrada.'}
                                        </p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </aside>

                <div className="flex-1 min-w-0">
                    <div role="tablist" aria-label="Seções do sinistro" className="flex items-center gap-1 border-b border-gray-200/80 overflow-x-auto">
                        {folderTabs.map(folder => (
                            <button key={folder.id} type="button" role="tab" aria-selected={activeTab === folder.id}
                                onClick={() => setTab(folder.id)} className={tabClass(activeTab === folder.id)}>
                                {folder.name} <span className="text-gray-400 font-semibold">({folder.completion}%)</span>
                            </button>
                        ))}
                        {canSeeLoose && (
                            <button type="button" role="tab" data-testid="folder-avulsos" aria-selected={activeTab === LOOSE_FOLDER_ID}
                                onClick={() => setTab(LOOSE_FOLDER_ID)} className={tabClass(activeTab === LOOSE_FOLDER_ID)}>
                                <FolderInput size={14} />
                                Documentos avulsos
                                {looseCount != null && (
                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border ${looseCount > 0 ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
                                        {looseCount}
                                    </span>
                                )}
                            </button>
                        )}
                        {canSeeGerencial && (
                            <button type="button" role="tab" aria-selected={activeTab === GERENCIAL_TAB}
                                onClick={() => setTab(GERENCIAL_TAB)} className={tabClass(activeTab === GERENCIAL_TAB)}>
                                Gerencial <Lock size={12} className="text-gray-400" />
                            </button>
                        )}
                        {canSeeAudit && (
                            <button type="button" role="tab" aria-selected={activeTab === AUDIT_TAB}
                                onClick={() => setTab(AUDIT_TAB)} className={tabClass(activeTab === AUDIT_TAB)}>
                                Auditoria
                            </button>
                        )}
                    </div>

                    <div className="mt-4 space-y-4" role="tabpanel">
                        {currentFolder ? (
                            <>
                                <div className="flex p-1 bg-gray-100 rounded-xl border border-gray-200 w-fit max-w-full overflow-x-auto" role="group" aria-label="Modo de visualização">
                                    <button type="button" onClick={() => setViewMode('checklist')} aria-pressed={viewMode === 'checklist'} className={segClass(viewMode === 'checklist')}>
                                        <ListChecks size={13} />
                                        Checklist
                                    </button>
                                    <button type="button" onClick={() => setViewMode('decks')} aria-pressed={viewMode === 'decks'} className={segClass(viewMode === 'decks')}>
                                        Decks
                                    </button>
                                    {canManageDocuments && (
                                        <button type="button" onClick={() => setViewMode('management')} aria-pressed={viewMode === 'management'} className={segClass(viewMode === 'management')}>
                                            Gerenciamento
                                        </button>
                                    )}
                                </div>
                                {renderFolderContent()}
                            </>
                        ) : activeTab === LOOSE_FOLDER_ID ? (
                            <KanbanBoard claim={claim} currentUser={currentUser} folderId={LOOSE_FOLDER_ID}
                                onLooseCount={setLooseCount}
                                onCreateTask={canEditClaimMeta ? (fid, name) => addChecklistItem(claim.id, fid, name) : null} />
                        ) : activeTab === GERENCIAL_TAB ? (
                            <GerencialTree claim={claim} />
                        ) : activeTab === AUDIT_TAB ? (
                            <ClaimAuditTrail processId={claim.id} />
                        ) : (
                            <p className="text-sm text-gray-500 py-10 text-center">Este sinistro não tem pastas.</p>
                        )}
                    </div>
                </div>
            </div>

            {editClaimModal.open && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditClaimModal({ open: false, title: '', description: '' })}>
                    <form className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-8 space-y-4" onClick={e => e.stopPropagation()} onSubmit={handleSaveClaimEdit}>
                        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                            <h3 className="text-xl font-black text-gray-900 font-display">Editar Sinistro</h3>
                            <button type="button" onClick={() => setEditClaimModal({ open: false, title: '', description: '' })} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl">
                                <X size={18} />
                            </button>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Título *</label>
                            <input
                                type="text"
                                required
                                value={editClaimModal.title}
                                onChange={(e) => setEditClaimModal({ ...editClaimModal, title: e.target.value })}
                                className="w-full mt-1 px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Descrição</label>
                            <textarea
                                value={editClaimModal.description}
                                onChange={(e) => setEditClaimModal({ ...editClaimModal, description: e.target.value.slice(0, 2000) })}
                                rows={5}
                                className="w-full mt-1 px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            />
                            <p className="text-[10px] text-gray-400 text-right mt-1">{editClaimModal.description.length}/2000</p>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button type="button" onClick={() => setEditClaimModal({ open: false, title: '', description: '' })} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold">Cancelar</button>
                            <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold">Salvar</button>
                        </div>
                    </form>
                </div>
            )}

        </div>
    );
}

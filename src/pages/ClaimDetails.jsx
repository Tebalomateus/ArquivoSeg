import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    Folder,
    Info,
    Clock,
    CheckCircle,
    ArrowLeft,
    Calendar,
    X,
    Pause,
    Play,
    Share2,
    Shield,
    Lock,
    MessageSquare,
    ListChecks,
    FolderInput,
} from 'lucide-react';
import ChecklistPanel from '../components/ChecklistPanel';
import KanbanBoard, { LOOSE_FOLDER_ID } from '../components/KanbanBoard';
import GerencialTree from '../components/GerencialTree';
import { useClaims } from '../context/ClaimsContext';
import { useCan } from '../context/PermissionsContext';
import { useConfirm } from '../components/ConfirmDialog';
import { actorLabelFromDbId } from '../api/auth';

const STATUS_LABELS_PT = {
    ready: 'Aberto',
    ongoing: 'Em Análise',
    review: 'Em Revisão',
    done: 'Concluído',
    archived: 'Arquivado',
};

/**
 * Claim Details Page Component.
 * The core interaction hub of the application, handling:
 * - Document Repository (Folders)
 * - Regulatory SLA Management (Art. 86)
 * - Stakeholders & Sharing (Token-based)
 * - Compliance Audit Trail
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

    const [selectedFolderId, setSelectedFolderId] = useState(null);
    const [looseCount, setLooseCount] = useState(0); // documentos sem tarefa, contados pelo board
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

    if (!claim) return <div className="p-20 text-center font-bold text-gray-500 h-full flex items-center justify-center">Sinistro não encontrado.</div>;

    // Verificações de segurança para evitar crash
    if (!currentUser) return null;

    const canManageDocuments = can('arquivo.subir');

    // A pasta "Gerencial" é a visão consolidada do sinistro, e quem a vê é quem
    // tem a permissão — não mais o papel legado. Sem ela a pasta não existe na
    // lateral, e o servidor recusa a rota de qualquer jeito.
    const canSeeGerencial = can('processo.verGerencial');
    const visibleFolders = claim.folders.filter(f => {
        if (f.category === 'gerencial') return canSeeGerencial;
        return true;
    });

    // "Documentos avulsos" é uma aba da lateral, mas só o board sabe mostrá-la:
    // nos outros modos ela cai para a primeira pasta, sem perder a escolha.
    const looseSelected = viewMode === 'decks' && selectedFolderId === LOOSE_FOLDER_ID;
    const currentFolderId = looseSelected ? null
        : (selectedFolderId && selectedFolderId !== LOOSE_FOLDER_ID ? selectedFolderId : visibleFolders[0]?.id);
    const currentFolder = claim.folders.find(f => f.id === currentFolderId) || visibleFolders[0];
    // Gerencial não tem kanban nem checklist próprio: é uma árvore só de leitura
    // sobre as outras pastas, seja qual for o modo de visualização.
    const gerencialSelected = currentFolder?.category === 'gerencial';

    // Se ainda não houver pasta (falha catastrófica de dados), mostra fallback
    if (!currentFolder) return <div className="p-20 text-center">Erro ao carregar pastas do sinistro.</div>;

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

    return (
        <div className="space-y-6 relative z-10 animate-fade-in pb-20">
            {/* Top Header */}
            <div className="flex flex-col lg:flex-row gap-6 justify-between items-start">
                <div className="space-y-1">
                    {/* "sinistros/:id" é um segmento de rota só: ".." sobe para o
                        portal e o link dizia "Lista de Sinistros" levando ao
                        dashboard. Relativo continua valendo sob /app e /admin. */}
                    <Link to="../sinistros" className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400 hover:text-blue-600 transition-all mb-2 tracking-widest">
                        <ArrowLeft size={16} />
                        Lista de Sinistros
                    </Link>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-black text-gray-900 font-display tracking-tight">SD - {claim.number}</h1>
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ring-4 ring-opacity-10 ${claim.status === 'Concluído' ? 'bg-green-100 text-green-700 ring-green-50' : 'bg-blue-100 text-blue-700 ring-blue-50'}`}>
                            {claim.status}
                        </span>
                    </div>
                    <p className="text-sm text-gray-500 font-bold uppercase tracking-tight">
                        {claim.title} <span className="text-gray-300 mx-2">|</span> <span className="text-blue-600">{claim.insurer}</span>
                        {canEditClaimMeta && (
                            <button onClick={openEditClaim} className="ml-3 text-[10px] text-blue-600 hover:underline normal-case tracking-normal">editar</button>
                        )}
                    </p>
                    {claim.backCreatedBy && (
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                            Criado por {(resolveActorLabel?.(claim.backCreatedBy) || actorLabelFromDbId(claim.backCreatedBy, '—'))}
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap gap-4 bg-white/50 p-2 rounded-2xl border border-white shadow-sm backdrop-blur-md">
                    <div className="flex p-1 bg-gray-100 rounded-xl border border-gray-200">
                        <button
                            onClick={() => setViewMode('checklist')}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${viewMode === 'checklist' ? 'bg-white shadow-md text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <ListChecks size={13} />
                            Checklist
                        </button>
                        <button
                            onClick={() => setViewMode('decks')}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'decks' ? 'bg-white shadow-md text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Decks
                        </button>
                        {canManageDocuments && (
                            <button
                                onClick={() => setViewMode('management')}
                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'management' ? 'bg-white shadow-md text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Gerenciamento
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card flex items-center gap-5 py-5 group cursor-default">
                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                        <CheckCircle size={28} />
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Status de Conclusão</p>
                        <div className="flex items-center gap-3">
                            <span className="text-2xl font-black font-display text-gray-900">{claim.progress}%</span>
                            <div className="flex-1 bg-gray-100 h-2.5 rounded-full overflow-hidden shadow-inner">
                                <div className="bg-blue-600 h-full transition-all duration-1000 ease-out" style={{ width: `${claim.progress}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={`card flex items-center gap-5 py-5 transition-all ${claim.deadline?.isSuspended ? 'bg-amber-50 border-amber-200' : 'hover:border-blue-100'}`}>
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${claim.deadline?.isSuspended ? 'bg-amber-100 text-amber-600 border border-amber-200' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                        <Clock size={28} />
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">SLA Regulatória</p>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${claim.deadline?.suspensionCount >= 2 ? 'bg-red-50 border-red-200 text-red-600' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                                SUSP: {claim.deadline?.suspensionCount || 0}/2
                            </span>
                        </div>
                        <p className={`text-2xl font-black font-display tracking-tighter ${claim.deadline?.isSuspended ? 'text-amber-700 animate-pulse' : 'text-gray-900'}`}>
                            {claim.deadline?.remainingDays || 30} dias {claim.deadline?.isSuspended && '(Suspenso)'}
                        </p>
                    </div>
                    {canEditClaimMeta && (
                        <button
                            onClick={handleToggleDeadline}
                            className={`ml-2 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${claim.deadline?.isSuspended ? 'bg-green-600 text-white shadow-lg shadow-green-100' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}
                        >
                            {claim.deadline?.isSuspended ? <Play size={20} /> : <Pause size={20} />}
                        </button>
                    )}
                </div>

                <div className="card flex items-center gap-5 py-5 border-0 bg-slate-900 text-white shadow-2xl shadow-slate-200">
                    <div className="w-14 h-14 bg-white/10 text-white rounded-2xl flex items-center justify-center border border-white/20">
                        <Calendar size={28} />
                    </div>
                    <div>
                        <p className="text-[10px] text-white/50 font-black uppercase tracking-widest mb-1">Data de Abertura</p>
                        <p className="text-2xl font-black font-display tracking-tight uppercase">{claim.date}</p>
                    </div>
                </div>
            </div>

            {/* Main Folder Explorer */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
                {/* Sidebar Space (Folders or Timeline) */}
                <div className="space-y-6 lg:sticky lg:top-6">
                    {/* Folders */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-2">Repositório</h3>
                        {visibleFolders.map(folder => (
                            <button
                                key={folder.id}
                                onClick={() => setSelectedFolderId(folder.id)}
                                className={`
                                    w-full flex items-center justify-between p-5 rounded-2xl transition-all border
                                    ${currentFolderId === folder.id
                                        ? 'bg-blue-600 border-blue-600 shadow-2xl shadow-blue-200 text-white translate-x-1'
                                        : 'bg-white/80 backdrop-blur-md border-gray-100 text-gray-700 hover:border-blue-300 hover:bg-blue-50/10'}
                                `}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${currentFolderId === folder.id ? 'bg-white/20' : 'bg-blue-50 text-blue-600'}`}>
                                        <Folder size={18} />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-black text-xs uppercase tracking-tight flex items-center gap-2">
                                            {folder.name}
                                            {folder.private && <Lock size={12} className={currentFolderId === folder.id ? 'text-white/50' : 'text-gray-400'} />}
                                        </p>
                                    </div>
                                </div>
                                {folder.category !== 'gerencial' && (
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${currentFolderId === folder.id ? 'bg-white/20 border-white/20' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
                                        {folder.completion}%
                                    </span>
                                )}
                            </button>
                        ))}

                        {/* Documentos avulsos: no sinistro, sem tarefa. Só faz sentido
                            onde se vincula, que é o board. */}
                        {viewMode === 'decks' && canManageDocuments && !gerencialSelected && (
                            <button
                                type="button"
                                data-testid="folder-avulsos"
                                onClick={() => setSelectedFolderId(LOOSE_FOLDER_ID)}
                                className={`
                                    w-full flex items-center justify-between p-5 rounded-2xl transition-all border
                                    ${looseSelected
                                        ? 'bg-blue-600 border-blue-600 shadow-2xl shadow-blue-200 text-white translate-x-1'
                                        : 'bg-white/80 backdrop-blur-md border-dashed border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50/10'}
                                `}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${looseSelected ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
                                        <FolderInput size={18} />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-black text-xs uppercase tracking-tight">Documentos avulsos</p>
                                    </div>
                                </div>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${looseSelected ? 'bg-white/20 border-white/20' : looseCount > 0 ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
                                    {looseCount}
                                </span>
                            </button>
                        )}
                    </div>

                </div>

                {/* Content Area */}
                <div className="lg:col-span-3 space-y-6">
                    {gerencialSelected ? (
                        <GerencialTree claim={claim} />
                    ) : viewMode === 'decks' ? (
                        <KanbanBoard claim={claim} currentUser={currentUser} folderId={looseSelected ? LOOSE_FOLDER_ID : currentFolderId}
                            onLooseCount={setLooseCount}
                            onCreateTask={canEditClaimMeta ? (fid, name) => addChecklistItem(claim.id, fid, name) : null} />
                    ) : viewMode === 'checklist' ? (
                        <ChecklistPanel claim={claim} />
                    ) : (
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
                    )}
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

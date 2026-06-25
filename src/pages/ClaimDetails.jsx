import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    Folder,
    ChevronRight,
    Upload,
    Download,
    Info,
    Clock,
    CheckCircle,
    MoreVertical,
    Plus,
    ArrowLeft,
    Calendar,
    ShieldCheck,
    X,
    FileText,
    AlertCircle,
    History,
    Pause,
    Play,
    Share2,
    Eye,
    Shield,
    Lock,
    Globe,
    MessageSquare,
    UserPlus,
    Send,
    User,
    Search,
    Filter
} from 'lucide-react';
import { useClaims, VALID_NEXT_STATUS } from '../context/ClaimsContext';
import { actorLabelFromDbId } from '../api/auth';
import { formatBytes, mimeShortLabel } from '../api/files';

const STATUS_LABELS_PT = {
    ready: 'Aberto',
    ongoing: 'Em Análise',
    review: 'Em Revisão',
    done: 'Concluído',
    archived: 'Arquivado',
};

/**
 * Modal component for secure file uploads.
 * Enforces mandatory contextual annotations (min 5 words) and confidentiality labeling.
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Visibility toggle
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onUpload - Success callback with file metadata
 * @param {string} props.folderName - Target folder label for the UI
 */
const UploadModal = ({ isOpen, onClose, onUpload, onCommentOnly, folderName }) => {
    const [file, setFile] = useState(null);
    const [annotation, setAnnotation] = useState('');
    const [confidentiality, setConfidentiality] = useState('Geral');
    const [commentOnly, setCommentOnly] = useState(false);
    const fileInputRef = useRef();

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const wordCount = annotation.trim().split(/\s+/).filter(w => w.length > 0).length;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!commentOnly && !file) return alert('Selecione um arquivo!');
        if (wordCount < 5) return alert('A anotação contextual deve ter no mínimo 5 palavras!');

        try {
            if (commentOnly) {
                await onCommentOnly({ annotation, confidentiality });
            } else {
                await onUpload({
                    file,
                    name: file.name,
                    annotation,
                    confidentiality,
                });
            }
            setFile(null);
            setAnnotation('');
            setCommentOnly(false);
            onClose();
        } catch (err) {
            alert(`Falha no envio: ${err?.message || err}`);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-fade-in border border-gray-100">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="text-xl font-bold text-gray-900 font-display uppercase tracking-tight">Novo Upload: {folderName}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-gray-400 border border-transparent hover:border-gray-100 transition-all"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <button
                            type="button"
                            onClick={() => { setCommentOnly(false); setFile(null); }}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!commentOnly ? 'bg-white shadow-md text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Arquivo + Observação
                        </button>
                        <button
                            type="button"
                            onClick={() => { setCommentOnly(true); setFile(null); }}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${commentOnly ? 'bg-white shadow-md text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Apenas Observação
                        </button>
                    </div>

                    {!commentOnly && (
                        <div
                            onClick={() => fileInputRef.current.click()}
                            className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group shadow-inner bg-gray-50"
                        >
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                            <div className="w-16 h-16 bg-white shadow-sm border border-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-secondary group-hover:bg-secondary group-hover:text-white transition-all duration-500">
                                <Upload size={28} />
                            </div>
                            <p className="text-sm font-black text-gray-900 uppercase tracking-widest">Selecione o arquivo</p>
                            <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase">PDF, DOCX, XLSX, JPG (Max. 50MB)</p>
                            {file && (
                                <div className="mt-6 p-3 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg animate-bounce">
                                    <FileText size={16} />
                                    {file.name}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Sensibilidade</label>
                            <select
                                value={confidentiality}
                                onChange={(e) => setConfidentiality(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all font-display"
                            >
                                <option value="Público">🟢 Público</option>
                                <option value="Geral">🔵 Geral</option>
                                <option value="Confidencial">🟡 Confidencial</option>
                                <option value="Altamente Confidencial">🔴 Sigiloso</option>
                            </select>
                        </div>
                        <div className="space-y-2 text-right">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mr-1">Contextualização</label>
                            <div className="flex items-center justify-end gap-2 mt-2">
                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest transition-all ${wordCount >= 5 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                                    {wordCount}/5 palavras
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Anotação Contextual (Obrigatório)*</label>
                        <textarea
                            value={annotation}
                            onChange={(e) => setAnnotation(e.target.value)}
                            placeholder="Descreva a importância deste documento para o processo..."
                            className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none transition-all h-28 text-sm font-medium resize-none shadow-inner"
                        />
                    </div>

                    <button
                        type="submit"
                        className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-xl ${(commentOnly || file) && wordCount >= 5 ? 'bg-secondary text-white shadow-secondary/10 hover:bg-secondary-hover hover:-translate-y-1' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                    >
                        <Send size={20} />
                        {commentOnly ? 'Registrar Observação' : 'Confirmar Envio Seguro'}
                    </button>
                </form>
            </div>
        </div>
    );
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
        uploadFileToClaim,
        addCommentToClaim,
        refreshClaimFiles,
        documentDownloadHref,
        listFileShares,
        createFileShare,
        revokeFileShare,
        deleteDocument,
        listFileVersions,
        updateAnnotation,
        deleteAnnotation,
        transitionStatus,
        archiveClaim,
        assignClaim,
        updateClaimFields,
        fetchSingleClaim,
        backendUsers,
        fetchAudit,
        auditByClaim,
        resolveActorLabel,
        updateChecklistStatus,
        toggleDeadline,
        logView,
        setComplexStatus,
        updateClaimObservations
    } = useClaims();

    const [selectedFolderId, setSelectedFolderId] = useState(null);
    const [isUploadModalOpen, setUploadModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState('interaction');
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

    const canReadAudit = currentUser?.backRole === 'manager' || currentUser?.backRole === 'admin';

    useEffect(() => {
        if (id && fetchAudit && canReadAudit) fetchAudit(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, canReadAudit]);

    const auditEntries = auditByClaim?.[id];

    const canManageShares = currentUser?.backRole === 'manager' || currentUser?.backRole === 'admin';
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
        if (!confirm('Revogar este link? O acesso público será imediatamente bloqueado.')) return;
        try {
            await revokeFileShare(tokenId);
            await refreshShares();
        } catch (err) {
            alert(`Falha ao revogar: ${err?.message || err}`);
        }
    };

    const canTransitionStatus = currentUser?.backRole === 'contributor' || currentUser?.backRole === 'manager' || currentUser?.backRole === 'admin';
    const canArchive = currentUser?.backRole === 'admin';
    const nextStatuses = (claim?.backStatus && VALID_NEXT_STATUS[claim.backStatus]) || [];
    const canDeleteFile = currentUser?.backRole === 'manager' || currentUser?.backRole === 'admin';
    const canEditAnnotation = currentUser?.backRole === 'contributor' || currentUser?.backRole === 'manager' || currentUser?.backRole === 'admin';
    const canEditClaimMeta = canEditAnnotation; // contributor+

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
    const [versionsModal, setVersionsModal] = useState({ open: false, file: null, versions: [] });
    const [editingComment, setEditingComment] = useState({ id: null, draft: '' });
    const [collaboratorModal, setCollaboratorModal] = useState({ open: false, search: '' });
    const [docSearch, setDocSearch] = useState('');
    const [showDocSearch, setShowDocSearch] = useState(false);
    const [docConfidentialityFilter, setDocConfidentialityFilter] = useState('all');
    const [showCompletedChecklist, setShowCompletedChecklist] = useState(false);

    const handleStartEditAnnotation = (doc) => {
        if (!doc.commentId) return alert('Esta anotação ainda não foi sincronizada com o servidor.');
        setEditingComment({ id: doc.commentId, draft: doc.annotation || '' });
    };

    const handleSaveAnnotation = async () => {
        const wordCount = editingComment.draft.trim().split(/\s+/).filter(w => w.length > 0).length;
        if (wordCount < 5) return alert('A anotação deve ter no mínimo 5 palavras.');
        try {
            await updateAnnotation(claim.id, editingComment.id, editingComment.draft);
            setEditingComment({ id: null, draft: '' });
        } catch (err) { console.error(err); }
    };

    const handleDeleteAnnotation = async (doc) => {
        if (!doc.commentId) return;
        if (!confirm('Remover esta anotação? O arquivo continua, mas a contextualização será apagada.')) return;
        try { await deleteAnnotation(claim.id, doc.commentId); }
        catch (err) { console.error(err); }
    };

    const handleDeleteFile = async (doc) => {
        if (!doc?.backFileVerId) return;
        if (!confirm(`Excluir o documento "${doc.name}"? Essa ação é definitiva.`)) return;
        try { await deleteDocument(claim.id, doc.backFileVerId); }
        catch (err) { console.error(err); }
    };

    const openVersions = async (doc) => {
        if (!doc?.backFileVerId) return;
        const versions = await listFileVersions(doc.backFileVerId);
        setVersionsModal({ open: true, file: doc, versions });
    };

    const handleAssign = async (userId) => {
        try { await assignClaim(claim.id, userId || null); }
        catch (err) { /* error already alerted in context */ console.error(err); }
    };

    const handleTransition = async (next) => {
        if (next === 'archived') {
            if (!canArchive) return alert('Apenas admin pode arquivar.');
            if (!confirm(`Arquivar sinistro #${claim.number}? Essa ação é definitiva.`)) return;
            await archiveClaim(claim.id);
        } else {
            await transitionStatus(claim.id, next);
        }
    };

    const formatAuditEntry = (entry) => {
        const ts = entry.timestamp ? new Date(entry.timestamp) : null;
        // Prefer the dynamic mapping from /api/v1/users (manager+); fall back to
        // the static VITE_USER_DBID_* env when /users isn't available or stale.
        const fromBackend = resolveActorLabel ? resolveActorLabel(entry.actor_user_id) : null;
        const user = entry.actor_user_id
            ? (fromBackend || actorLabelFromDbId(entry.actor_user_id))
            : 'Sistema';
        return {
            id: entry.id,
            user,
            action: entry.action || entry.resource_type,
            date: ts ? ts.toLocaleString('pt-BR') : '',
            ip_address: entry.ip_address,
            user_agent: entry.user_agent,
            metadata: entry.metadata,
            resource_type: entry.resource_type,
            resource_id: entry.resource_id,
            isBackend: true,
        };
    };

    const [expandedAuditId, setExpandedAuditId] = useState(null);

    if (!claim) return <div className="p-20 text-center font-bold text-gray-500 h-full flex items-center justify-center">Sinistro não encontrado.</div>;

    // Verificações de segurança para evitar crash
    if (!currentUser) return null;

    const isAdminOrInternal = currentUser?.role === 'ADMIN' || currentUser?.role === 'ANALISTA' || currentUser?.role === 'PERITO';
    const isManager = currentUser?.role === 'CORRETOR';
    const isAuditor = currentUser?.role === 'AUDITOR';
    const canManageDocuments = isAdminOrInternal || isManager;

    // Regra Reunião 3: Tipo 1 (Corretor) não vê "Gerencial". Auditor vê tudo para segurança mas não precisa de conteúdo.
    const visibleFolders = claim.folders.filter(f => {
        if (f.category === 'gerencial') {
            return isAdminOrInternal || isAuditor;
        }
        return true;
    });

    const currentFolderId = selectedFolderId || visibleFolders[0]?.id;
    const currentFolder = claim.folders.find(f => f.id === currentFolderId) || visibleFolders[0];

    // Se ainda não houver pasta (falha catastrófica de dados), mostra fallback
    if (!currentFolder) return <div className="p-20 text-center">Erro ao carregar pastas do sinistro.</div>;

    const handleUpload = async (payload) => {
        if (!payload?.file) return;
        await uploadFileToClaim(claim.id, currentFolder.category, payload.file, {
            annotation: payload.annotation,
            confidentiality: payload.confidentiality,
        });
    };

    const handleCommentOnly = async (payload) => {
        await addCommentToClaim(claim.id, payload.annotation);
    };

    const handleViewDoc = (doc) => {
        if (isAuditor) {
            return alert('Auditor: O conteúdo dos documentos é restrito para integridade de dados. Acesso negado pelo protocolo de compliance.');
        }
        if (!doc?.backFileVerId) return;
        // Backend's GET /files/:id/download responds 302 to a presigned MinIO URL.
        // The browser opens the file inline (PDFs/images) or downloads it (.txt etc.).
        // The redirect is audited server-side via ActionFileDownloaded.
        window.open(documentDownloadHref(doc.backFileVerId), '_blank', 'noopener,noreferrer');
        logView(claim.id, doc.name);
    };

    const handleSaveObs = () => {
        updateClaimObservations(claim.id, localObs);
        alert('Observações salvas com sucesso!');
    };

    const toggleChecklistItem = (itemId, received) => {
        if (isAuditor) return;
        updateChecklistStatus(claim.id, currentFolderId, itemId, !received);
    };

    const handleToggleDeadline = () => {
        if (!isAdminOrInternal) return alert('Acesso negado: Somente administradores podem alterar prazos.');
        const reason = claim.deadline.isSuspended ? '' : prompt('Motivo da suspensão (SLA Art. 86):');
        if (!claim.deadline.isSuspended && !reason) return;
        toggleDeadline(claim.id, reason);
    };

    return (
        <div className="space-y-6 relative z-10 animate-fade-in pb-20">
            {/* Top Header */}
            <div className="flex flex-col lg:flex-row gap-6 justify-between items-start">
                <div className="space-y-1">
                    <Link to=".." className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400 hover:text-blue-600 transition-all mb-2 tracking-widest">
                        <ArrowLeft size={16} />
                        Lista de Sinistros
                    </Link>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-black text-gray-900 font-display tracking-tight">SD - {claim.number}</h1>
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ring-4 ring-opacity-10 ${claim.status === 'Concluído' ? 'bg-green-100 text-green-700 ring-green-50' : 'bg-blue-100 text-blue-700 ring-blue-50'}`}>
                            {claim.status}
                        </span>
                        {claim.isComplex && (
                            <span className="flex items-center gap-2 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-purple-100 text-purple-700 ring-4 ring-purple-50 animate-pulse">
                                <Shield size={12} /> Alta Complexidade
                            </span>
                        )}
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
                            onClick={() => setViewMode('interaction')}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'interaction' ? 'bg-white shadow-md text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Exploração
                        </button>
                        {(canManageDocuments || isAuditor) && (
                            <button
                                onClick={() => setViewMode('management')}
                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'management' ? 'bg-white shadow-md text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Gerenciamento
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => setUploadModalOpen(true)}
                        className="bg-secondary text-white px-6 py-2 rounded-xl font-bold hover:bg-secondary-hover transition-all shadow-lg shadow-secondary/10 flex items-center gap-2 group"
                    >
                        <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                        Upload Seguro
                    </button>
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
                    {isAdminOrInternal && (
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
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${currentFolderId === folder.id ? 'bg-white/20 border-white/20' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
                                    {folder.completion}%
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Simple Timeline Card */}
                    <div className="card py-5 border-gray-100 bg-gray-50/50">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-6">
                            <History size={14} /> Audit Trail Recente
                            {canReadAudit && Array.isArray(auditEntries) && (
                                <span className="ml-auto text-[9px] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">BACKEND</span>
                            )}
                            {!canReadAudit && (
                                <span className="ml-auto text-[9px] font-black bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100">LOCAL</span>
                            )}
                        </h3>
                        {canReadAudit && auditEntries === null && (
                            <p className="text-[10px] text-amber-600 font-medium">Sem permissão para ler audit logs.</p>
                        )}
                        {!canReadAudit && (
                            <p className="text-[10px] text-amber-700 font-medium leading-relaxed mb-4 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
                                A trilha completa requer papel <strong>manager+</strong>. Abaixo, atividades locais (visíveis apenas neste navegador).
                            </p>
                        )}
                        <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-200">
                            {(canReadAudit && Array.isArray(auditEntries) && auditEntries.length > 0
                                ? auditEntries.slice(0, 6).map(formatAuditEntry)
                                : (claim.activities || []).slice(0, 4)
                            ).map((activity) => {
                                const isExpanded = expandedAuditId === activity.id;
                                const expandable = activity.isBackend && (activity.ip_address || activity.user_agent || (activity.metadata && Object.keys(activity.metadata).length > 0));
                                return (
                                    <div key={activity.id} className="relative pl-8">
                                        <div className="absolute left-0 top-1 w-6 h-6 bg-white rounded-full border-2 border-gray-100 flex items-center justify-center z-10 shadow-sm">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-600 leading-tight font-bold">
                                                <span className="text-gray-900">{activity.user}</span> {activity.action}
                                            </p>
                                            <p className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-tighter">
                                                {activity.date}
                                                {expandable && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedAuditId(isExpanded ? null : activity.id)}
                                                        className="ml-2 text-blue-600 hover:underline"
                                                    >
                                                        {isExpanded ? 'ocultar' : 'detalhes'}
                                                    </button>
                                                )}
                                            </p>
                                            {expandable && isExpanded && (
                                                <div className="mt-2 p-3 bg-white border border-gray-100 rounded-lg space-y-1 text-[9px] font-mono break-all">
                                                    {activity.ip_address && (<div><span className="text-gray-400">ip: </span><span className="text-gray-700">{activity.ip_address}</span></div>)}
                                                    {activity.user_agent && (<div><span className="text-gray-400">user-agent: </span><span className="text-gray-700">{activity.user_agent}</span></div>)}
                                                    {activity.resource_type && (<div><span className="text-gray-400">resource: </span><span className="text-gray-700">{activity.resource_type}{activity.resource_id ? ` ${String(activity.resource_id).slice(0, 8)}` : ''}</span></div>)}
                                                    {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                                                        <div>
                                                            <p className="text-gray-400 mb-1">metadata:</p>
                                                            {Object.entries(activity.metadata).map(([k, v]) => (
                                                                <div key={k} className="pl-2"><span className="text-gray-500">{k}: </span><span className="text-gray-700">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span></div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="lg:col-span-3 space-y-6">
                    {viewMode === 'interaction' ? (
                        <>
                            {/* Checklist Section */}
                            {currentFolder.checklist && currentFolder.checklist.length > 0 && (() => {
                                const pendingItems = currentFolder.checklist.filter(i => !i.received);
                                const completedCount = currentFolder.checklist.length - pendingItems.length;
                                const displayItems = showCompletedChecklist ? currentFolder.checklist : pendingItems;
                                return (
                                    <div className="card border-l-[6px] border-blue-600 py-6 bg-blue-50/10">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-xs font-black text-gray-900 flex items-center gap-2 uppercase tracking-widest">
                                                <CheckCircle size={18} className="text-blue-600" />
                                                Checklist: {currentFolder.name}
                                                {completedCount > 0 && (
                                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700 ml-2">
                                                        {completedCount} concluído{completedCount > 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </h3>
                                            {completedCount > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCompletedChecklist(v => !v)}
                                                    className="text-[10px] font-black text-blue-600 hover:underline uppercase tracking-widest"
                                                >
                                                    {showCompletedChecklist ? 'Ocultar concluídos' : 'Mostrar todos'}
                                                </button>
                                            )}
                                        </div>
                                        {displayItems.length === 0 ? (
                                            <p className="text-xs text-green-700 font-bold text-center py-4">Todos os itens foram recebidos.</p>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {displayItems.map(item => (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => toggleChecklistItem(item.id, item.received)}
                                                        className={`flex items-center gap-3 p-4 rounded-2xl border transition-all group ${item.received ? 'bg-white border-green-100 opacity-60' : 'bg-white border-gray-100 hover:border-blue-400 cursor-pointer'}`}
                                                    >
                                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${item.received ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-100' : 'bg-gray-50 border-gray-100 group-hover:bg-blue-50'}`}>
                                                            {item.received && <CheckCircle size={14} />}
                                                        </div>
                                                        <span className={`text-xs font-bold tracking-tight ${item.received ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{item.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Document List Card */}
                            <div className="card p-0 overflow-hidden min-h-[400px]">
                                <div className="px-8 py-6 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                                            <Folder size={20} />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-gray-900 font-display tracking-tight uppercase">{currentFolder.name}</h2>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{currentFolder.documents.length} itens armazenados</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        {showDocSearch && (
                                            <input
                                                type="text"
                                                autoFocus
                                                value={docSearch}
                                                onChange={(e) => setDocSearch(e.target.value)}
                                                placeholder="Buscar nome, anotação…"
                                                className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 w-56"
                                            />
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => { setShowDocSearch((v) => !v); if (showDocSearch) setDocSearch(''); }}
                                            className={`p-2.5 rounded-xl transition-all border ${showDocSearch ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-400 hover:text-blue-600 hover:bg-white border-transparent hover:border-gray-100'}`}
                                            title="Buscar documentos"
                                        >
                                            <Search size={18} />
                                        </button>
                                        <select
                                            value={docConfidentialityFilter}
                                            onChange={(e) => setDocConfidentialityFilter(e.target.value)}
                                            className="text-[10px] font-black uppercase tracking-widest bg-white border border-gray-100 rounded-xl px-3 py-2 text-gray-600 outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
                                            title="Filtrar por confidencialidade"
                                        >
                                            <option value="all">Todos os níveis</option>
                                            <option value="Geral">Geral</option>
                                            <option value="Confidencial">Confidencial</option>
                                            <option value="Altamente Confidencial">Altamente Confidencial</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="p-4 space-y-4">
                                    {currentFolder.documents
                                        .filter((doc) => {
                                            if (docConfidentialityFilter !== 'all' && doc.confidentiality !== docConfidentialityFilter) return false;
                                            if (!docSearch.trim()) return true;
                                            const q = docSearch.toLowerCase();
                                            return (doc.name || '').toLowerCase().includes(q) || (doc.annotation || '').toLowerCase().includes(q);
                                        })
                                        .map((doc) => (
                                        <div key={doc.id} className="group p-5 bg-white rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-50 transition-all duration-300">
                                            <div className="flex items-start justify-between gap-6">
                                                <div className="flex gap-5 flex-1">
                                                    <div className="w-12 h-12 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-inner">
                                                        <FileText size={24} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                                                            <h4 className="font-bold text-gray-900 uppercase text-xs tracking-tight">{doc.name}</h4>
                                                            {doc.backVersion > 1 && (
                                                                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-purple-50 border border-purple-200 text-purple-700 tracking-widest" title="Versão atual deste arquivo">
                                                                    v{doc.backVersion}
                                                                </span>
                                                            )}
                                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded border tracking-widest transition-all ${doc.confidentiality === 'Altamente Confidencial' ? 'bg-red-50 border-red-200 text-red-600' :
                                                                doc.confidentiality === 'Confidencial' ? 'bg-amber-50 border-amber-200 text-amber-600' :
                                                                    doc.confidentiality === 'Público' ? 'bg-green-50 border-green-200 text-green-600' :
                                                                        'bg-blue-50 border-blue-200 text-blue-600'
                                                                }`}>
                                                                {doc.confidentiality || 'Geral'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex-wrap">
                                                            <span className="flex items-center gap-1"><Calendar size={12} className="text-gray-300" /> {doc.date}</span>
                                                            <span className="flex items-center gap-1">
                                                                <User size={12} className="text-gray-300" />
                                                                {doc.backUploadedBy
                                                                    ? (resolveActorLabel?.(doc.backUploadedBy) || actorLabelFromDbId(doc.backUploadedBy, '—'))
                                                                    : (doc.user || '—')}
                                                            </span>
                                                            {doc.mime_type && (
                                                                <span className="flex items-center gap-1 text-gray-500" title={doc.mime_type}>
                                                                    <FileText size={12} className="text-gray-300" /> {mimeShortLabel(doc.mime_type)}
                                                                </span>
                                                            )}
                                                            {doc.size_bytes != null && (
                                                                <span className="text-gray-500">{formatBytes(doc.size_bytes)}</span>
                                                            )}
                                                        </div>
                                                        <div className="p-4 bg-gray-50/80 rounded-2xl border border-dashed border-gray-200 text-[11px] font-medium text-gray-600 relative group-hover:bg-white group-hover:border-blue-100 transition-all">
                                                            <MessageSquare className="absolute -top-1.5 -left-1.5 w-6 h-6 text-blue-100 group-hover:text-blue-200" />
                                                            {editingComment.id && editingComment.id === doc.commentId ? (
                                                                <div className="space-y-2">
                                                                    <textarea
                                                                        value={editingComment.draft}
                                                                        onChange={(e) => setEditingComment({ ...editingComment, draft: e.target.value })}
                                                                        className="w-full p-2 bg-white border border-gray-200 rounded-lg text-[11px] outline-none focus:ring-2 focus:ring-blue-500"
                                                                        rows={3}
                                                                    />
                                                                    <div className="flex gap-2 justify-end">
                                                                        <button type="button" onClick={() => setEditingComment({ id: null, draft: '' })} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-md text-[10px] font-black uppercase tracking-widest">Cancelar</button>
                                                                        <button type="button" onClick={handleSaveAnnotation} className="px-3 py-1 bg-blue-600 text-white rounded-md text-[10px] font-black uppercase tracking-widest">Salvar</button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-2">
                                                                    <div className="flex items-start gap-3">
                                                                        <p className="leading-relaxed opacity-80 italic flex-1">"{doc.annotation || '(sem anotação)'}"</p>
                                                                        {doc.commentId && canEditAnnotation && (
                                                                            <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                <button type="button" onClick={() => handleStartEditAnnotation(doc)} className="text-[10px] font-black text-blue-600 hover:underline uppercase tracking-widest">Editar</button>
                                                                                <button type="button" onClick={() => handleDeleteAnnotation(doc)} className="text-[10px] font-black text-red-500 hover:underline uppercase tracking-widest">Remover</button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {doc.commentId && (
                                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                                            por {(resolveActorLabel?.(doc.commentAuthorId) || actorLabelFromDbId(doc.commentAuthorId, '—'))}
                                                                            {doc.commentCreatedAt && (
                                                                                <span> · {new Date(doc.commentCreatedAt).toLocaleString('pt-BR')}</span>
                                                                            )}
                                                                            {doc.commentUpdatedAt && doc.commentUpdatedAt !== doc.commentCreatedAt && (
                                                                                <span className="text-amber-600"> · editado em {new Date(doc.commentUpdatedAt).toLocaleString('pt-BR')}</span>
                                                                            )}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                                    <button
                                                        onClick={() => handleViewDoc(doc)}
                                                        className="w-10 h-10 flex items-center justify-center bg-white shadow-lg border border-gray-100 rounded-xl text-blue-600 hover:bg-blue-600 hover:text-white transition-all"
                                                        title="Visualizar documento"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                    {doc.backFileVerId ? (
                                                        <>
                                                            <a
                                                                href={documentDownloadHref(doc.backFileVerId)}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="w-10 h-10 flex items-center justify-center bg-white shadow-lg border border-gray-100 rounded-xl text-gray-600 hover:bg-blue-600 hover:text-white transition-all"
                                                                title="Baixar documento"
                                                            >
                                                                <Download size={18} />
                                                            </a>
                                                            <button
                                                                type="button"
                                                                onClick={() => openVersions(doc)}
                                                                className="w-10 h-10 flex items-center justify-center bg-white shadow-lg border border-gray-100 rounded-xl text-gray-600 hover:bg-purple-600 hover:text-white transition-all"
                                                                title="Histórico de versões"
                                                            >
                                                                <History size={18} />
                                                            </button>
                                                            {canDeleteFile && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteFile(doc)}
                                                                    className="w-10 h-10 flex items-center justify-center bg-white shadow-lg border border-gray-100 rounded-xl text-gray-600 hover:bg-red-600 hover:text-white transition-all"
                                                                    title="Excluir documento"
                                                                >
                                                                    <X size={18} />
                                                                </button>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <button className="w-10 h-10 flex items-center justify-center bg-white shadow-lg border border-gray-100 rounded-xl text-gray-300 cursor-not-allowed" title="Disponível após upload sincronizado">
                                                            <Download size={18} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {currentFolder.documents.length === 0 && (
                                        <div className="py-24 text-center flex flex-col items-center">
                                            <div className="w-24 h-24 bg-blue-50/50 rounded-full flex items-center justify-center text-blue-200 mb-8 animate-pulse">
                                                <Upload size={48} />
                                            </div>
                                            <h4 className="text-2xl font-black text-gray-900 mb-2 font-display uppercase tracking-tight">Repositório Vazio</h4>
                                            <p className="text-gray-400 text-sm font-medium">Nenhum documento foi enviado para esta pasta ainda.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-6">
                            {/* Management View: Workflow / Status */}
                            <div className="card border-l-[6px] border-purple-600">
                                <h3 className="text-lg font-black text-gray-900 font-display uppercase tracking-tight flex items-center gap-3 mb-2">
                                    <Shield size={22} className="text-purple-600" /> Workflow do Sinistro
                                </h3>
                                <p className="text-xs text-gray-500 font-medium mb-6">Status atual: <span className="font-black text-gray-900">{STATUS_LABELS_PT[claim.backStatus] || claim.backStatus}</span>. Transições válidas: <span className="font-mono text-[10px]">ready→ongoing→review→done→archived</span>.</p>
                                {canTransitionStatus ? (
                                    nextStatuses.length === 0 ? (
                                        <p className="text-xs text-amber-700 font-medium">Sinistro arquivado — nenhuma transição permitida.</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-3">
                                            {nextStatuses.map(next => {
                                                const isArchive = next === 'archived';
                                                const disabled = isArchive && !canArchive;
                                                return (
                                                    <button
                                                        key={next}
                                                        type="button"
                                                        disabled={disabled}
                                                        onClick={() => handleTransition(next)}
                                                        className={`px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                                                            disabled
                                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                                : isArchive
                                                                    ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100'
                                                                    : 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-100'
                                                        }`}
                                                        title={disabled ? 'Apenas admin pode arquivar' : `Transitar para ${STATUS_LABELS_PT[next] || next}`}
                                                    >
                                                        {isArchive ? 'Arquivar' : `Avançar para ${STATUS_LABELS_PT[next] || next}`}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )
                                ) : (
                                    <p className="text-xs text-amber-700 font-medium">Apenas perfis contributor+ podem alterar status.</p>
                                )}
                            </div>

                            {/* Management View: Assignment */}
                            <div className="card border-l-[6px] border-indigo-600">
                                <h3 className="text-lg font-black text-gray-900 font-display uppercase tracking-tight flex items-center gap-3 mb-2">
                                    <UserPlus size={22} className="text-indigo-600" /> Responsável
                                </h3>
                                <p className="text-xs text-gray-500 font-medium mb-4">Define qual usuário do tenant é o ponto-focal deste sinistro.</p>
                                {(backendUsers || []).length === 0 ? (
                                    <p className="text-xs text-amber-700 font-medium">Lista de usuários indisponível para o seu papel — só manager+ enxerga `/users`.</p>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <select
                                            value={claim.assignedTo || ''}
                                            onChange={(e) => handleAssign(e.target.value)}
                                            className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="">— Não atribuído —</option>
                                            {backendUsers.map(u => (
                                                <option key={u.id} value={u.id}>{u.email} ({u.role})</option>
                                            ))}
                                        </select>
                                        {claim.assignedTo && (
                                            <button
                                                type="button"
                                                onClick={() => handleAssign('')}
                                                className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200"
                                            >
                                                Limpar
                                            </button>
                                        )}
                                    </div>
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

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                <div className="card border-2 border-gray-100 bg-gray-50/30 flex flex-col justify-between">
                                    <div>
                                        <h3 className="text-lg font-black text-gray-900 mb-2 font-display uppercase tracking-tight flex items-center gap-3">
                                            <UserPlus size={24} className="text-blue-600" /> Vendedores & Peritos
                                        </h3>
                                        <p className="text-xs text-gray-500 font-medium mb-6">Convide colaboradores externos especificamente para este processo.</p>
                                    </div>
                                    <button
                                        className="w-full py-4 border-2 border-blue-100 text-blue-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm"
                                        onClick={() => setCollaboratorModal({ open: true, search: '' })}
                                    >
                                        Adicionar Colaborador
                                    </button>
                                </div>
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

                            {/* Management View: Compliance & Security */}
                            <div className="card border-2 border-purple-100 bg-purple-50/20 mb-6 relative overflow-hidden">
                                <Shield className="absolute top-0 right-0 w-32 h-32 text-purple-100 -mr-12 opacity-40" />
                                <div className="flex items-center justify-between mb-6 relative z-10">
                                    <h3 className="text-lg font-black text-gray-900 font-display flex items-center gap-3 uppercase tracking-tight">
                                        <Shield size={24} className="text-purple-600" /> Regulação {claim.insurer || 'Seguradora'}
                                    </h3>
                                    <div className="flex items-center gap-4 bg-white p-2 px-4 rounded-xl shadow-sm border border-purple-100">
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Complexidade (Art. 86)</span>
                                        <button
                                            onClick={() => isAdminOrInternal && setComplexStatus(claim.id, !claim.isComplex)}
                                            className={`w-12 h-6 rounded-full transition-all relative ${claim.isComplex ? 'bg-purple-600' : 'bg-gray-200'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${claim.isComplex ? 'right-1' : 'left-1'}`}></div>
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                                    <div className="p-4 bg-white rounded-2xl border border-purple-50 shadow-sm">
                                        <p className="text-[10px] font-black text-purple-600 uppercase mb-2 tracking-widest">Status de Prorrogação</p>
                                        <p className="text-xs text-gray-600 font-medium">
                                            {claim.isComplex ? 'Regra de Complexidade Ativada: Prazo estendido para 120 dias conforme regulamentação.' : 'Fluxo padrão de 30 dias ativos (Regra Geral).'}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-white rounded-2xl border border-purple-50 shadow-sm">
                                        <p className="text-[10px] font-black text-purple-600 uppercase mb-2 tracking-widest">Integridade de Dados</p>
                                        <div className="flex flex-col gap-2">
                                            <p className="text-xs text-gray-600 font-medium flex items-center gap-2">
                                                <Lock size={12} className="text-purple-400" /> Criptografia AES-256 ativa.
                                            </p>
                                            <p className="text-xs text-gray-600 font-medium flex items-center gap-2">
                                                <Eye size={12} className="text-purple-400" /> Rastreamento de leitura ativado.
                                            </p>
                                        </div>
                                    </div>
                                </div>
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

            <UploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setUploadModalOpen(false)}
                onUpload={handleUpload}
                onCommentOnly={handleCommentOnly}
                folderName={currentFolder.name}
            />

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

            {versionsModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setVersionsModal({ open: false, file: null, versions: [] })}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                            <div>
                                <h3 className="text-xl font-black text-gray-900 font-display uppercase tracking-tight">Histórico de Versões</h3>
                                <p className="text-xs text-gray-500 font-medium mt-1">{versionsModal.file?.name}</p>
                            </div>
                            <button onClick={() => setVersionsModal({ open: false, file: null, versions: [] })} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
                                <X size={20} />
                            </button>
                        </div>
                        {versionsModal.versions.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-8">Sem histórico de versões para este arquivo.</p>
                        ) : (
                            <div className="space-y-3">
                                {versionsModal.versions.map(v => {
                                    const created = v.created_at ? new Date(v.created_at).toLocaleString('pt-BR') : '-';
                                    return (
                                        <div key={v.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">v{v.version}</p>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{v.size_bytes} bytes · {v.mime_type}</p>
                                                <p className="text-[10px] text-gray-400 font-bold mt-1">enviado em {created}</p>
                                            </div>
                                            <a
                                                href={documentDownloadHref(v.id)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700"
                                            >
                                                Baixar
                                            </a>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal: Adicionar Colaborador */}
            {collaboratorModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setCollaboratorModal({ open: false, search: '' })}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100 flex items-start justify-between">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 font-display">Adicionar Colaborador</h3>
                                <p className="text-xs text-slate-500 font-medium mt-1">Selecione um usuário do tenant para atribuir como responsável pelo sinistro #{claim.number}.</p>
                            </div>
                            <button onClick={() => setCollaboratorModal({ open: false, search: '' })} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {(backendUsers || []).length === 0 ? (
                                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium leading-relaxed">
                                    Lista de usuários indisponível. Apenas manager+ consegue listar usuários do tenant via /users — este botão é uma operação exclusiva de gestores.
                                </div>
                            ) : (
                                <>
                                    <input
                                        type="text"
                                        autoFocus
                                        value={collaboratorModal.search}
                                        onChange={(e) => setCollaboratorModal({ ...collaboratorModal, search: e.target.value })}
                                        placeholder="Buscar por email…"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-300"
                                    />
                                    <ul className="max-h-72 overflow-y-auto space-y-1.5">
                                        {backendUsers
                                            .filter((u) => u.role !== 'admin')
                                            .filter((u) => !collaboratorModal.search || u.email?.toLowerCase().includes(collaboratorModal.search.toLowerCase()))
                                            .map((u) => {
                                                const isCurrent = u.id === claim.assignedTo;
                                                return (
                                                    <li key={u.id}>
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                await handleAssign(u.id);
                                                                setCollaboratorModal({ open: false, search: '' });
                                                            }}
                                                            className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${isCurrent ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50 border border-transparent'}`}
                                                        >
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-bold text-slate-800 truncate">{u.email}</p>
                                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{u.role}</p>
                                                            </div>
                                                            {isCurrent && <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Atual</span>}
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                    </ul>
                                    {claim.assignedTo && (
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                await handleAssign('');
                                                setCollaboratorModal({ open: false, search: '' });
                                            }}
                                            className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                        >
                                            Remover responsável atual
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

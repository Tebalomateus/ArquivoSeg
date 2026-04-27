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
import { useClaims } from '../context/ClaimsContext';
import { actorLabelFromDbId } from '../api/auth';

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
const UploadModal = ({ isOpen, onClose, onUpload, folderName }) => {
    const [file, setFile] = useState(null);
    const [annotation, setAnnotation] = useState('');
    const [confidentiality, setConfidentiality] = useState('Geral');
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
        if (!file) return alert('Selecione um arquivo!');
        if (wordCount < 5) return alert('A anotação contextual deve ter no mínimo 5 palavras!');

        try {
            await onUpload({
                file,
                name: file.name,
                annotation,
                confidentiality,
            });
            setFile(null);
            setAnnotation('');
            onClose();
        } catch (err) {
            alert(`Falha no upload: ${err?.message || err}`);
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
                        className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-xl ${file && wordCount >= 5 ? 'bg-secondary text-white shadow-secondary/10 hover:bg-secondary-hover hover:-translate-y-1' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                    >
                        <Send size={20} />
                        Confirmar Envio Seguro
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
        addDocument,
        uploadFileToClaim,
        refreshClaimFiles,
        documentDownloadHref,
        fetchAudit,
        auditByClaim,
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

    const claim = claims.find(c => c.id === id);

    useEffect(() => {
        if (claim) setLocalObs(claim.observations || '');
    }, [claim]);

    useEffect(() => {
        if (id && refreshClaimFiles) refreshClaimFiles(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const canReadAudit = currentUser?.backRole === 'manager' || currentUser?.backRole === 'admin';

    useEffect(() => {
        if (id && fetchAudit && canReadAudit) fetchAudit(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, canReadAudit]);

    const auditEntries = auditByClaim?.[id];

    const formatAuditEntry = (entry) => {
        const ts = entry.timestamp ? new Date(entry.timestamp) : null;
        return {
            id: entry.id,
            user: entry.actor_user_id ? actorLabelFromDbId(entry.actor_user_id) : 'Sistema',
            action: entry.action || entry.resource_type,
            date: ts ? ts.toLocaleString('pt-BR') : '',
        };
    };

    if (!claim) return <div className="p-20 text-center font-bold text-gray-500 h-full flex items-center justify-center">Sinistro não encontrado.</div>;

    // Verificações de segurança para evitar crash
    if (!currentUser) return null;

    const isAdminOrInternal = currentUser?.role === 'ADMIN' || currentUser?.role === 'ANALISTA' || currentUser?.role === 'PERITO';
    const isAuditor = currentUser?.role === 'AUDITOR';

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
        if (payload.file) {
            await uploadFileToClaim(claim.id, currentFolder.category, payload.file, {
                annotation: payload.annotation,
                confidentiality: payload.confidentiality,
            });
        } else {
            addDocument(claim.id, currentFolderId, { ...payload, user: currentUser.name });
        }
    };

    const handleViewDoc = (doc) => {
        if (isAuditor) {
            return alert('Auditor: O conteúdo dos documentos é restrito para integridade de dados. Acesso negado pelo protocolo de compliance.');
        }
        logView(claim.id, doc.name);
        alert(`Simulando visualização segura de: ${doc.name}\nLog registrado na auditoria.`);
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
                    <p className="text-sm text-gray-500 font-bold uppercase tracking-tight">{claim.title} <span className="text-gray-300 mx-2">|</span> <span className="text-blue-600">{claim.insurer}</span></p>
                </div>

                <div className="flex flex-wrap gap-4 bg-white/50 p-2 rounded-2xl border border-white shadow-sm backdrop-blur-md">
                    <div className="flex p-1 bg-gray-100 rounded-xl border border-gray-200">
                        <button
                            onClick={() => setViewMode('interaction')}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'interaction' ? 'bg-white shadow-md text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Exploração
                        </button>
                        {(isAdminOrInternal || isAuditor) && (
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
                        </h3>
                        {canReadAudit && auditEntries === null && (
                            <p className="text-[10px] text-amber-600 font-medium">Sem permissão para ler audit logs.</p>
                        )}
                        <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-200">
                            {(canReadAudit && Array.isArray(auditEntries) && auditEntries.length > 0
                                ? auditEntries.slice(0, 6).map(formatAuditEntry)
                                : (claim.activities || []).slice(0, 4)
                            ).map((activity) => (
                                <div key={activity.id} className="relative pl-8">
                                    <div className="absolute left-0 top-1 w-6 h-6 bg-white rounded-full border-2 border-gray-100 flex items-center justify-center z-10 shadow-sm">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-600 leading-tight font-bold">
                                            <span className="text-gray-900">{activity.user}</span> {activity.action}
                                        </p>
                                        <p className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-tighter">{activity.date}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="lg:col-span-3 space-y-6">
                    {viewMode === 'interaction' ? (
                        <>
                            {/* Checklist Section */}
                            {currentFolder.checklist && currentFolder.checklist.length > 0 && (
                                <div className="card border-l-[6px] border-blue-600 py-6 bg-blue-50/10">
                                    <h3 className="text-xs font-black text-gray-900 mb-6 flex items-center gap-2 uppercase tracking-widest">
                                        <CheckCircle size={18} className="text-blue-600" />
                                        Checklist: {currentFolder.name}
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {currentFolder.checklist.map(item => (
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
                                </div>
                            )}

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
                                    <div className="flex gap-2">
                                        <button className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100">
                                            <Search size={18} />
                                        </button>
                                        <button className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100">
                                            <Filter size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 space-y-4">
                                    {currentFolder.documents.map((doc) => (
                                        <div key={doc.id} className="group p-5 bg-white rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-50 transition-all duration-300">
                                            <div className="flex items-start justify-between gap-6">
                                                <div className="flex gap-5 flex-1">
                                                    <div className="w-12 h-12 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-inner">
                                                        <FileText size={24} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <h4 className="font-bold text-gray-900 uppercase text-xs tracking-tight">{doc.name}</h4>
                                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded border tracking-widest transition-all ${doc.confidentiality === 'Altamente Confidencial' ? 'bg-red-50 border-red-200 text-red-600' :
                                                                doc.confidentiality === 'Confidencial' ? 'bg-amber-50 border-amber-200 text-amber-600' :
                                                                    doc.confidentiality === 'Público' ? 'bg-green-50 border-green-200 text-green-600' :
                                                                        'bg-blue-50 border-blue-200 text-blue-600'
                                                                }`}>
                                                                {doc.confidentiality || 'Geral'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                                                            <span className="flex items-center gap-1"><Calendar size={12} className="text-gray-300" /> {doc.date}</span>
                                                            <span className="flex items-center gap-1"><User size={12} className="text-gray-300" /> {doc.user}</span>
                                                        </div>
                                                        <div className="p-4 bg-gray-50/80 rounded-2xl border border-dashed border-gray-200 text-[11px] font-medium text-gray-600 relative group-hover:bg-white group-hover:border-blue-100 transition-all">
                                                            <MessageSquare className="absolute -top-1.5 -left-1.5 w-6 h-6 text-blue-100 group-hover:text-blue-200" />
                                                            <p className="leading-relaxed opacity-80 italic">"{doc.annotation}"</p>
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
                                                        <a
                                                            href={documentDownloadHref(doc.backFileVerId)}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="w-10 h-10 flex items-center justify-center bg-white shadow-lg border border-gray-100 rounded-xl text-gray-600 hover:bg-blue-600 hover:text-white transition-all"
                                                            title="Baixar documento"
                                                        >
                                                            <Download size={18} />
                                                        </a>
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
                            {/* Management View: External Sharing & Invite */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="card bg-blue-600 border-0 text-white shadow-2xl shadow-blue-200 relative overflow-hidden group">
                                    <Globe className="absolute top-0 right-0 w-32 h-32 text-white/10 -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />
                                    <div className="relative z-10">
                                        <h3 className="text-xl font-black mb-2 font-display uppercase tracking-tight flex items-center gap-3">
                                            <Share2 size={24} /> Portal do Cliente
                                        </h3>
                                        <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mb-6 border-b border-blue-400 pb-4">Acesso Externo Seguro via Token</p>

                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                readOnly
                                                value={`${window.location.origin}/portal/${claim.shareToken}`}
                                                className="flex-1 bg-blue-700/50 border border-blue-400 rounded-xl px-4 py-3 text-[10px] font-bold text-white outline-none font-mono"
                                            />
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`${window.location.origin}/portal/${claim.shareToken}`);
                                                    alert('Link do portal copiado!');
                                                }}
                                                className="bg-white text-blue-600 px-5 py-3 rounded-xl text-xs font-black shadow-lg hover:bg-blue-50 transition-all uppercase tracking-widest"
                                            >
                                                Copiar
                                            </button>
                                        </div>
                                        <p className="mt-4 text-[10px] text-blue-200 font-medium">Links compartilhados via este portal são rastreados pela Auditoria.</p>
                                    </div>
                                </div>

                                <div className="card border-2 border-gray-100 bg-gray-50/30 flex flex-col justify-between">
                                    <div>
                                        <h3 className="text-lg font-black text-gray-900 mb-2 font-display uppercase tracking-tight flex items-center gap-3">
                                            <UserPlus size={24} className="text-blue-600" /> Vendedores & Peritos
                                        </h3>
                                        <p className="text-xs text-gray-500 font-medium mb-6">Convide colaboradores externos especificamente para este processo.</p>
                                    </div>
                                    <button
                                        className="w-full py-4 border-2 border-blue-100 text-blue-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm"
                                        onClick={() => alert('Abrindo modal de convite para o sinistro ' + claim.number)}
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
                                        <Shield size={24} className="text-purple-600" /> Regulação Tokio Marine
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
                folderName={currentFolder.name}
            />
        </div>
    );
}

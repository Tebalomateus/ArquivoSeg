import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Upload,
    CheckCircle,
    FileText,
    X,
    ShieldCheck,
    AlertCircle,
    Folder,
    Send,
    Clock,
    Activity,
    ArrowRight,
    Lock,
    Mail,
    Key,
    Building2,
    User,
    ChevronRight,
    ExternalLink
} from 'lucide-react';
import { useClaims } from '../context/ClaimsContext';

export default function PublicShare() {
    const { token } = useParams();
    const navigate = useNavigate();
    const {
        claims,
        addDocumentByToken,
        verifyEmail,
        confirmOTP,
        saveLeadData,
        isGuestVerified
    } = useClaims();

    const [claim, setClaim] = useState(null);
    const [isVerified, setIsVerified] = useState(false);

    // Gateway States
    const [step, setStep] = useState(1); // 1: Landing, 2: Email, 3: OTP, 4: Enrichment
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [leadData, setLeadData] = useState({ name: '', organization: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Upload Portal States
    const [selectedCategory, setSelectedCategory] = useState('');
    const [file, setFile] = useState(null);
    const [annotation, setAnnotation] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const fileInputRef = useRef();

    useEffect(() => {
        const found = claims.find(c => c.shareToken === token);
        if (found) {
            setClaim(found);
            if (isGuestVerified(token)) {
                setIsVerified(true);
            }
        }
    }, [token, claims, isGuestVerified]);

    if (!claim) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white p-12 rounded-[2.5rem] shadow-2xl max-w-md text-center space-y-6 border border-gray-100">
                    <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                        <AlertCircle size={40} />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-2xl font-black text-gray-900 font-display uppercase tracking-tight">Acesso Expirado</h1>
                        <p className="text-gray-500 font-medium">O link que você utilizou não é mais válido ou atingiu o limite de tempo de segurança.</p>
                    </div>
                </div>
            </div>
        );
    }

    // Gateway Handlers
    const handleStart = () => setStep(2);

    const handleSendOTP = (e) => {
        e.preventDefault();
        setError('');
        if (!email.includes('@')) return setError('E-mail inválido');
        setIsSubmitting(true);
        setTimeout(() => {
            verifyEmail(email);
            setIsSubmitting(false);
            setStep(3);
        }, 800);
    };

    const handleVerifyOTP = (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        setTimeout(() => {
            if (confirmOTP(email, otp, token)) {
                setIsSubmitting(false);
                setStep(4);
            } else {
                setError('Código incorreto. Use 123456 para testes.');
                setIsSubmitting(false);
            }
        }, 800);
    };

    const handleSaveLead = (e) => {
        e.preventDefault();
        if (!leadData.name || !leadData.organization) return setError('Preencha todos os campos');
        saveLeadData(email, leadData);
        setIsVerified(true);
    };

    // Upload Handlers
    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const wordCount = annotation.trim().split(/\s+/).filter(w => w.length > 0).length;

    const handleSubmitUpload = (e) => {
        e.preventDefault();
        if (!selectedCategory) return alert('Selecione uma pasta para o upload!');
        if (!file) return alert('Selecione um arquivo!');
        if (wordCount < 5) return alert('A anotação contextual deve ter no mínimo 5 palavras!');

        const success = addDocumentByToken(token, selectedCategory, {
            name: file.name,
            annotation: annotation,
            user: `Visitante (${email})`
        });

        if (success) {
            setIsSuccess(true);
            setFile(null);
            setAnnotation('');
        }
    };

    // UI Renders
    if (isSuccess) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-md rounded-[2.5rem] p-12 text-center space-y-8 shadow-2xl border border-gray-100 animate-fade-in relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-green-500"></div>
                    <div className="w-24 h-24 bg-green-50 text-green-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner ring-8 ring-green-100/50">
                        <CheckCircle size={48} />
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-3xl font-black text-gray-900 font-display uppercase tracking-tight">Sucesso!</h1>
                        <p className="text-gray-500 font-medium leading-relaxed">Seu documento foi enviado e criptografado com sucesso. O analista responsável pelo sinistro <span className="text-blue-600 font-black">#{claim.number}</span> já recebeu seu arquivo.</p>
                    </div>
                    <button
                        onClick={() => setIsSuccess(false)}
                        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-xl shadow-blue-100"
                    >
                        Enviar outro arquivo
                    </button>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Powered by ArquivoSeg SecLayer</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen font-sans relative overflow-x-hidden bg-[#F8FAFC]">
            {/* 
                GATEWAY OVERLAY 
                Aparece apenas quando não está verificado. 
            */}
            {!isVerified && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
                    <div className="w-full max-w-xl relative animate-slide-up">
                        <div className="bg-white rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden border border-white/10">
                            {/* Header Section */}
                            <div className="bg-slate-50 p-10 border-b border-gray-100 text-center relative">
                                <div className="w-20 h-20 bg-white rounded-3xl shadow-xl border border-gray-100 flex items-center justify-center mx-auto mb-6">
                                    <ShieldCheck size={40} className="text-secondary" />
                                </div>
                                <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary mb-2">Portal de Segurança ArquivoSeg</h2>
                                <h1 className="text-3xl font-black text-gray-900 font-display tracking-tight leading-tight">
                                    Verificação de Acesso Seguro
                                </h1>
                                <p className="text-gray-400 text-sm font-medium mt-2">Sinistro <span className="text-gray-900 font-bold">#{claim.number}</span> • {claim.insurer}</p>
                            </div>

                            <div className="p-10 md:p-14">
                                {step === 1 && (
                                    <div className="space-y-10 animate-fade-in">
                                        <div className="bg-blue-50/50 rounded-3xl p-8 border border-blue-100/50 space-y-4">
                                            <div className="flex items-start gap-4">
                                                <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-secondary/10 flex items-center justify-center shrink-0">
                                                    <Lock size={20} className="text-secondary" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-primary uppercase tracking-tight">Conteúdo Restrito</h4>
                                                    <p className="text-xs text-primary/70 font-medium leading-relaxed mt-1">Este link contém informações sensíveis sobre o processo <strong>{claim.title}</strong>. Para prosseguir, precisamos validar sua identidade.</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <button
                                                onClick={handleStart}
                                                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] hover:bg-slate-800 transition-all flex items-center justify-center gap-4 group shadow-xl shadow-slate-200"
                                            >
                                                Acessar Documentação
                                                <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
                                            </button>
                                            <p className="text-[10px] text-center text-gray-400 font-black uppercase tracking-widest leading-loose">
                                                Ao acessar este portal, você concorda com nossos <br /> termos de sigilo e políticas de LGPD.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {step === 2 && (
                                    <form onSubmit={handleSendOTP} className="space-y-8 animate-slide-up">
                                        <div className="space-y-4">
                                            <label className="text-xs font-black text-gray-900 uppercase tracking-widest ml-1 flex items-center gap-2">
                                                <Mail size={14} className="text-secondary" /> E-mail Profissional
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="email"
                                                    required
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    placeholder="exemplo@empresa.com.br"
                                                    className="w-full px-8 py-5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-secondary/10 focus:bg-white outline-none transition-all text-sm font-bold shadow-inner"
                                                />
                                            </div>
                                            {error && <p className="text-[10px] text-red-500 font-black uppercase tracking-widest ml-1">{error}</p>}
                                        </div>
                                        <button
                                            disabled={isSubmitting}
                                            className="w-full py-5 bg-secondary text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] hover:bg-secondary-hover transition-all shadow-xl shadow-secondary/10 disabled:opacity-50 flex items-center justify-center gap-3"
                                        >
                                            {isSubmitting ? 'Enviando...' : 'Receber Código de Acesso'}
                                            <ChevronRight size={20} />
                                        </button>
                                    </form>
                                )}

                                {step === 3 && (
                                    <form onSubmit={handleVerifyOTP} className="space-y-8 animate-slide-up">
                                        <div className="space-y-4 text-center">
                                            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
                                                <Key size={30} />
                                            </div>
                                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Verifique seu e-mail</h3>
                                            <p className="text-xs text-gray-400 font-medium">Enviamos um código de segurança de 6 dígitos para <span className="text-gray-900 font-bold">{email}</span>. Insira abaixo para confirmar.</p>
                                        </div>
                                        <div className="space-y-4">
                                            <input
                                                type="text"
                                                required
                                                maxLength={6}
                                                value={otp}
                                                onChange={(e) => setOtp(e.target.value)}
                                                placeholder="000000"
                                                className="w-full text-center px-8 py-6 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-8 focus:ring-blue-50 focus:bg-white outline-none transition-all text-4xl font-black tracking-[0.5em] shadow-inner"
                                            />
                                            {error && <p className="text-center text-[10px] text-red-500 font-black uppercase tracking-widest">{error}</p>}
                                        </div>
                                        <button
                                            disabled={isSubmitting}
                                            className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 disabled:opacity-50"
                                        >
                                            {isSubmitting ? 'Validando...' : 'Confirmar e Continuar'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setStep(2)}
                                            className="w-full text-[10px] text-gray-400 font-black uppercase tracking-widest hover:text-blue-600 transition-colors"
                                        >
                                            Alterar e-mail
                                        </button>
                                    </form>
                                )}

                                {step === 4 && (
                                    <form onSubmit={handleSaveLead} className="space-y-8 animate-slide-up">
                                        <div className="space-y-2 text-center mb-8">
                                            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-green-100 shadow-sm">
                                                <CheckCircle size={30} />
                                            </div>
                                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight text-center">Identidade Confirmada</h3>
                                            <p className="text-xs text-gray-400 font-medium">Quase lá! Complete seus dados para acessar o repositório de documentos do sinistro.</p>
                                        </div>
                                        <div className="space-y-5">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                                    <User size={12} /> Nome Completo
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={leadData.name}
                                                    onChange={(e) => setLeadData({ ...leadData, name: e.target.value })}
                                                    placeholder="Seu nome"
                                                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:bg-white outline-none transition-all text-sm font-bold shadow-inner"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                                    <Building2 size={12} /> Organização / Empresa
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={leadData.organization}
                                                    onChange={(e) => setLeadData({ ...leadData, organization: e.target.value })}
                                                    placeholder="Nome da sua empresa"
                                                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:bg-white outline-none transition-all text-sm font-bold shadow-inner"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-3"
                                        >
                                            Liberar Acesso Completo
                                            <ArrowRight size={20} />
                                        </button>
                                    </form>
                                )}
                            </div>

                            {/* Footer / Trust badges */}
                            <div className="bg-slate-50 p-8 border-t border-gray-100 flex items-center justify-center gap-10 opacity-60">
                                <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                    <Lock size={12} /> Criptografia AES-256
                                </div>
                                <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                    <ShieldCheck size={12} /> SecLayer Active
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 
                PORTAL CONTENT (ALWAYS RENDERED)
                Fica turvo e inacessível se não verificado.
            */}
            <div className={`transition-all duration-1000 ${!isVerified ? 'blur-2xl opacity-40 scale-[0.98] pointer-events-none select-none' : 'blur-0 opacity-100 scale-100'}`}>
                {/* Background elements */}
                <div className="absolute top-0 left-0 w-full h-[50vh] bg-slate-900 skew-y-[-4deg] origin-top-left -mt-20"></div>

                <div className="max-w-6xl mx-auto relative z-10 px-6 pt-12 pb-24">
                    <header className="mb-16 flex flex-col items-center md:items-start">
                        <div className="flex items-center justify-between w-full mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-white rounded-2xl shadow-2xl flex items-center justify-center border border-gray-100 relative">
                                    <ShieldCheck size={32} className="text-primary" />
                                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-secondary-light rounded-full border-2 border-white flex items-center justify-center text-[9px] font-black text-white">
                                        ✓
                                    </div>
                                </div>
                                <div className="text-white">
                                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 text-secondary-light">Portal do Segurado</h2>
                                    <p className="text-2xl font-black font-display tracking-tight text-white">Arquivo<span className="text-secondary-light">Seg</span></p>
                                </div>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 flex items-center gap-3 text-white">
                                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                                    <User size={16} />
                                </div>
                                <div className="text-left">
                                    <p className="text-[8px] font-black uppercase opacity-60 tracking-widest">Sessão Segura</p>
                                    <p className="text-[10px] font-bold">{isVerified ? email : 'Aguardando Login...'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-[2rem] w-full shadow-2xl">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                                <div className="md:col-span-2 space-y-4">
                                    <span className="bg-blue-600/30 text-blue-200 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-400/30">Processo Ativo</span>
                                    <h1 className="text-4xl md:text-5xl font-black text-white font-display tracking-tighter">Sinistro {claim.number}</h1>
                                    <p className="text-blue-100 font-medium text-lg leading-relaxed max-w-xl opacity-80">{claim.title}</p>
                                </div>
                                <div className="bg-white rounded-3xl p-6 shadow-xl flex flex-col items-center text-center space-y-2">
                                    <div className="w-16 h-16 relative">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-gray-100" />
                                            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={176} strokeDashoffset={176 - (176 * claim.progress) / 100} strokeLinecap="round" className="text-blue-600 transition-all duration-1000" />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-gray-900">{claim.progress}%</div>
                                    </div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Progresso Total</p>
                                    <div className="w-full h-[1px] bg-gray-100 my-2"></div>
                                    <div className="flex items-center gap-2 text-rose-600">
                                        <Clock size={14} />
                                        <span className="text-sm font-black font-display">{claim.deadline?.remainingDays || 30} dias restantes</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </header>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                        {/* Timeline & Feedback */}
                        <div className="lg:col-span-1 space-y-8">
                            <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-gray-100">
                                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-8 flex items-center gap-3">
                                    <Activity size={18} className="text-blue-600" />
                                    Status do Processo
                                </h3>
                                <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-100">
                                    {claim.folders.map((folder, idx) => (
                                        <div key={folder.id} className="relative pl-8 group">
                                            <div className={`absolute left-0 top-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center z-10 transition-all ${folder.completion === 100 ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-100' : 'bg-white border-gray-200 text-gray-300'}`}>
                                                {folder.completion === 100 ? <CheckCircle size={12} /> : <div className="w-1.5 h-1.5 bg-gray-200 rounded-full"></div>}
                                            </div>
                                            <div>
                                                <p className={`text-xs font-black uppercase tracking-tight ${folder.completion === 100 ? 'text-gray-900' : 'text-gray-400'}`}>{folder.name}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                                                        <div className={`h-full transition-all duration-500 ${folder.completion === 100 ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${folder.completion}%` }}></div>
                                                    </div>
                                                    <span className="text-[9px] font-black text-gray-400">{folder.completion}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden group">
                                <Lock className="absolute top-0 right-0 w-32 h-32 text-white/5 -mr-12 -mt-12 group-hover:rotate-12 transition-transform duration-700" />
                                <div className="relative z-10">
                                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20">
                                        <ShieldCheck size={20} />
                                    </div>
                                    <h4 className="text-lg font-black font-display uppercase tracking-tight mb-2">Ambiente Ultra Seguro</h4>
                                    <p className="text-slate-400 text-xs font-medium leading-relaxed">Todos os arquivos enviados são fragmentados e criptografados antes de atingirem nossos servidores AWS. Trilha de auditoria 24/7 ativa.</p>
                                </div>
                            </div>
                        </div>

                        {/* Upload Form */}
                        <div className="lg:col-span-2">
                            <form onSubmit={handleSubmitUpload} className="bg-white rounded-[2.5rem] p-10 md:p-12 shadow-2xl border border-gray-100 space-y-10 relative">
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-black text-gray-900 font-display uppercase tracking-tight">Anexar Nova Documentação</h3>
                                        <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase tracking-tighter">Passo 1 de 2</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {['causa', 'prejuizo', 'liquidacao'].map(cat => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => setSelectedCategory(cat)}
                                                className={`
                                                    p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 text-center group
                                                    \${selectedCategory === cat
                                                        ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-100 -translate-y-1'
                                                        : 'bg-gray-50 border-gray-50 text-gray-400 hover:border-blue-200 hover:bg-white hover:text-blue-600'}
                                                `}
                                            >
                                                <Folder size={24} className={selectedCategory === cat ? 'text-white' : 'text-gray-300 group-hover:text-blue-600'} />
                                                <span className="text-[10px] font-black uppercase tracking-[0.1em]">
                                                    {cat === 'causa' ? 'Causa' : cat === 'prejuizo' ? 'Prejuízo' : 'Liquidação'}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div
                                        onClick={() => fileInputRef.current.click()}
                                        className="border-[3px] border-dashed border-gray-100 rounded-[2rem] p-12 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group bg-gray-50/20 relative"
                                    >
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                                        <div className="w-16 h-16 bg-white rounded-2xl shadow-lg border border-gray-100 flex items-center justify-center mx-auto mb-6 text-blue-600 group-hover:scale-110 transition-transform duration-500">
                                            <Upload size={28} />
                                        </div>
                                        <p className="text-sm font-black text-gray-900 uppercase tracking-widest">Clique para selecionar arquivo</p>
                                        <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase">PDF, DOCX, XLSX ou imagens de alta resolução</p>
                                        {file && (
                                            <div className="mt-8 p-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl animate-bounce">
                                                <FileText size={16} />
                                                {file.name}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-black text-gray-900 uppercase tracking-widest ml-1">Anotação Importante*</label>
                                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter \${wordCount >= 5 ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                            {wordCount}/5 palavras
                                        </span>
                                    </div>
                                    <textarea
                                        value={annotation}
                                        onChange={(e) => setAnnotation(e.target.value)}
                                        placeholder="Descreva brevemente o que este documento representa para o seu sinistro..."
                                        className="w-full px-6 py-5 bg-gray-50 border border-gray-50 rounded-[2rem] focus:ring-4 focus:ring-blue-100 focus:bg-white outline-none transition-all h-36 text-sm font-medium text-gray-700 resize-none shadow-inner"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={!selectedCategory || !file || wordCount < 5}
                                    className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-4 \${(!selectedCategory || !file || wordCount < 5) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white shadow-2xl shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1'}`}
                                >
                                    <Send size={20} />
                                    Finalizar Envio Seguro
                                    <ArrowRight size={20} className="opacity-40" />
                                </button>
                            </form>
                        </div>
                    </div>

                    <footer className="mt-20 text-center space-y-4">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em]">
                            ArquivoSeg Monitoring System • © 2026
                        </p>
                        <div className="flex items-center justify-center gap-8 opacity-40">
                            <img src="https://img.icons8.com/color/48/000000/amazon-web-services.png" alt="AWS" className="h-6 grayscale hover:grayscale-0 transition-all" />
                            <img src="https://img.icons8.com/color/48/000000/google-cloud-platform.png" alt="GCP" className="h-6 grayscale hover:grayscale-0 transition-all" />
                        </div>
                    </footer>
                </div>
            </div>
        </div>
    );
}

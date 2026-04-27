import { useParams } from 'react-router-dom';
import { ShieldCheck, Download, Lock, ExternalLink, AlertCircle } from 'lucide-react';

/**
 * Portal público de download de documento compartilhado.
 *
 * O backend expõe `GET /s/:token` que valida o token e responde com 302 para
 * um presigned URL do MinIO/S3. Aqui apenas oferecemos o link — o browser
 * segue o redirect e baixa o arquivo. Sem upload anônimo (back não suporta).
 */
export default function PublicShare() {
    const { token } = useParams();

    if (!token) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white p-12 rounded-[2.5rem] shadow-2xl max-w-md text-center space-y-6 border border-gray-100">
                    <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                        <AlertCircle size={40} />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-2xl font-black text-gray-900 font-display uppercase tracking-tight">Link inválido</h1>
                        <p className="text-gray-500 font-medium">O link compartilhado está mal-formado ou foi truncado.</p>
                    </div>
                </div>
            </div>
        );
    }

    const downloadHref = `/s/${token}`;

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans flex items-center justify-center p-6">
            <div className="w-full max-w-xl">
                <div className="bg-white rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.18)] overflow-hidden border border-white/20">
                    <div className="bg-slate-900 p-10 text-center relative overflow-hidden">
                        <Lock className="absolute top-0 right-0 w-40 h-40 text-white/5 -mr-12 -mt-12" />
                        <div className="relative z-10 flex flex-col items-center gap-4">
                            <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center">
                                <ShieldCheck size={40} className="text-secondary" />
                            </div>
                            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary-light">Portal de Compartilhamento</h2>
                            <h1 className="text-3xl font-black text-white font-display tracking-tight">
                                Documento Disponível
                            </h1>
                            <p className="text-slate-300 text-sm font-medium max-w-md">
                                Este link foi gerado pelo gestor do sinistro e dá acesso direto ao arquivo. Cada acesso é registrado na trilha de auditoria.
                            </p>
                        </div>
                    </div>

                    <div className="p-10 md:p-14 space-y-6">
                        <div className="bg-blue-50/50 rounded-3xl p-6 border border-blue-100/50 flex items-start gap-4">
                            <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-secondary/10 flex items-center justify-center shrink-0">
                                <Lock size={20} className="text-secondary" />
                            </div>
                            <div>
                                <h4 className="text-xs font-black text-primary uppercase tracking-widest">Token Seguro</h4>
                                <p className="text-[11px] text-primary/70 font-mono mt-1 break-all">{token}</p>
                            </div>
                        </div>

                        <a
                            href={downloadHref}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full py-5 bg-secondary text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] hover:bg-secondary-hover transition-all flex items-center justify-center gap-4 shadow-xl shadow-secondary/20 group"
                        >
                            <Download size={20} />
                            Baixar Documento
                            <ExternalLink size={16} className="opacity-60 group-hover:translate-x-1 transition-transform" />
                        </a>

                        <p className="text-[10px] text-center text-gray-400 font-black uppercase tracking-widest leading-loose">
                            Se o link tiver sido revogado ou expirado, esta página retornará 404.<br />
                            Compartilhamentos são auditados por LGPD.
                        </p>
                    </div>

                    <div className="bg-slate-50 p-6 border-t border-gray-100 text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            Powered by ArquivoSeg SecLayer
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, ShieldCheck, XCircle } from 'lucide-react';
import { getSignupStatus } from '../api/signup';

// Mercado Pago Checkout Pro's back_url lands here after the payer finishes (or abandons)
// checkout. This page is purely cosmetic — the authoritative confirmation happens
// server-side via the /api/v1/webhooks/mercadopago webhook, never via this redirect. So
// we poll GET /api/v1/signup/{id} until status flips to "completed" or "failed".

const STATUS_COPY = {
    pending: { icon: Clock, color: 'text-amber-600 bg-amber-50', title: 'Aguardando confirmação', text: 'Estamos aguardando a confirmação do pagamento junto ao Mercado Pago. Isso pode levar alguns instantes.' },
    authorized: { icon: Clock, color: 'text-amber-600 bg-amber-50', title: 'Pagamento aprovado', text: 'Pagamento confirmado — estamos criando sua empresa e usuário administrador.' },
    completed: { icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50', title: 'Tudo pronto!', text: 'Sua empresa foi criada. Enviamos um e-mail para você definir sua senha e acessar o painel.' },
    failed: { icon: XCircle, color: 'text-red-600 bg-red-50', title: 'Pagamento não aprovado', text: 'Não conseguimos confirmar o pagamento. Você pode tentar novamente.' },
    cancelled: { icon: XCircle, color: 'text-red-600 bg-red-50', title: 'Assinatura cancelada', text: 'A assinatura foi cancelada antes da confirmação.' },
};

export default function SignupPending() {
    const [searchParams] = useSearchParams();
    const id = searchParams.get('id');
    const [status, setStatus] = useState('pending');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) return;
        let cancelled = false;

        const poll = async () => {
            try {
                const res = await getSignupStatus(id);
                if (!cancelled) setStatus(res.status);
            } catch {
                if (!cancelled) setError('Não foi possível consultar o status do cadastro.');
            }
        };

        poll();
        const interval = setInterval(poll, 4000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [id]);

    if (!id) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white p-12 rounded-[2.5rem] shadow-2xl max-w-md text-center space-y-4 border border-gray-100">
                    <XCircle className="mx-auto text-red-500" size={40} />
                    <h1 className="text-2xl font-black text-gray-900 font-display">Link inválido</h1>
                    <p className="text-gray-500 font-medium">Nenhum cadastro foi informado.</p>
                </div>
            </div>
        );
    }

    const copy = STATUS_COPY[status] ?? STATUS_COPY.pending;
    const Icon = copy.icon;
    const settled = status === 'completed' || status === 'failed' || status === 'cancelled';

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
            <div className="w-full max-w-lg bg-white rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.18)] overflow-hidden border border-white/20">
                <div className="bg-slate-900 p-10 text-center relative overflow-hidden">
                    <ShieldCheck className="absolute top-0 right-0 w-40 h-40 text-white/5 -mr-12 -mt-12" />
                    <div className="relative z-10 flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-white rounded-3xl shadow-xl flex items-center justify-center">
                            <ShieldCheck size={32} className="text-secondary" />
                        </div>
                        <h1 className="text-2xl font-black text-white font-display">ArquivoSeg</h1>
                    </div>
                </div>
                <div className="p-10 text-center space-y-6">
                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto ${copy.color}`}>
                        <Icon size={32} className={!settled ? 'animate-pulse' : ''} />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-black text-gray-900 font-display">{copy.title}</h2>
                        <p className="text-gray-500 font-medium leading-relaxed">{copy.text}</p>
                    </div>
                    {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
                    {status === 'completed' && (
                        <a href="/login" className="inline-block w-full py-4 rounded-2xl font-bold text-white bg-secondary hover:bg-secondary-hover transition-all">
                            Ir para o login
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Mail, ShieldCheck, User } from 'lucide-react';
import { startSignup } from '../api/signup';
import { HttpError } from '../api/client';

// Self-service tenant signup: a prospect with no account picks a plan and pays a
// recurring subscription via Mercado Pago Checkout Pro. The backend only creates the
// tenant + first admin user (in Zitadel) after the payment webhook confirms the
// subscription — see process-manager/internal/domain/signup. Until MERCADOPAGO_ACCESS_TOKEN
// is configured server-side, submitting here returns 501 (NOT_IMPLEMENTED).

const PLANS = [
    { id: 'basico', name: 'Básico', price: 'R$ 199/mês', description: 'Até 5 usuários, gestão de sinistros essencial.' },
    { id: 'pro', name: 'Pro', price: 'R$ 499/mês', description: 'Usuários ilimitados, compliance e auditoria completa.' },
];

export default function Signup() {
    const [companyName, setCompanyName] = useState('');
    const [adminFirstName, setAdminFirstName] = useState('');
    const [adminLastName, setAdminLastName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [planId, setPlanId] = useState(PLANS[0].id);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            const res = await startSignup({
                company_name: companyName,
                admin_email: adminEmail,
                admin_first_name: adminFirstName,
                admin_last_name: adminLastName,
                plan_id: planId,
            });
            // Once the payment API is live, checkout_url redirects to Mercado Pago Checkout
            // Pro; the payer returns to /signup/retorno?id=... afterwards regardless of outcome.
            if (res?.checkout_url) {
                window.location.href = res.checkout_url;
            } else {
                navigate(`/signup/retorno?id=${res.id}`);
            }
        } catch (err) {
            if (err instanceof HttpError && err.status === 501) {
                setError('Cadastro por assinatura ainda não está disponível — em breve.');
            } else {
                setError(err.message || 'Não foi possível iniciar o cadastro. Tente novamente.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans overflow-hidden">
            <div className="hidden md:flex md:w-1/2 bg-primary relative p-12 flex-col justify-between text-white overflow-hidden">
                <div className="absolute top-[-20%] right-[-20%] w-[80%] h-[80%] bg-white/5 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-secondary/10 blur-[100px] rounded-full" />

                <div className="relative z-10 flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/30">
                        <ShieldCheck size={24} />
                    </div>
                    <span className="text-xl font-display font-bold tracking-tight">Arquivo<span className="text-secondary-light">Seg</span></span>
                </div>

                <div className="relative z-10 space-y-6">
                    <h1 className="text-4xl font-bold font-display leading-tight">
                        Comece sua assinatura <br />
                        <span className="text-secondary-light text-3xl">em poucos minutos.</span>
                    </h1>
                    <p className="text-lg text-slate-300 max-w-md font-medium leading-relaxed">
                        Escolha um plano, confirme o pagamento e sua empresa já nasce com o primeiro usuário administrador pronto.
                    </p>
                </div>

                <div className="relative z-10 space-y-3">
                    {PLANS.map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-sm text-slate-300 font-medium">
                            <span>{p.name}</span>
                            <span className="font-bold text-white">{p.price}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center p-6 relative">
                <div className="w-full max-w-md space-y-8 animate-fade-in">
                    <div className="text-center md:text-left">
                        <h2 className="text-3xl font-bold text-gray-900 font-display">Criar minha empresa</h2>
                        <p className="text-gray-500 mt-2 font-medium">Assinatura recorrente via Mercado Pago — cartão, Pix ou boleto.</p>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm font-medium text-red-700">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <Field icon={Building2} label="Nome da Empresa" value={companyName} onChange={setCompanyName} placeholder="ex: Corretora Silva Ltda" />
                            <div className="grid grid-cols-2 gap-3">
                                <Field icon={User} label="Nome" value={adminFirstName} onChange={setAdminFirstName} placeholder="Maria" />
                                <Field icon={User} label="Sobrenome" value={adminLastName} onChange={setAdminLastName} placeholder="Silva" />
                            </div>
                            <Field icon={Mail} label="E-mail do Administrador" value={adminEmail} onChange={setAdminEmail} placeholder="maria@corretora.com.br" type="email" />

                            <div className="space-y-2">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Plano</span>
                                <div className="grid grid-cols-2 gap-3">
                                    {PLANS.map((p) => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => setPlanId(p.id)}
                                            className={`text-left p-4 rounded-2xl border-2 transition-all ${planId === p.id ? 'border-secondary bg-secondary/5' : 'border-gray-100 hover:border-gray-200'}`}
                                        >
                                            <p className="font-bold text-gray-900">{p.name}</p>
                                            <p className="text-secondary font-bold text-sm">{p.price}</p>
                                            <p className="text-xs text-gray-400 mt-1">{p.description}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full py-4 rounded-2xl font-bold text-white transition-all shadow-xl shadow-secondary/20 flex items-center justify-center gap-3 text-lg ${isLoading ? 'bg-secondary/40 cursor-wait' : 'bg-secondary hover:bg-secondary-hover hover:-translate-y-0.5'}`}
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    Redirecionando...
                                </>
                            ) : (
                                <>
                                    Ir para pagamento
                                    <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>

                    <footer className="pt-8 text-center border-t border-gray-100">
                        <p className="text-sm text-gray-400 font-medium">Já tem uma conta? <a href="/login" className="text-secondary font-bold hover:text-secondary-hover">Entrar</a></p>
                    </footer>
                </div>
            </div>
        </div>
    );
}

function Field({ icon: Icon, label, value, onChange, placeholder, type = 'text' }) {
    return (
        <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">{label}</label>
            <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-secondary transition-colors">
                    <Icon size={18} />
                </div>
                <input
                    type={type}
                    required
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-secondary/10 focus:border-secondary transition-all font-medium text-gray-900"
                />
            </div>
        </div>
    );
}

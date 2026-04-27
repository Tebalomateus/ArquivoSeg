import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Mail, Lock, ArrowRight, Github } from 'lucide-react';
import { useClaims } from '../context/ClaimsContext';
import { INITIAL_USERS } from '../constants/initialData';
import { loginWithUiRole } from '../api/auth';
import { isMockEnabled } from '../api/client';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { setCurrentUser } = useClaims();

    const handleLogin = (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        setTimeout(() => {
            const user = INITIAL_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());

            if (!user) {
                setError('Email não cadastrado. Use um dos perfis de INITIAL_USERS.');
                setIsLoading(false);
                return;
            }

            const { backRole, token } = loginWithUiRole(user.role);
            if (!isMockEnabled() && !token) {
                setError(`PAT não configurado para o papel ${user.role}. Verifique .env.local.`);
                setIsLoading(false);
                return;
            }

            setCurrentUser({ ...user, backRole });
            localStorage.setItem('arquivoseg_authenticated', 'true');
            navigate('/');
            setIsLoading(false);
        }, 600);
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans overflow-hidden">
            {/* Left Decoration Side (Marketing) */}
            <div className="hidden md:flex md:w-1/2 bg-primary relative p-12 flex-col justify-between text-white overflow-hidden">
                {/* Abstract Blobs */}
                <div className="absolute top-[-20%] right-[-20%] w-[80%] h-[80%] bg-white/5 blur-[120px] rounded-full animate-pulse"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-secondary/10 blur-[100px] rounded-full"></div>

                <div className="relative z-10 flex items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/30">
                            <ShieldCheck size={24} />
                        </div>
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-secondary-light rounded-full border-2 border-primary flex items-center justify-center text-[8px] font-black text-white">
                            ✓
                        </div>
                    </div>
                    <span className="text-xl font-display font-bold tracking-tight">Arquivo<span className="text-secondary-light">Seg</span></span>
                </div>

                <div className="relative z-10 space-y-6">
                    <h1 className="text-5xl font-bold font-display leading-tight">
                        Gestão de Documentos <br />
                        <span className="text-secondary-light text-4xl">para o Mercado de Seguros.</span>
                    </h1>
                    <p className="text-lg text-slate-300 max-w-md font-medium leading-relaxed">
                        Segurança e agilidade no processamento de sinistros com o novo padrão ArquivoSeg.
                    </p>
                </div>

                <div className="relative z-10 flex gap-12 mt-12 pb-8">
                    <div>
                        <p className="text-3xl font-bold font-display">1.2s</p>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-300">Análise Média</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold font-display">100%</p>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-300">Rastreabilidade</p>
                    </div>
                </div>
            </div>

            {/* Right Form Side */}
            <div className="flex-1 flex items-center justify-center p-6 relative">
                <div className="w-full max-w-md space-y-8 animate-fade-in">
                    <div className="text-center md:text-left">
                        <h2 className="text-3xl font-bold text-gray-900 font-display">Bem-vindo de volta</h2>
                        <p className="text-gray-500 mt-2 font-medium">Acesse sua conta para gerenciar sinistros.</p>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm font-medium text-red-700">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">E-mail Corporativo</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-secondary transition-colors">
                                        <Mail size={18} />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        placeholder="ex: contato@arquivoseg.com.br"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-secondary/10 focus:border-secondary transition-all font-medium text-gray-900"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Senha</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-secondary transition-colors">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-secondary/10 focus:border-secondary transition-all font-medium text-gray-900"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-secondary focus:ring-secondary" />
                                <span className="text-sm font-medium text-gray-600">Lembrar de mim</span>
                            </label>
                            <button type="button" className="text-sm font-bold text-secondary hover:text-secondary-hover">Esqueceu a senha?</button>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full py-4 rounded-2xl font-bold text-white transition-all shadow-xl shadow-secondary/20 flex items-center justify-center gap-3 text-lg ${isLoading ? 'bg-secondary/40 cursor-wait' : 'bg-secondary hover:bg-secondary-hover hover:-translate-y-0.5'}`}
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                    Entrando...
                                </>
                            ) : (
                                <>
                                    Acessar Painel
                                    <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>

                    <footer className="pt-8 text-center border-t border-gray-100 space-y-3">
                        <p className="text-sm text-gray-400 font-medium">Não tem acesso? Fale com nosso suporte.</p>
                        <div className="text-[10px] text-gray-400 font-mono leading-relaxed">
                            <p className="font-bold mb-1 text-gray-500 uppercase tracking-widest">Perfis de teste (dev)</p>
                            <p>sato@arquivoseg.com.br · admin</p>
                            <p>ricardo@corretora.com · corretor (manager)</p>
                            <p>ana.souza@allianz.com · perito (contributor)</p>
                            <p>analista@arquivoseg.com.br · analista (viewer)</p>
                        </div>
                    </footer>
                </div>
            </div>
        </div>
    );
}

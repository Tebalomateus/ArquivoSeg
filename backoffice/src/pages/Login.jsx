import { ShieldCheck } from 'lucide-react';
import { zitadel } from '../api/zitadel';

export default function Login() {
    const handleLogin = () => {
        if (zitadel) zitadel.authorize();
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-sm text-center space-y-6">
                <div className="flex justify-center">
                    <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center">
                        <ShieldCheck size={28} className="text-white" />
                    </div>
                </div>
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Backoffice</h1>
                    <p className="text-sm text-slate-500 mt-1">ArquivoSeg · Gestão de Checklists</p>
                </div>
                <button
                    onClick={handleLogin}
                    className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-700 transition-colors"
                >
                    Entrar com ArquivoSeg
                </button>
                {!zitadel && (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-3">
                        Configure VITE_ZITADEL_AUTHORITY e VITE_ZITADEL_CLIENT_ID para habilitar o login.
                    </p>
                )}
            </div>
        </div>
    );
}

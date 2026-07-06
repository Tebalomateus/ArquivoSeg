import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Callback from './pages/Callback';
import TenantsPage from './pages/TenantsPage';
import ChecklistsPage from './pages/ChecklistsPage';
import ChecklistEditorPage from './pages/ChecklistEditorPage';
import Guard from './components/Guard';
import { zitadel } from './api/zitadel';

function Unauthorized() {
    const handleSwitchAccount = () => {
        if (zitadel) {
            zitadel.signout();
        } else {
            window.location.href = '/login';
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-center">
            <div className="text-white space-y-3">
                <p className="text-4xl font-black">403</p>
                <p className="text-slate-400">Acesso negado. Apenas usuários com papel <strong>backoffice</strong> podem acessar este painel.</p>
                <button
                    onClick={handleSwitchAccount}
                    className="inline-block mt-4 text-sm underline text-slate-300 hover:text-white"
                >
                    Sair e entrar com outra conta
                </button>
            </div>
        </div>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/callback" element={<Callback />} />
                <Route path="/unauthorized" element={<Unauthorized />} />
                <Route path="/" element={<Guard><TenantsPage /></Guard>} />
                <Route path="/tenants/:tenantId/checklists" element={<Guard><ChecklistsPage /></Guard>} />
                <Route path="/tenants/:tenantId/checklists/:type" element={<Guard><ChecklistEditorPage /></Guard>} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import ClaimsList from './pages/ClaimsList';
import ClaimDetails from './pages/ClaimDetails';
import NewClaim from './pages/NewClaim';
import Settings from './pages/Settings';
import PublicShare from './pages/PublicShare';
import Login from './pages/Login';
import Callback from './pages/Callback';
import { useClaims } from './context/ClaimsContext';
import { usePermissions } from './context/PermissionsContext';
import { rememberDestination } from './api/auth';

import AdminLayout from './components/layout/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import PublicLinks from './pages/admin/PublicLinks';
import ClientManagement from './pages/admin/ClientManagement';
import AuditLog from './pages/admin/AuditLog';
import ComplianceDataCenter from './pages/admin/ComplianceDataCenter';
import AccessLayout from './pages/admin/access/AccessLayout';
import AccessUsers from './pages/admin/access/AccessUsers';
import AccessUserDetail from './pages/admin/access/AccessUserDetail';
import AccessRoles from './pages/admin/access/AccessRoles';
import AccessGroups from './pages/admin/access/AccessGroups';
import Notifications from './pages/Notifications';

/**
 * Enquanto a resposta não chega.
 *
 * Um portão que decide sem ela decide errado, e o preço é a pessoa ser expulsa
 * de uma página que ela pode ver — o que acontece a cada F5, porque `can()`
 * responde "não" antes de a API responder qualquer coisa.
 */
function Aguardando() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]" data-testid="rota-aguardando">
            <div className="w-8 h-8 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
        </div>
    );
}

/**
 * ProtectedRoute gates a route on being signed in and, optionally, on a
 * permission (requiredAction) or on being the tenant admin (requireAdmin).
 *
 * requireAdmin is deliberately not a permission: the backoffice area is where an
 * admin fixes a broken IAM configuration, so gating it on the IAM data it edits
 * is how a tenant locks itself out. Everything else uses can().
 */
function ProtectedRoute({ children, requiredAction, requireAdmin = false }) {
    const { currentUser } = useClaims();
    const { isAdmin, can, ready } = usePermissions();
    const location = useLocation();

    if (!currentUser) {
        // O state da rota não sobrevive ao login de verdade, que sai do app e
        // volta em /callback com a página recarregada — daí o sessionStorage.
        // O state fica porque o login mock não recarrega nada.
        rememberDestination(location.pathname + location.search);
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // isAdmin vem do token e já está aqui; can() depende da API.
    if (requiredAction && !ready) return <Aguardando />;

    const allowed = (!requireAdmin || isAdmin) && (!requiredAction || can(requiredAction));
    if (!allowed) {
        return <Navigate to={isAdmin ? '/admin' : '/app'} replace />;
    }

    return children;
}

// UI-only gate: the backend is the authority and answers 403 to whoever forces
// the route. This just keeps the form out of reach of someone who cannot submit it.
function RequireCreateAccess({ children }) {
    const { can, ready } = usePermissions();
    if (!ready) return <Aguardando />;
    // Relativo, e não "/app/sinistros": este formulário também é rota do
    // backoffice, e o caminho fixo jogava o admin para fora do portal dele.
    // "sinistros/novo" é um segmento de rota só, então ".." daria no portal.
    if (!can('processo.criar')) return <Navigate to="../sinistros" replace />;
    return children;
}

function App() {
    const { currentUser } = useClaims();
    const { isAdmin } = usePermissions();

    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/callback" element={<Callback />} />

            {/* BACKOFFICE / ADMIN PORTAL */}
            <Route
                path="/admin"
                element={
                    <ProtectedRoute requireAdmin>
                        <AdminLayout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<AdminDashboard />} />
                <Route path="sinistros" element={<ClaimsList />} />
                <Route path="sinistros/novo" element={<NewClaim />} />
                <Route path="sinistros/:id" element={<ClaimDetails />} />
                <Route path="clientes" element={<ClientManagement />} />
                <Route path="links" element={<PublicLinks />} />
                {/* Gestão de Usuários virou a aba Usuários de Acessos: era a mesma
                    lista de pessoas em duas telas. O redirect fica porque o caminho
                    antigo está em links salvos e em e-mails já enviados. */}
                <Route path="usuarios" element={<Navigate to="/admin/acessos/usuarios" replace />} />
                <Route path="acessos" element={<AccessLayout />}>
                    <Route path="usuarios" element={<AccessUsers />} />
                    <Route path="usuarios/:id" element={<AccessUserDetail />} />
                    <Route path="papeis" element={<AccessRoles />} />
                    <Route path="grupos" element={<AccessGroups />} />
                </Route>
                <Route path="configuracoes" element={<Settings />} />
                <Route path="compliance" element={<ComplianceDataCenter />} />
                <Route path="audit" element={<AuditLog />} />
                <Route path="notificacoes" element={<Notifications />} />
            </Route>

            {/* SAAS / CLIENT PORTAL */}
            <Route
                path="/app"
                element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<Dashboard />} />
                <Route path="sinistros" element={<ClaimsList />} />
                <Route path="sinistros/novo" element={<RequireCreateAccess><NewClaim /></RequireCreateAccess>} />
                <Route path="sinistros/:id" element={<ClaimDetails />} />
                <Route path="configuracoes" element={<Settings />} />
                <Route path="notificacoes" element={<Notifications />} />
            </Route>

            {/* SHARED & REDIRECTS */}
            <Route path="portal/:token" element={<PublicShare />} />
            <Route
                path="/"
                element={
                    currentUser
                        ? <Navigate to={isAdmin ? "/admin" : "/app"} replace />
                        : <Navigate to="/login" replace />
                }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default App;

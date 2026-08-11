import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import ClaimsList from './pages/ClaimsList';
import ClaimDetails from './pages/ClaimDetails';
import NewClaim from './pages/NewClaim';
import UserManagement from './pages/UserManagement';
import Settings from './pages/Settings';
import PublicShare from './pages/PublicShare';
import Login from './pages/Login';
import Callback from './pages/Callback';
import { useClaims } from './context/ClaimsContext';
import { usePermissions } from './context/PermissionsContext';

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
 * ProtectedRoute gates a route on being signed in and, optionally, on a
 * permission (requiredAction) or on being the tenant admin (requireAdmin).
 *
 * requireAdmin is deliberately not a permission: the backoffice area is where an
 * admin fixes a broken IAM configuration, so gating it on the IAM data it edits
 * is how a tenant locks itself out. Everything else uses can().
 */
function ProtectedRoute({ children, requiredAction, requireAdmin = false }) {
    const { currentUser } = useClaims();
    const { isAdmin, can } = usePermissions();
    const location = useLocation();

    if (!currentUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    const allowed = (!requireAdmin || isAdmin) && (!requiredAction || can(requiredAction));
    if (!allowed) {
        return <Navigate to={isAdmin ? '/admin' : '/app'} replace />;
    }

    return children;
}

// UI-only gate: the backend is the authority and answers 403 to whoever forces
// the route. This just keeps the form out of reach of someone who cannot submit it.
function RequireCreateAccess({ children }) {
    const { can } = usePermissions();
    if (!can('processo.criar')) return <Navigate to="/app/sinistros" replace />;
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
                <Route path="usuarios" element={<UserManagement />} />
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

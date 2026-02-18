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
import { useClaims } from './context/ClaimsContext';

import AdminLayout from './components/layout/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import LinkTracker from './pages/admin/LinkTracker';
import ClientManagement from './pages/admin/ClientManagement';

/**
 * Enhanced ProtectedRoute that supports role-based access control.
 */
function ProtectedRoute({ children, requiredRole }) {
    const { currentUser } = useClaims();
    const location = useLocation();

    if (!currentUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (requiredRole && currentUser.role !== requiredRole && currentUser.role !== 'ADMIN') {
        const redirectPath = currentUser.role === 'ADMIN' ? '/admin' : '/app';
        return <Navigate to={redirectPath} replace />;
    }

    return children;
}

function App() {
    const { currentUser } = useClaims();

    return (
        <Routes>
            <Route path="/login" element={<Login />} />

            {/* BACKOFFICE / ADMIN PORTAL */}
            <Route
                path="/admin"
                element={
                    <ProtectedRoute requiredRole="ADMIN">
                        <AdminLayout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<AdminDashboard />} />
                <Route path="sinistros" element={<ClaimsList />} />
                <Route path="clientes" element={<ClientManagement />} />
                <Route path="links" element={<LinkTracker />} />
                <Route path="usuarios" element={<UserManagement />} />
                <Route path="configuracoes" element={<Settings />} />
                <Route path="compliance" element={<div className="p-10 text-center font-bold text-slate-400">Compliance Center em breve...</div>} />
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
                <Route path="sinistros/novo" element={<NewClaim />} />
                <Route path="sinistros/:id" element={<ClaimDetails />} />
                <Route path="configuracoes" element={<Settings />} />
            </Route>

            {/* SHARED & REDIRECTS */}
            <Route path="portal/:token" element={<PublicShare />} />
            <Route
                path="/"
                element={
                    currentUser
                        ? <Navigate to={currentUser.role === 'ADMIN' ? "/admin" : "/app"} replace />
                        : <Navigate to="/login" replace />
                }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default App;

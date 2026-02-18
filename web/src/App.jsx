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

function ProtectedRoute({ children }) {
    const { currentUser } = useClaims();
    const location = useLocation();

    if (!currentUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
}

function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route
                path="/"
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
                <Route path="usuarios" element={<UserManagement />} />
                <Route path="configuracoes" element={<Settings />} />
            </Route>
            <Route path="portal/:token" element={<PublicShare />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default App;

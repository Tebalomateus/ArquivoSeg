import { Navigate } from 'react-router-dom';
import { getToken } from '../api/client';

export default function Guard({ children }) {
    const token = getToken();
    const role = sessionStorage.getItem('bo_role');

    if (!token || role !== 'backoffice') {
        return <Navigate to="/login" replace />;
    }

    return children;
}

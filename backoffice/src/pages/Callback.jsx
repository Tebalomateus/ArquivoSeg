import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { zitadel } from '../api/zitadel';
import { setToken } from '../api/client';

export default function Callback() {
    const navigate = useNavigate();

    useEffect(() => {
        if (!zitadel) {
            navigate('/login');
            return;
        }

        zitadel.userManager.signinCallback().then((oidcUser) => {
            if (!oidcUser) {
                navigate('/login');
                return;
            }

            const roles = oidcUser.profile['urn:zitadel:iam:org:projects:roles'] || {};
            const role = Object.keys(roles)[0] || '';

            if (role !== 'backoffice') {
                navigate('/unauthorized');
                return;
            }

            setToken(oidcUser.access_token);
            sessionStorage.setItem('bo_role', role);
            navigate('/');
        }).catch(() => {
            navigate('/login');
        });
    }, [navigate]);

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-slate-400">
                <div className="w-8 h-8 border-2 border-slate-600 border-t-white rounded-full animate-spin" />
                <p className="text-sm font-medium">Autenticando...</p>
            </div>
        </div>
    );
}

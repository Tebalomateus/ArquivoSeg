import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { zitadel } from '../api/zitadel';
import { uiRoleFor, logoutSession } from '../api/auth';
import { setToken } from '../api/client';
import { useClaims } from '../context/ClaimsContext';

export default function Callback() {
    const navigate = useNavigate();
    const { setCurrentUser } = useClaims();

    useEffect(() => {
        if (!zitadel) {
            navigate('/');
            return;
        }

        zitadel.userManager.signinCallback().then((oidcUser) => {
            if (!oidcUser) {
                navigate('/login');
                return;
            }

            const roles = oidcUser.profile['urn:zitadel:iam:org:project:roles'] || {};
            const backRole = Object.keys(roles)[0] || 'viewer';
            const uiRole = uiRoleFor(backRole);

            setToken(oidcUser.access_token);
            setCurrentUser({
                id: oidcUser.profile.sub,
                email: oidcUser.profile.email,
                name: oidcUser.profile.name || oidcUser.profile.email,
                role: uiRole,
                backRole,
            });
            navigate('/');
        }).catch(() => {
            logoutSession();
            navigate('/login');
        });
    }, [navigate, setCurrentUser]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
            <div className="flex flex-col items-center gap-4 text-slate-500">
                <div className="w-8 h-8 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
                <p className="text-sm font-medium">Autenticando…</p>
            </div>
        </div>
    );
}

import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { Users, KeyRound, Boxes, ShieldCheck } from 'lucide-react';

const TABS = [
    { to: 'usuarios', label: 'Usuários', icon: Users },
    { to: 'papeis', label: 'Papéis', icon: KeyRound },
    { to: 'grupos', label: 'Grupos', icon: Boxes },
];

/**
 * AccessLayout frames the tenant's access administration.
 *
 * It sits inside the /admin block, which is already gated on isAdmin — the
 * Zitadel role, not a permission. That is deliberate: this is the screen where a
 * broken IAM configuration gets fixed, so gating it on the data it edits is how
 * a tenant locks itself out of its own tenant.
 */
export default function AccessLayout() {
    const { pathname } = useLocation();

    // /admin/acessos on its own has nothing to show; the users tab is the entry
    // point the admin actually wants.
    if (pathname.replace(/\/$/, '').endsWith('/acessos')) {
        return <Navigate to="usuarios" replace />;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-3xl font-black text-slate-900 font-display tracking-tight flex items-center gap-3">
                    <ShieldCheck size={30} className="text-blue-600" />
                    Acessos
                </h1>
                <p className="text-sm text-slate-500 font-medium mt-1">
                    Quem pode o quê neste tenant. Papéis agrupam permissões, grupos emprestam papéis a
                    várias pessoas, e permissões individuais são a exceção pontual.
                </p>
            </div>

            <div className="flex items-center gap-2 border-b border-slate-200">
                {TABS.map(({ to, label, icon: Icon }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                            `flex items-center gap-2 px-4 py-3 text-xs font-black uppercase tracking-widest border-b-2 -mb-px transition-all ${
                                isActive
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`
                        }
                    >
                        <Icon size={16} />
                        {label}
                    </NavLink>
                ))}
            </div>

            <Outlet />
        </div>
    );
}

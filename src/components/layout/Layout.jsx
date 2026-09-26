import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import {
    BarChart3,
    FileText,
    LogOut,
    ShieldCheck,
    ChevronDown,
    KeyRound,
    Check,
} from 'lucide-react';
import { useClaims } from '../../context/ClaimsContext';
import NotificationBell from '../NotificationBell';

// Uma aba do cabeçalho. Abaixo de `sm` o rótulo vira só o ícone: a 360px as
// duas abas, a marca e o perfil não cabem lado a lado por extenso. O rótulo
// continua como nome acessível pelo aria-label.
const HeaderTab = ({ to, icon: Icon, label, end = false }) => (
    <NavLink
        to={to}
        end={end}
        aria-label={label}
        className={({ isActive }) => `
      relative h-full flex items-center gap-2 px-2 sm:px-3 text-sm transition-colors
      ${isActive
                ? 'font-bold text-primary after:absolute after:left-0 after:right-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-secondary'
                : 'font-semibold text-slate-500 hover:text-primary'}
    `}
    >
        <Icon size={18} className="sm:hidden" />
        <span className="hidden sm:inline">{label}</span>
    </NavLink>
);

/**
 * O que sobrou de "Configurações Globais": quem sou eu, e onde se troca a senha.
 *
 * E-mail e senha vivem no Zitadel, então a única ação real aqui é lembrar que a
 * troca acontece pelo "Esqueceu a senha?" da tela de login.
 */
const MENU_WIDTH = 288; // w-72
const MENU_MARGIN = 8; // keep the menu on-screen at narrow widths

const ProfileMenu = ({ user, onLogout }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const panelRef = useRef(null);
    // Menu position in viewport coords: the panel is portaled to <body>, like
    // NotificationBell's, because the header's backdrop-filter stacking context
    // sits under the page's own z-10 blocks and they would paint over it.
    const [pos, setPos] = useState({ top: 0, left: 0 });

    // close on outside click / Escape — "inside" is the trigger or the portaled panel
    useEffect(() => {
        if (!open) return;
        const onClick = (e) => {
            const inTrigger = ref.current?.contains(e.target);
            const inPanel = panelRef.current?.contains(e.target);
            if (!inTrigger && !inPanel) setOpen(false);
        };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    // anchor the fixed panel under the trigger's right edge; follow resize/scroll
    useEffect(() => {
        if (!open) return;
        const place = () => {
            const rect = ref.current?.getBoundingClientRect();
            if (!rect) return;
            const width = Math.min(MENU_WIDTH, window.innerWidth - 2 * MENU_MARGIN);
            const left = Math.min(Math.max(MENU_MARGIN, rect.right - width), window.innerWidth - MENU_MARGIN - width);
            setPos({ top: rect.bottom + 8, left, width });
        };
        place();
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => {
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
        };
    }, [open]);

    const initials = user?.name?.split(' ').map(n => n[0]).join('');

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Meu perfil"
                data-testid="profile-menu-trigger"
                className="flex items-center gap-2.5 rounded-xl pl-1 pr-2 py-1 transition-all hover:bg-white"
            >
                <div className="text-right leading-tight hidden md:block">
                    <p className="text-sm font-bold text-primary">{user?.name}</p>
                    <p className="text-[9px] font-black tracking-widest text-slate-400 uppercase">{user?.role}</p>
                </div>
                <div className="w-9 h-9 bg-primary text-white rounded-xl flex items-center justify-center text-xs font-black">
                    {initials}
                </div>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && createPortal(
                <div
                    ref={panelRef}
                    role="menu"
                    data-testid="profile-menu"
                    style={{ top: pos.top, left: pos.left, width: pos.width || MENU_WIDTH }}
                    className="fixed w-72 max-w-[calc(100vw-16px)] bg-white rounded-2xl border border-slate-100 shadow-2xl z-50 overflow-hidden animate-fade-in"
                >
                    <div className="p-5 flex items-center gap-4 border-b border-slate-100">
                        <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center font-black text-secondary">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">{user?.name}</p>
                            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                            <span className="inline-block mt-1.5 px-2 py-0.5 rounded-lg bg-secondary/10 text-secondary text-[10px] font-black uppercase tracking-widest">
                                {user?.role}
                            </span>
                        </div>
                    </div>
                    <div className="px-5 py-3 flex items-start gap-2 text-[11px] text-slate-500 border-b border-slate-100">
                        <KeyRound size={14} className="shrink-0 mt-0.5 text-slate-400" />
                        <span>E-mail e senha são geridos pelo Zitadel: para trocar, use "Esqueceu a senha?" na tela de login.</span>
                    </div>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-5 py-3 text-sm font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all"
                    >
                        <LogOut size={16} />
                        Sair
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
};

export default function Layout() {
    const { currentUser, logout } = useClaims();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 relative overflow-x-hidden">
            {/* Decorative Blobs */}
            <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none z-0"></div>
            <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/10 rounded-full blur-[150px] pointer-events-none z-0"></div>

            {/* Um cabeçalho só: as abas à esquerda, a marca no centro (que leva ao
                dashboard) e sino + perfil à direita. O "Sair" mora no menu do perfil. */}
            <header className="sticky top-0 z-40 h-16 bg-white/70 backdrop-blur-xl border-b border-white/40 shadow-[0_1px_0_rgba(26,43,83,.06)]">
                <div className="max-w-7xl mx-auto h-full px-3 sm:px-8 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <nav className="flex items-center gap-1 h-full min-w-0" aria-label="Navegação principal">
                        <HeaderTab to="/app" end icon={BarChart3} label="Dashboard" />
                        <HeaderTab to="/app/sinistros" icon={FileText} label="Meus Sinistros" />
                    </nav>

                    <Link to="/app" className="flex items-center gap-2.5 justify-self-center" title="Ir para o dashboard" aria-label="ArquivoSeg — ir para o dashboard">
                        <div className="relative w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                            <ShieldCheck size={20} />
                            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-secondary-light border-2 border-white text-white flex items-center justify-center">
                                <Check size={8} strokeWidth={4} />
                            </span>
                        </div>
                        <div className="leading-none hidden min-[400px]:block">
                            <div className="font-display text-lg font-extrabold tracking-tight"><span className="text-primary">Arquivo</span><span className="text-secondary">Seg</span></div>
                            <div className="text-[7px] font-black tracking-[.22em] text-slate-400 uppercase mt-0.5 hidden sm:block">Gestão de Documentos</div>
                        </div>
                    </Link>

                    <div className="flex items-center justify-end gap-2 sm:gap-3 min-w-0">
                        <NotificationBell basePath="/app" />
                        <div className="w-px h-7 bg-slate-200 hidden sm:block"></div>
                        <ProfileMenu user={currentUser} onLogout={handleLogout} />
                    </div>
                </div>
            </header>

            <main className="relative z-10 max-w-7xl mx-auto px-4 py-6 sm:p-8">
                <Outlet />
            </main>
        </div>
    );
}

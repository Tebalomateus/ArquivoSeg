import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import {
    BarChart3,
    FileText,
    Users,
    Menu,
    X,
    PlusCircle,
    Clock,
    LogOut,
    ShieldCheck,
    ChevronDown,
    KeyRound
} from 'lucide-react';
import { useClaims } from '../../context/ClaimsContext';
import NotificationBell from '../NotificationBell';

const SidebarItem = ({ to, icon: Icon, label, isOpen, end = false }) => (
    <NavLink
        to={to}
        end={end}
        className={({ isActive }) => `
      flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 font-bold text-sm
      ${isActive
                ? 'bg-secondary text-white shadow-xl shadow-secondary/20 translate-x-1'
                : 'text-slate-400 hover:text-secondary hover:bg-white hover:translate-x-1 border border-transparent hover:border-secondary/10'}
    `}
    >
        <Icon size={20} />
        {isOpen && <span>{label}</span>}
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
                className="flex items-center gap-4 rounded-2xl p-1 -m-1 transition-all hover:bg-white/60"
            >
                <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-slate-900 leading-none">{user?.name}</p>
                    <p className="text-[11px] font-bold text-secondary uppercase tracking-widest mt-1">{user?.role}</p>
                </div>
                <div className="w-10 h-10 bg-white border-2 border-white shadow-lg rounded-2xl flex items-center justify-center font-bold text-secondary text-sm">
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
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const { currentUser, logout } = useClaims();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-900 overflow-hidden relative">
            {/* Decorative Blobs */}
            <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none z-0"></div>
            <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/10 rounded-full blur-[150px] pointer-events-none z-0"></div>

            {/* Sidebar */}
            <aside
                className={`
          ${isSidebarOpen ? 'w-72' : 'w-20'} 
          bg-white/70 backdrop-blur-xl border-r border-white/40 transition-all duration-300 flex flex-col
          z-20 shadow-2xl shadow-blue-900/5
        `}
            >
                <div className="p-8 flex items-center justify-between">
                    {isSidebarOpen && (
                        <Link to="/" className="text-xl font-bold flex items-center gap-2">
                            <div className="relative">
                                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                                    <ShieldCheck size={24} />
                                </div>
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-secondary-light rounded-full border-2 border-white flex items-center justify-center text-[8px] font-black text-white">
                                    ✓
                                </div>
                            </div>
                            <div className="flex flex-col leading-none">
                                <span className="font-display font-bold tracking-tight text-primary">Arquivo<span className="text-secondary">Seg</span></span>
                                <span className="text-[7px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Gestão de Documentos</span>
                            </div>
                        </Link>
                    )}
                    {!isSidebarOpen && (
                        <div className="mx-auto relative">
                            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                                <ShieldCheck size={24} />
                            </div>
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-secondary-light rounded-full border-2 border-white flex items-center justify-center text-[8px] font-black text-white">
                                ✓
                            </div>
                        </div>
                    )}
                </div>

                <nav className="flex-1 px-4 py-4 space-y-2">
                    <SidebarItem to="/app" end icon={BarChart3} label="Dashboard" isOpen={isSidebarOpen} />
                    <SidebarItem to="/app/sinistros" icon={FileText} label="Meus Sinistros" isOpen={isSidebarOpen} />
                </nav>

                <div className="p-6 border-t border-white/40">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all font-bold text-sm"
                    >
                        <LogOut size={20} />
                        {isSidebarOpen && "Sair do Sistema"}
                    </button>
                    <button
                        onClick={() => setSidebarOpen(!isSidebarOpen)}
                        className="mt-4 w-full flex items-center justify-center p-2 text-slate-300 hover:text-secondary transition-all"
                    >
                        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 z-10 relative overflow-hidden">
                {/* Header */}
                <header className="h-20 bg-white/40 backdrop-blur-md border-b border-white/20 flex items-center justify-between px-10">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-bold text-slate-800 font-display">
                            Bem-vindo, {currentUser?.name?.split(' ')[0]}!
                        </h2>
                    </div>

                    <div className="flex items-center gap-6">
                        <NotificationBell basePath="/app" />
                        <div className="h-8 w-[1px] bg-slate-200"></div>
                        <ProfileMenu user={currentUser} onLogout={handleLogout} />
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-10">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

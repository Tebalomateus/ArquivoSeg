import { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import {
    BarChart3,
    FileText,
    Users,
    Settings,
    Menu,
    X,
    PlusCircle,
    Clock,
    LogOut,
    ShieldCheck
} from 'lucide-react';
import { useClaims } from '../../context/ClaimsContext';
import NotificationBell from '../NotificationBell';

const SidebarItem = ({ to, icon: Icon, label, isOpen }) => (
    <NavLink
        to={to}
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
                    <SidebarItem to="/app" icon={BarChart3} label="Dashboard" isOpen={isSidebarOpen} />
                    <SidebarItem to="/app/sinistros" icon={FileText} label="Meus Sinistros" isOpen={isSidebarOpen} />
                    <SidebarItem to="/app/configuracoes" icon={Settings} label="Configurações" isOpen={isSidebarOpen} />
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
                        <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold text-slate-900 leading-none">{currentUser?.name}</p>
                                <p className="text-[11px] font-bold text-secondary uppercase tracking-widest mt-1">{currentUser?.role}</p>
                            </div>
                            <div className="w-10 h-10 bg-white border-2 border-white shadow-lg rounded-2xl flex items-center justify-center font-bold text-secondary text-sm">
                                {currentUser?.name?.split(' ').map(n => n[0]).join('')}
                            </div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-10">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    Settings as SettingsIcon,
    LogOut,
    ShieldCheck,
    Search,
    FileCheck2,
    Database,
    Link as LinkIcon,
    Building2,
    History
} from 'lucide-react';
import { useClaims } from '../../context/ClaimsContext';
import NotificationBell from '../NotificationBell';

/**
 * AdminLayout - The structural frame for the Backoffice/Administration area.
 * Features a distinct sidebar and specialized administrative tools.
 */
export default function AdminLayout() {
    const { currentUser, logout } = useClaims();
    const navigate = useNavigate();
    const location = useLocation();

    const menuItems = [
        { icon: LayoutDashboard, label: 'Painel Global', path: '/admin' },
        { icon: FileCheck2, label: 'Auditoria de Sinistros', path: '/admin/sinistros' },
        { icon: Building2, label: 'Gestão de Clientes', path: '/admin/clientes' },
        { icon: LinkIcon, label: 'Rastreamento de Links', path: '/admin/links' },
        { icon: Users, label: 'Gestão de Usuários', path: '/admin/usuarios' },
        { icon: History, label: 'Auditoria Global', path: '/admin/audit' },
        { icon: Database, label: 'Compliance Data Center', path: '/admin/compliance' },
        { icon: SettingsIcon, label: 'Configurações do Sistema', path: '/admin/configuracoes' },
    ];

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-inter">
            {/* Sidebar Admin */}
            <aside className="w-72 bg-[#1e293b] text-white flex flex-col shadow-2xl z-20">
                <div className="p-8 border-b border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <h1 className="font-black text-lg tracking-tighter uppercase">ArquivoSeg</h1>
                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mt-0.5">Backoffice Admin</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
                    {menuItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-5 py-3.5 rounded-xl transition-all duration-300 group ${(item.path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(item.path))
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 translate-x-1'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            <item.icon size={20} className="group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-bold uppercase tracking-wider">{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="p-6 border-t border-slate-700/50 space-y-4">
                    <div className="bg-slate-800/50 p-4 rounded-2xl flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-xs font-bold">
                            {currentUser?.name?.charAt(0)}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-xs font-bold truncate">{currentUser?.name}</span>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{currentUser?.role}</span>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-between px-5 py-3.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all group font-bold text-xs uppercase tracking-widest"
                    >
                        Sair do Portal
                        <LogOut size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col relative overflow-hidden">
                {/* Admin Top Header */}
                <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 z-10">
                    <div className="relative w-96 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Pesquisa global no banco de dados..."
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-12 pr-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-200 transition-all"
                        />
                    </div>

                    <div className="flex items-center gap-6">
                        <NotificationBell basePath="/admin" />
                        <div className="h-8 w-px bg-slate-100"></div>
                        <div className="flex flex-col text-right">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sessão Segura</span>
                            <span className="text-xs font-bold text-slate-700">AES-256 Active</span>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-10 bg-[#f8fafc]">
                    <div className="max-w-[1600px] mx-auto animate-fade-in">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
}

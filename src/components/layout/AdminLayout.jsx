import { useState, useMemo, useRef, useEffect } from 'react';
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
    History,
    FileText,
} from 'lucide-react';
import { useClaims } from '../../context/ClaimsContext';
import NotificationBell from '../NotificationBell';

/**
 * AdminLayout - The structural frame for the Backoffice/Administration area.
 * Features a distinct sidebar and specialized administrative tools.
 */
export default function AdminLayout() {
    const { currentUser, logout, claims, backendUsers, clients } = useClaims();
    const navigate = useNavigate();
    const location = useLocation();
    const [search, setSearch] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const searchRef = useRef(null);

    useEffect(() => {
        if (!searchOpen) return;
        const onClick = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false); };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [searchOpen]);

    // Busca local nos arrays já carregados pelo contexto. Match por substring
    // case-insensitive em campos relevantes de cada entidade.
    const searchResults = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (q.length < 2) return null;
        const matches = [];
        for (const c of claims) {
            const hay = `${c.title || ''} ${c.number || ''} ${c.insurer || ''} ${c.description || ''}`.toLowerCase();
            if (hay.includes(q)) matches.push({ kind: 'sinistro', icon: FileText, label: c.title || c.number, sub: `#${c.number || c.id?.slice(0, 8)} · ${c.insurer || ''}`, to: `/admin/sinistros/${c.id}` });
        }
        for (const cl of clients) {
            const hay = `${cl.name || ''} ${cl.contact || ''} ${cl.type || ''}`.toLowerCase();
            if (hay.includes(q)) matches.push({ kind: 'cliente', icon: Building2, label: cl.name, sub: `${cl.type} · ${cl.contact || '—'}`, to: `/admin/clientes` });
        }
        for (const u of backendUsers) {
            const hay = `${u.email || ''} ${u.role || ''}`.toLowerCase();
            if (hay.includes(q)) matches.push({ kind: 'usuário', icon: Users, label: u.email, sub: `${u.role}`, to: `/admin/audit?actor_user_id=${u.id}` });
        }
        return matches.slice(0, 12);
    }, [search, claims, clients, backendUsers]);

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

    const handlePick = (item) => {
        setSearch('');
        setSearchOpen(false);
        navigate(item.to);
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
                    <div className="relative w-96 group" ref={searchRef}>
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
                            onFocus={() => setSearchOpen(true)}
                            placeholder="Buscar sinistros, clientes ou usuários…"
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-12 pr-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-200 transition-all"
                        />
                        {searchOpen && search.trim().length >= 2 && (
                            <div className="absolute left-0 right-0 mt-2 bg-white rounded-xl border border-slate-100 shadow-2xl z-30 max-h-96 overflow-y-auto">
                                {!searchResults || searchResults.length === 0 ? (
                                    <p className="text-xs text-slate-400 text-center py-6 uppercase tracking-widest font-bold">Nenhum resultado.</p>
                                ) : (
                                    searchResults.map((r, i) => (
                                        <button
                                            key={`${r.kind}-${i}`}
                                            type="button"
                                            onClick={() => handlePick(r)}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-50 last:border-b-0 transition-colors"
                                        >
                                            <div className="shrink-0 w-8 h-8 bg-slate-100 text-slate-500 rounded-lg flex items-center justify-center">
                                                <r.icon size={14} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold text-slate-800 truncate">{r.label}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{r.kind} · {r.sub}</p>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
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

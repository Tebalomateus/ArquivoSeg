import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Shield, Mail, MoreHorizontal, Building2, Search, ArrowLeft, Activity, Copy, ExternalLink, RefreshCw, UserX, KeyRound } from 'lucide-react';
import { useClaims } from '../context/ClaimsContext';
import { usePermissions } from '../context/PermissionsContext';
import { listRoles } from '../api/iam';
import { isMockEnabled } from '../api/client';

// users.role is the account type, not a permission: `admin` or `user`. What a
// person can actually do lives in the IAM roles, edited in /admin/acessos.
const ACCOUNT_ROLE_LABEL = { admin: 'ADMIN', user: 'USUÁRIO' };

const adaptBackendUser = (u) => ({
    id: u.id,
    name: u.email?.split('@')[0] || 'Usuário',
    email: u.email,
    company: u.email?.split('@')[1] || '-',
    role: ACCOUNT_ROLE_LABEL[u.role] || String(u.role || '').toUpperCase(),
    isAdmin: u.role === 'admin',
    status: u.status || 'active',
    zitadelSub: u.zitadel_sub,
    createdAt: u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : null,
});

const STATUS_CONFIG = {
    active:   { label: 'Ativo',     dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700 ring-green-100' },
    invited:  { label: 'Convidado', dot: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-700 ring-amber-100' },
    inactive: { label: 'Inativo',   dot: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-500 ring-gray-100' },
};

export default function UserManagement() {
    const { currentUser, backendUsers, usersLoading, refreshUsers, inviteUser, deactivateUser, resendInvite } = useClaims();
    const navigate = useNavigate();
    // Deliberately isAdmin and not can('usuario.listar'): this is the screen
    // where a broken IAM configuration gets fixed, so it must not be gated by
    // the data it edits. Same anti-lockout reasoning as ProtectedRoute.
    const { isAdmin } = usePermissions();

    const [searchTerm, setSearchTerm] = useState('');
    const [openMenuId, setOpenMenuId] = useState(null);
    const menuRef = useRef(null);

    // Invite modal state
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteForm, setInviteForm] = useState({ email: '', first_name: '', last_name: '', role_ids: [] });
    const [inviteError, setInviteError] = useState('');
    const [inviteSubmitting, setInviteSubmitting] = useState(false);

    // The tenant's own IAM roles: what the invite offers and what the cards
    // describe. There is no fixed catalog to hardcode any more.
    const [roles, setRoles] = useState([]);
    const [rolesError, setRolesError] = useState('');

    // Action feedback
    const [actionMsg, setActionMsg] = useState(null); // { type: 'success'|'error', text }

    useEffect(() => {
        if (!openMenuId) return;
        const onClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null); };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [openMenuId]);

    useEffect(() => {
        if (!isAdmin || isMockEnabled()) return;
        let alive = true;
        listRoles()
            .then((res) => { if (alive) setRoles(res?.data || []); })
            .catch((err) => {
                if (alive) setRolesError(err?.body?.error?.message || 'Não foi possível carregar os papéis.');
            });
        return () => { alive = false; };
    }, [isAdmin]);

    useEffect(() => {
        if (!actionMsg) return;
        const t = setTimeout(() => setActionMsg(null), 4000);
        return () => clearTimeout(t);
    }, [actionMsg]);

    const copyUuid = (uuid) => {
        navigator.clipboard.writeText(uuid);
        setOpenMenuId(null);
    };

    const goToActivity = (uuid) => {
        setOpenMenuId(null);
        navigate(`/admin/audit?actor_user_id=${uuid}`);
    };

    const displayUsers = (backendUsers || []).map(adaptBackendUser);
    const filteredUsers = displayUsers.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.company.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // ── Invite ─────────────────────────────────────────────────────────────
    const openInvite = () => {
        setInviteForm({ email: '', first_name: '', last_name: '', role_ids: [] });
        setInviteError('');
        setInviteOpen(true);
    };

    const toggleInviteRole = (id) => setInviteForm((f) => ({
        ...f,
        role_ids: f.role_ids.includes(id) ? f.role_ids.filter((r) => r !== id) : [...f.role_ids, id],
    }));

    const handleInviteSubmit = async (e) => {
        e.preventDefault();
        if (!inviteForm.email) { setInviteError('Email é obrigatório.'); return; }
        setInviteSubmitting(true);
        setInviteError('');
        try {
            await inviteUser(inviteForm);
            setInviteOpen(false);
            setActionMsg({ type: 'success', text: `Convite enviado para ${inviteForm.email}.` });
        } catch (err) {
            setInviteError(err?.body?.error?.message || err?.message || 'Erro ao convidar usuário.');
        } finally {
            setInviteSubmitting(false);
        }
    };

    // ── Deactivate ──────────────────────────────────────────────────────────
    const handleDeactivate = async (user) => {
        setOpenMenuId(null);
        if (!window.confirm(`Desativar a conta de ${user.email}? O usuário perderá acesso imediatamente.`)) return;
        try {
            await deactivateUser(user.id);
            setActionMsg({ type: 'success', text: `Conta de ${user.email} desativada.` });
        } catch (err) {
            setActionMsg({ type: 'error', text: err?.body?.error?.message || err?.message || 'Erro ao desativar.' });
        }
    };

    // ── Resend invite / account recovery ────────────────────────────────────
    const handleResendInvite = async (user) => {
        setOpenMenuId(null);
        try {
            await resendInvite(user.id);
            setActionMsg({ type: 'success', text: `Email de acesso reenviado para ${user.email}.` });
        } catch (err) {
            setActionMsg({ type: 'error', text: err?.body?.error?.message || err?.message || 'Erro ao reenviar.' });
        }
    };

    return (
        <div className="space-y-8 animate-fade-in relative z-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <Link to="/" className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400 hover:text-blue-600 transition-all mb-2 tracking-widest">
                        <ArrowLeft size={16} />
                        Voltar ao Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900 font-display">Gestão de Usuários</h1>
                    <p className="text-gray-500 font-medium">
                        Contas da conta corporativa. Permissões são definidas em{' '}
                        <Link to="/admin/acessos/papeis" className="font-bold text-blue-600 hover:underline">Acessos</Link>.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {usersLoading && <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Carregando...</span>}
                    <button onClick={() => refreshUsers?.()} className="bg-white text-gray-600 px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold uppercase tracking-wider hover:bg-gray-50">
                        Atualizar
                    </button>
                    {isAdmin && (
                        <button
                            onClick={openInvite}
                            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            <UserPlus size={20} />
                            Convidar Usuário
                        </button>
                    )}
                </div>
            </div>

            {/* Action feedback toast */}
            {actionMsg && (
                <div className={`px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 ${actionMsg.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                    {actionMsg.text}
                </div>
            )}

            {/* The tenant's roles, as they actually exist */}
            {roles.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {roles.map((role) => (
                        <Link
                            key={role.id}
                            to="/admin/acessos/papeis"
                            className="p-4 rounded-2xl border-2 border-slate-200 bg-slate-50 text-slate-700 h-full flex flex-col shadow-sm transition-all hover:scale-[1.02] hover:border-blue-200"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Shield size={14} />
                                <h4 className="font-bold text-[10px] uppercase tracking-tighter">{role.name}</h4>
                            </div>
                            <p className="text-[10px] opacity-80 leading-relaxed font-bold">
                                {role.description || `${role.permissions?.length ?? 0} permissões`}
                            </p>
                        </Link>
                    ))}
                </div>
            )}
            {rolesError && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">{rolesError}</p>
            )}

            {/* Users table */}
            <div className="card">
                <div className="flex flex-col md:flex-row gap-4 mb-8">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar por nome, email ou empresa..."
                            className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-300 transition-all font-bold text-sm shadow-inner"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left border-b border-gray-100">
                                <th className="pb-5 font-bold text-gray-400 text-[10px] uppercase tracking-widest pl-2">Usuário</th>
                                <th className="pb-5 font-bold text-gray-400 text-[10px] uppercase tracking-widest">Empresa</th>
                                <th className="pb-5 font-bold text-gray-400 text-[10px] uppercase tracking-widest">Conta</th>
                                <th className="pb-5 font-bold text-gray-400 text-[10px] uppercase tracking-widest">Status</th>
                                <th className="pb-5 text-right pr-2"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredUsers.map((user) => {
                                const statusCfg = STATUS_CONFIG[user.status] || STATUS_CONFIG.active;
                                return (
                                    <tr key={user.id} className="hover:bg-blue-50/30 transition-all group">
                                        <td className="py-5 pl-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white border border-gray-100 text-blue-600 rounded-full flex items-center justify-center font-black text-xs shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">
                                                    {user.name.split(' ').map(n => n[0]).join('')}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900 text-sm tracking-tight">{user.name}</p>
                                                    <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                                                        <Mail size={10} /> {user.email}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-5">
                                            <div className="flex items-center gap-2 text-xs font-bold text-gray-600 bg-white border border-gray-100 w-fit px-3 py-1 rounded-lg shadow-sm">
                                                <Building2 size={12} className="text-blue-500" />
                                                {user.company}
                                            </div>
                                        </td>
                                        <td className="py-5">
                                            <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${user.isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {user.role}
                                            </span>
                                            <Link
                                                to={`/admin/acessos/usuarios/${user.id}`}
                                                className="block text-[9px] font-bold uppercase tracking-widest text-gray-400 hover:text-blue-600 mt-1"
                                            >
                                                Ver permissões
                                            </Link>
                                        </td>
                                        <td className="py-5">
                                            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full w-fit ring-4 ${statusCfg.badge}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`}></div>
                                                <span className="text-[9px] font-black uppercase tracking-widest">{statusCfg.label}</span>
                                            </div>
                                            {user.createdAt && (
                                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                                                    desde {user.createdAt}
                                                </p>
                                            )}
                                        </td>
                                        <td className="py-5 text-right pr-2">
                                            <div className="relative inline-block" ref={openMenuId === user.id ? menuRef : null}>
                                                <button
                                                    type="button"
                                                    onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100 shadow-sm"
                                                >
                                                    <MoreHorizontal size={20} />
                                                </button>
                                                {openMenuId === user.id && (
                                                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-100 shadow-2xl z-30 overflow-hidden animate-fade-in">
                                                        <button
                                                            type="button"
                                                            onClick={() => goToActivity(user.id)}
                                                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                                                        >
                                                            <Activity size={14} className="text-blue-600" />
                                                            <span className="text-xs font-bold text-slate-700">Ver atividade</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => copyUuid(user.id)}
                                                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors border-t border-slate-50"
                                                        >
                                                            <Copy size={14} className="text-slate-500" />
                                                            <span className="text-xs font-bold text-slate-700">Copiar UUID</span>
                                                        </button>
                                                        {isAdmin && (
                                                            <>
                                                                <Link
                                                                    to={`/admin/acessos/usuarios/${user.id}`}
                                                                    onClick={() => setOpenMenuId(null)}
                                                                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors border-t border-slate-50"
                                                                >
                                                                    <KeyRound size={14} className="text-blue-500" />
                                                                    <span className="text-xs font-bold text-slate-700">Gerenciar acessos</span>
                                                                </Link>
                                                                {(user.status === 'invited' || user.status === 'inactive') && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleResendInvite(user)}
                                                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors border-t border-slate-50"
                                                                    >
                                                                        <RefreshCw size={14} className="text-amber-500" />
                                                                        <span className="text-xs font-bold text-slate-700">Reenviar convite</span>
                                                                    </button>
                                                                )}
                                                                {user.status === 'active' && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleResendInvite(user)}
                                                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors border-t border-slate-50"
                                                                    >
                                                                        <RefreshCw size={14} className="text-green-500" />
                                                                        <span className="text-xs font-bold text-slate-700">Recuperar acesso</span>
                                                                    </button>
                                                                )}
                                                                {user.status !== 'inactive' && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDeactivate(user)}
                                                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-50 transition-colors border-t border-slate-50"
                                                                    >
                                                                        <UserX size={14} className="text-red-500" />
                                                                        <span className="text-xs font-bold text-red-600">Desativar conta</span>
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                        <a
                                                            href="http://localhost:8081"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={() => setOpenMenuId(null)}
                                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-t border-slate-50"
                                                        >
                                                            <ExternalLink size={14} className="text-slate-500" />
                                                            <span className="text-xs font-bold text-slate-700">Editar no Zitadel</span>
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-gray-400 font-bold text-sm">
                                        Nenhum usuário encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Invite modal */}
            {inviteOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setInviteOpen(false)}>
                    <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-gray-900 mb-6">Convidar Usuário</h3>
                        {inviteError && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-700">{inviteError}</div>
                        )}
                        <form onSubmit={handleInviteSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Email *</label>
                                <input
                                    type="email"
                                    value={inviteForm.email}
                                    onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-300"
                                    placeholder="nome@empresa.com"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Primeiro Nome</label>
                                    <input
                                        type="text"
                                        value={inviteForm.first_name}
                                        onChange={e => setInviteForm(f => ({ ...f, first_name: e.target.value }))}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-300"
                                        placeholder="Ana"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Último Nome</label>
                                    <input
                                        type="text"
                                        value={inviteForm.last_name}
                                        onChange={e => setInviteForm(f => ({ ...f, last_name: e.target.value }))}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-300"
                                        placeholder="Silva"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Papéis</label>
                                <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-50">
                                    {roles.map((role) => (
                                        <label key={role.id} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50">
                                            <input
                                                type="checkbox"
                                                checked={inviteForm.role_ids.includes(role.id)}
                                                onChange={() => toggleInviteRole(role.id)}
                                                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span>
                                                <span className="block text-sm font-bold text-gray-900">{role.name}</span>
                                                {role.description && (
                                                    <span className="block text-[10px] text-gray-400 font-bold">{role.description}</span>
                                                )}
                                            </span>
                                        </label>
                                    ))}
                                    {roles.length === 0 && (
                                        <p className="px-4 py-3 text-[10px] font-bold text-gray-400">
                                            Nenhum papel cadastrado. Crie um em Acessos › Papéis.
                                        </p>
                                    )}
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-400 font-bold leading-relaxed">
                                O usuário receberá um email com um link para definir sua senha e registrar autenticação de dois fatores.
                                Sem nenhum papel, a conta entra sem acesso a nada — os papéis podem ser ajustados depois em Acessos.
                            </p>
                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setInviteOpen(false)}
                                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={inviteSubmitting}
                                    className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {inviteSubmitting ? 'Enviando...' : (<><UserPlus size={16} /> Enviar Convite</>)}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}

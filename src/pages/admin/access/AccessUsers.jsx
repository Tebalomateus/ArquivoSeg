import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, ChevronRight, ShieldCheck, Boxes, UserPlus } from 'lucide-react';
import { useClaims } from '../../../context/ClaimsContext';
import { usePermissions } from '../../../context/PermissionsContext';
import { listGroups, listRoles } from '../../../api/iam';
import { Spinner, ErrorNote, Empty, Chip, Modal } from './ui';

const STATUS_TONE = { active: 'green', invited: 'amber', inactive: 'slate' };

/**
 * AccessUsers is the tenant's user list — the only one. It used to have a twin
 * in Gestão de Usuários, which listed the same people to answer a different
 * question; two screens over one list is how the answers drift apart. The
 * account lifecycle (invite, resend, deactivate) lives here now, and everything
 * about what a person can do is one click away in the detail screen.
 *
 * The group chips come from the groups already loaded for the tabs next door,
 * not from a request per user: a hundred people would otherwise mean a hundred
 * round trips to render one page. The authoritative, per-person answer is in
 * the detail screen.
 */
export default function AccessUsers() {
    const { backendUsers, usersLoading, refreshUsers, inviteUser } = useClaims();
    // isAdmin, not can('usuario.convidar'): this whole block is the screen where
    // a broken IAM configuration gets fixed, so it is never gated on the data it
    // edits. Same anti-lockout reasoning as ProtectedRoute.
    const { isAdmin } = usePermissions();

    const [roles, setRoles] = useState([]);
    const [groups, setGroups] = useState(null);
    const [error, setError] = useState(null);
    const [term, setTerm] = useState('');

    const [inviteOpen, setInviteOpen] = useState(false);
    const [invite, setInvite] = useState({ email: '', first_name: '', last_name: '', role_ids: [] });
    const [inviteError, setInviteError] = useState(null);
    const [inviting, setInviting] = useState(false);
    const [notice, setNotice] = useState('');

    useEffect(() => {
        refreshUsers?.();
        let cancelled = false;
        (async () => {
            try {
                const [rolesRes, groupsRes] = await Promise.all([listRoles(), listGroups()]);
                if (cancelled) return;
                setRoles(rolesRes?.data || []);
                setGroups(groupsRes?.data || []);
            } catch (err) {
                if (!cancelled) {
                    setError(err);
                    setGroups([]);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!notice) return;
        const t = setTimeout(() => setNotice(''), 5000);
        return () => clearTimeout(t);
    }, [notice]);

    // Which groups each person belongs to, and therefore which roles reach them
    // through a group. Built once per load instead of per row.
    const groupsByUser = useMemo(() => {
        const map = new Map();
        for (const g of groups || []) {
            for (const uid of g.member_ids || []) {
                if (!map.has(uid)) map.set(uid, []);
                map.get(uid).push(g);
            }
        }
        return map;
    }, [groups]);

    const filtered = useMemo(() => {
        const q = term.trim().toLowerCase();
        const list = backendUsers || [];
        if (!q) return list;
        return list.filter((u) => (u.email || '').toLowerCase().includes(q));
    }, [backendUsers, term]);

    const openInvite = () => {
        setInvite({ email: '', first_name: '', last_name: '', role_ids: [] });
        setInviteError(null);
        setInviteOpen(true);
    };

    const toggleInviteRole = (id) =>
        setInvite((f) => ({
            ...f,
            role_ids: f.role_ids.includes(id) ? f.role_ids.filter((r) => r !== id) : [...f.role_ids, id],
        }));

    const submitInvite = async (e) => {
        e.preventDefault();
        setInviting(true);
        setInviteError(null);
        try {
            await inviteUser(invite);
            setInviteOpen(false);
            setNotice(`Convite enviado para ${invite.email}.`);
        } catch (err) {
            setInviteError(err);
        } finally {
            setInviting(false);
        }
    };

    if (groups === null && usersLoading) return <Spinner label="Carregando usuários" />;

    return (
        <div className="space-y-5">
            <ErrorNote error={error} />

            {notice && (
                <p className="px-4 py-3 rounded-2xl bg-green-50 border border-green-100 text-green-800 text-xs font-bold">
                    {notice}
                </p>
            )}

            <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-xs text-slate-500 font-medium max-w-xl">
                    Todo mundo neste tenant. Clique em alguém para ver — e mudar — papéis, grupos,
                    permissões individuais e a própria conta, com o porquê de cada acesso.
                </p>
                <div className="flex items-center gap-2 shrink-0">
                    <div className="relative">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={term}
                            onChange={(e) => setTerm(e.target.value)}
                            placeholder="Buscar por e-mail"
                            className="pl-11 pr-4 py-2.5 w-64 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    {isAdmin && (
                        <button
                            type="button"
                            onClick={openInvite}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-700"
                        >
                            <UserPlus size={14} />
                            Convidar
                        </button>
                    )}
                </div>
            </div>

            {filtered.length === 0 ? (
                <Empty
                    icon={Users}
                    title={term ? 'Ninguém com esse e-mail' : 'Nenhum usuário no tenant'}
                    hint={term ? undefined : 'Convide alguém pelo botão acima.'}
                />
            ) : (
                <div className="grid gap-2">
                    {filtered.map((u) => {
                        const userGroups = groupsByUser.get(u.id) || [];
                        return (
                            <Link
                                key={u.id}
                                to={u.id}
                                className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all group"
                            >
                                <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center font-black text-sm shrink-0 uppercase">
                                    {(u.email || '?').slice(0, 2)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-bold text-slate-800 truncate">{u.email}</span>
                                        {u.status && u.status !== 'active' && (
                                            <Chip tone={STATUS_TONE[u.status] || 'slate'}>{u.status}</Chip>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                        {/* users.role is the account type, not a permission. Only
                                            admin is worth a chip: it is the implicit wildcard that
                                            no role in this list can grant or take away. */}
                                        {u.role === 'admin' && (
                                            <Chip tone="purple">
                                                <ShieldCheck size={9} className="inline mr-1" />
                                                admin
                                            </Chip>
                                        )}
                                        {userGroups.map((g) => (
                                            <Chip key={g.id} tone="slate">
                                                <Boxes size={9} className="inline mr-1" />
                                                {g.name}
                                            </Chip>
                                        ))}
                                    </div>
                                </div>
                                <ChevronRight
                                    size={18}
                                    className="text-slate-300 group-hover:text-blue-500 transition-colors shrink-0"
                                />
                            </Link>
                        );
                    })}
                </div>
            )}

            <Modal
                open={inviteOpen}
                title="Convidar usuário"
                subtitle="A pessoa recebe um e-mail para definir senha e registrar o segundo fator."
                onClose={() => setInviteOpen(false)}
            >
                <form onSubmit={submitInvite} className="p-6 space-y-4">
                    <ErrorNote error={inviteError} />
                    <label className="block">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">E-mail</span>
                        <input
                            type="email"
                            required
                            value={invite.email}
                            onChange={(e) => setInvite((f) => ({ ...f, email: e.target.value }))}
                            placeholder="nome@empresa.com"
                            className="mt-1 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nome</span>
                            <input
                                value={invite.first_name}
                                onChange={(e) => setInvite((f) => ({ ...f, first_name: e.target.value }))}
                                placeholder="Ana"
                                className="mt-1 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Sobrenome
                            </span>
                            <input
                                value={invite.last_name}
                                onChange={(e) => setInvite((f) => ({ ...f, last_name: e.target.value }))}
                                placeholder="Souza"
                                className="mt-1 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </label>
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Papéis</span>
                        <div className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                            {roles.map((role) => (
                                <label
                                    key={role.id}
                                    className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50"
                                >
                                    <input
                                        type="checkbox"
                                        checked={invite.role_ids.includes(role.id)}
                                        onChange={() => toggleInviteRole(role.id)}
                                        className="mt-0.5 w-4 h-4 rounded accent-blue-600"
                                    />
                                    <span>
                                        <span className="block text-sm font-bold text-slate-700">{role.name}</span>
                                        {role.description && (
                                            <span className="block text-[10px] text-slate-400">{role.description}</span>
                                        )}
                                    </span>
                                </label>
                            ))}
                            {roles.length === 0 && (
                                <p className="px-4 py-3 text-[10px] font-bold text-slate-400">
                                    Nenhum papel cadastrado ainda. Crie um na aba Papéis.
                                </p>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                            Sem nenhum papel a conta entra e não vê nada, que é o padrão certo enquanto o acesso
                            ainda está sendo decidido. Dá para ajustar depois.
                        </p>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setInviteOpen(false)}
                            className="px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={inviting}
                            className="px-6 py-3 rounded-2xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-40"
                        >
                            {inviting ? 'Enviando…' : 'Enviar convite'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

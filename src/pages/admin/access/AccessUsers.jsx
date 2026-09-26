import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, ChevronRight, ShieldCheck, Boxes, UserPlus, KeyRound, X } from 'lucide-react';
import { useClaims } from '../../../context/ClaimsContext';
import { usePermissions } from '../../../context/PermissionsContext';
import { listGroups, listRoles } from '../../../api/iam';
import { Spinner, ErrorNote, Empty, Chip, Modal, RolePicker } from './ui';

const STATUS_TONE = { active: 'green', invited: 'amber', inactive: 'slate' };
const STATUS_LABEL = { active: 'ativo', invited: 'convidado', inactive: 'inativo' };

// How many chips a row shows before collapsing into "+N". Roles multiply — um
// tenant maduro tem dezenas — e uma linha que cresce sem limite deixa de ser
// lista. O número exato aparece no detalhe, que é onde ele importa.
const MAX_CHIPS = 3;

/**
 * AccessUsers is the tenant's user list — the only one. It used to have a twin
 * in Gestão de Usuários, which listed the same people to answer a different
 * question; two screens over one list is how the answers drift apart. The
 * account lifecycle (invite, resend, deactivate) lives here now, and everything
 * about what a person can do is one click away in the detail screen.
 *
 * Who holds what is assembled from the two lists the tabs next door already
 * load — roles carry member_ids, groups carry member_ids and the roles they
 * lend — instead of one access request per person: a hundred users would
 * otherwise mean a hundred round trips to render one page. That is also what
 * lets the search match a role or a group name, not only an e-mail. The
 * authoritative, per-person answer stays in the detail screen.
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

    // Roles and groups are what says who holds what, so a convite that already
    // grants papéis leaves them stale — the new person would render as "sem
    // acesso" until a reload. Two requests, and only after a write.
    const loadIam = useCallback(async () => {
        try {
            const [rolesRes, groupsRes] = await Promise.all([listRoles(), listGroups()]);
            setRoles(rolesRes?.data || []);
            setGroups(groupsRes?.data || []);
        } catch (err) {
            setError(err);
            setGroups([]);
        }
    }, []);

    useEffect(() => {
        refreshUsers?.();
        loadIam();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!notice) return;
        const t = setTimeout(() => setNotice(''), 5000);
        return () => clearTimeout(t);
    }, [notice]);

    // One pass over roles and groups builds every row: the roles held directly,
    // the groups joined, and the roles those groups lend. Same source the detail
    // screen reads, minus the individual grants — those are exceptions, and a
    // list that showed them would be showing the exception, not the shape.
    const access = useMemo(() => {
        const map = new Map();
        const of = (uid) => {
            if (!map.has(uid)) map.set(uid, { roles: [], groups: [], viaGroup: [] });
            return map.get(uid);
        };
        for (const r of roles || []) {
            for (const uid of r.member_ids || []) of(uid).roles.push(r);
        }
        for (const g of groups || []) {
            for (const uid of g.member_ids || []) {
                const entry = of(uid);
                entry.groups.push(g);
                for (const r of g.roles || []) entry.viaGroup.push(r);
            }
        }
        return map;
    }, [roles, groups]);

    // A single field over everything the row shows. "papel:" or "grupo:" narrows
    // it when a name is ambiguous — an admin looking for the group "Peritos"
    // should not have to scroll past everyone whose e-mail contains perito.
    const filtered = useMemo(() => {
        const raw = term.trim().toLowerCase();
        const list = backendUsers || [];
        if (!raw) return list;

        const [, field, rest] = raw.match(/^(papel|grupo|status|email):\s*(.*)$/) || [];
        const q = field ? rest : raw;
        if (!q) return list;

        return list.filter((u) => {
            const a = access.get(u.id) || { roles: [], groups: [], viaGroup: [] };
            const roleNames = [...a.roles, ...a.viaGroup].map((r) => `${r.name} ${r.key || ''}`);
            const groupNames = a.groups.map((g) => `${g.name} ${g.key || ''}`);
            const status = `${u.status || ''} ${STATUS_LABEL[u.status] || ''}`;
            const hay = {
                email: u.email || '',
                papel: `${roleNames.join(' ')} ${u.role === 'admin' ? 'admin administrador' : ''}`,
                grupo: groupNames.join(' '),
                status,
            };
            const pool = field ? [hay[field]] : Object.values(hay);
            return pool.some((s) => s.toLowerCase().includes(q));
        });
    }, [backendUsers, term, access]);

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
            await loadIam();
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

            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-64">
                    <div className="relative flex-1 max-w-md">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={term}
                            onChange={(e) => setTerm(e.target.value)}
                            placeholder="Buscar por e-mail, papel, grupo ou status"
                            className="pl-11 pr-10 py-2.5 w-full bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {term && (
                            <button
                                type="button"
                                onClick={() => setTerm('')}
                                aria-label="Limpar busca"
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">
                        {filtered.length}
                        {filtered.length !== (backendUsers || []).length && ` de ${(backendUsers || []).length}`}
                    </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
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
                    title={term ? 'Ninguém bate com essa busca' : 'Nenhum usuário no tenant'}
                    hint={
                        term
                            ? 'A busca cobre e-mail, papel, grupo e status. Use papel: ou grupo: para restringir.'
                            : 'Convide alguém pelo botão acima.'
                    }
                />
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                    {filtered.map((u) => {
                        const a = access.get(u.id) || { roles: [], groups: [], viaGroup: [] };
                        // O papel emprestado pelo grupo já é dito pelo chip do
                        // grupo; repeti-lo aqui gastaria a linha duas vezes com a
                        // mesma informação.
                        const chips = [
                            ...a.roles.map((r) => ({ key: `r-${r.id}`, icon: KeyRound, tone: 'blue', label: r.name })),
                            ...a.groups.map((g) => ({ key: `g-${g.id}`, icon: Boxes, tone: 'slate', label: g.name })),
                        ];
                        const shown = chips.slice(0, MAX_CHIPS);
                        const hidden = chips.length - shown.length;

                        return (
                            <Link
                                key={u.id}
                                to={u.id}
                                className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group ${
                                    u.status === 'inactive' ? 'opacity-60' : ''
                                }`}
                            >
                                <span className="text-sm font-bold text-slate-800 truncate w-64 shrink-0">
                                    {u.email}
                                </span>

                                <span className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
                                    {/* users.role is the account type, not a permission. Only
                                        admin is worth a chip: it is the implicit wildcard that
                                        no role in this list can grant or take away. */}
                                    {u.role === 'admin' && (
                                        <Chip tone="purple">
                                            <ShieldCheck size={9} className="inline mr-1" />
                                            admin
                                        </Chip>
                                    )}
                                    {shown.map(({ key, icon: Icon, tone, label }) => (
                                        <Chip key={key} tone={tone}>
                                            <Icon size={9} className="inline mr-1" />
                                            {label}
                                        </Chip>
                                    ))}
                                    {hidden > 0 && <Chip tone="slate">+{hidden}</Chip>}
                                    {chips.length === 0 && u.role !== 'admin' && (
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
                                            sem acesso
                                        </span>
                                    )}
                                </span>

                                <span className="shrink-0 w-24 text-right">
                                    {u.status && u.status !== 'active' && (
                                        <Chip tone={STATUS_TONE[u.status] || 'slate'}>
                                            {STATUS_LABEL[u.status] || u.status}
                                        </Chip>
                                    )}
                                </span>

                                <ChevronRight
                                    size={16}
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
                        <div className="mt-1">
                            <RolePicker
                                roles={roles}
                                selected={invite.role_ids}
                                onToggle={toggleInviteRole}
                            />
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

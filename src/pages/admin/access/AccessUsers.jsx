import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, ChevronRight, ShieldCheck, Boxes, KeyRound } from 'lucide-react';
import { useClaims } from '../../../context/ClaimsContext';
import { listGroups, listRoles } from '../../../api/iam';
import { Spinner, ErrorNote, Empty, Chip } from './ui';

const STATUS_TONE = { active: 'green', invited: 'amber', inactive: 'slate' };

/**
 * AccessUsers is the tenant's user list seen through the access lens.
 *
 * The chips come from the roles and groups already loaded for the tabs next
 * door, not from a request per user: a hundred people would otherwise mean a
 * hundred round trips to render one page. The authoritative, per-person answer
 * lives one click away, in the detail screen.
 */
export default function AccessUsers() {
    const { backendUsers, usersLoading, refreshUsers } = useClaims();
    const [roles, setRoles] = useState([]);
    const [groups, setGroups] = useState(null);
    const [error, setError] = useState(null);
    const [term, setTerm] = useState('');

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

    if (groups === null && usersLoading) return <Spinner label="Carregando usuários" />;

    return (
        <div className="space-y-5">
            <ErrorNote error={error} />

            <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-slate-500 font-medium max-w-xl">
                    Todo mundo neste tenant. Clique em alguém para ver — e mudar — papéis, grupos e
                    permissões individuais, com o porquê de cada acesso.
                </p>
                <div className="relative shrink-0">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                        placeholder="Buscar por e-mail"
                        className="pl-11 pr-4 py-2.5 w-64 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {filtered.length === 0 ? (
                <Empty
                    icon={Users}
                    title={term ? 'Ninguém com esse e-mail' : 'Nenhum usuário no tenant'}
                    hint={term ? undefined : 'Convide alguém na tela de Gestão de Usuários.'}
                />
            ) : (
                <div className="grid gap-2">
                    {filtered.map((u) => {
                        const userGroups = groupsByUser.get(u.id) || [];
                        const isAdmin = u.role === 'admin';
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
                                        {isAdmin && (
                                            <Chip tone="purple">
                                                <ShieldCheck size={9} className="inline mr-1" />
                                                admin
                                            </Chip>
                                        )}
                                        {!isAdmin && u.role && (
                                            <Chip tone="blue">
                                                <KeyRound size={9} className="inline mr-1" />
                                                {roles.find((r) => r.key === u.role)?.name || u.role}
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
        </div>
    );
}

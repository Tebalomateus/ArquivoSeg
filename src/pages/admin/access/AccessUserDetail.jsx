import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    ShieldCheck,
    KeyRound,
    Boxes,
    Check,
    Ban,
    Search,
    AlertTriangle,
} from 'lucide-react';
import {
    getUserAccess,
    getEffectivePermissions,
    setUserRoles,
    setUserPermissions,
    listRoles,
    getActionCatalog,
} from '../../../api/iam';
import { useClaims } from '../../../context/ClaimsContext';
import { usePermissions } from '../../../context/PermissionsContext';
import { Spinner, ErrorNote, Empty, Modal, Chip } from './ui';

// The two refusals this screen has to explain rather than swallow. Both are
// answered by asking again with confirm=true, and only after the admin has read
// what they are about to do to themselves.
const CONFIRMABLE = {
    SELF_DEMOTION: {
        title: 'Isto tira o seu próprio acesso',
        body: 'Você está removendo permissões de IAM de si mesmo. Depois de salvar, quem desfaz isto é outra pessoa — você não vai mais conseguir abrir esta tela.',
    },
};

export default function AccessUserDetail() {
    const { id } = useParams();
    const { backendUsers, currentUser } = useClaims();
    const { refresh: refreshMyPermissions } = usePermissions();

    const [access, setAccess] = useState(null);
    const [effective, setEffective] = useState(null);
    const [roles, setRoles] = useState([]);
    const [catalog, setCatalog] = useState([]);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [confirmAgain, setConfirmAgain] = useState(null); // { code, retry }

    const [term, setTerm] = useState('');
    const [onlyGranted, setOnlyGranted] = useState(true);
    const [permEditor, setPermEditor] = useState(null);

    const user = useMemo(() => (backendUsers || []).find((u) => u.id === id), [backendUsers, id]);

    // currentUser.id is the Zitadel subject, not the internal users.id — the only
    // bridge between the two is the e-mail, the same one ClaimsContext uses.
    const isSelf = useMemo(() => {
        const mine = (backendUsers || []).find(
            (u) => u.email?.toLowerCase() === currentUser?.email?.toLowerCase(),
        );
        return !!mine && mine.id === id;
    }, [backendUsers, currentUser, id]);

    const load = useCallback(async () => {
        setError(null);
        try {
            const [accessRes, effectiveRes, rolesRes, catalogRes] = await Promise.all([
                getUserAccess(id),
                getEffectivePermissions(id),
                listRoles(),
                getActionCatalog(),
            ]);
            setAccess(accessRes?.data || null);
            setEffective(effectiveRes?.data || null);
            setRoles(rolesRes?.data || []);
            setCatalog(catalogRes?.data || []);
        } catch (err) {
            setError(err);
        }
    }, [id]);

    useEffect(() => {
        load();
    }, [load]);

    // Every write goes through here so the confirm dance is written once: the
    // API refuses, the screen explains, the admin says yes, the same call runs
    // again with confirm=true.
    const submit = useCallback(
        async (fn, { confirm = false } = {}) => {
            setSaving(true);
            setError(null);
            try {
                await fn(confirm);
                setConfirmAgain(null);
                await load();
                // The admin may have just changed their own access, and the
                // cached permission set would keep saying otherwise.
                if (isSelf) refreshMyPermissions?.();
            } catch (err) {
                if (CONFIRMABLE[err.code] && !confirm) {
                    setConfirmAgain({ code: err.code, retry: fn });
                } else {
                    setError(err);
                }
            } finally {
                setSaving(false);
            }
        },
        [load, isSelf, refreshMyPermissions],
    );

    const toggleRole = (roleId) => {
        const current = (access.roles || []).map((r) => r.id);
        const next = current.includes(roleId) ? current.filter((r) => r !== roleId) : [...current, roleId];
        submit((confirm) => setUserRoles(id, next, { confirm }));
    };

    const saveIndividual = (grants) => submit((confirm) => setUserPermissions(id, grants, { confirm }));

    const setGrant = (action, effect) => {
        const rest = (access.individual_permissions || []).filter((g) => g.action !== action);
        saveIndividual(effect ? [...rest, { action, effect }] : rest);
    };

    const permissions = useMemo(() => {
        const list = effective?.permissions || [];
        const q = term.trim().toLowerCase();
        return list.filter((p) => {
            if (onlyGranted && p.effect !== 'allow') return false;
            if (!q) return true;
            return p.action.toLowerCase().includes(q);
        });
    }, [effective, term, onlyGranted]);

    if (!access && !error) return <Spinner label="Carregando acessos" />;

    const individualByAction = new Map((access?.individual_permissions || []).map((g) => [g.action, g.effect]));

    return (
        <div className="space-y-6">
            <Link
                to="../usuarios"
                className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 transition-colors"
            >
                <ArrowLeft size={14} /> Todos os usuários
            </Link>

            <ErrorNote error={error} onRetry={load} />

            {access && (
                <>
                    <div className="flex items-center gap-4 p-6 bg-white rounded-3xl border border-slate-200">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center font-black uppercase shrink-0">
                            {(user?.email || '?').slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-lg font-black text-slate-900 truncate">{user?.email || access.user_id}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {access.is_admin && (
                                    <Chip tone="purple">
                                        <ShieldCheck size={9} className="inline mr-1" />
                                        admin do tenant
                                    </Chip>
                                )}
                                {user?.status && user.status !== 'active' && <Chip tone="amber">{user.status}</Chip>}
                            </div>
                        </div>
                    </div>

                    {access.is_admin && (
                        <div className="flex items-start gap-3 p-4 rounded-2xl bg-purple-50 border border-purple-100 text-purple-800">
                            <ShieldCheck size={18} className="mt-0.5 shrink-0" />
                            <p className="text-xs font-medium leading-relaxed">
                                Admin tem curinga implícito: pode tudo o que existe no catálogo, inclusive o que
                                deploys futuros adicionarem. Uma negação individual ainda vale contra isso — negar
                                sempre vence, admin incluído.
                            </p>
                        </div>
                    )}

                    <div className="grid lg:grid-cols-2 gap-4">
                        {/* Direct roles */}
                        <section className="p-6 bg-white rounded-3xl border border-slate-200">
                            <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 mb-4">
                                <KeyRound size={14} /> Papéis diretos
                            </h2>
                            <div className="space-y-1.5">
                                {roles.map((role) => {
                                    const held = (access.roles || []).some((r) => r.id === role.id);
                                    return (
                                        <label
                                            key={role.id}
                                            className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={held}
                                                disabled={saving}
                                                onChange={() => toggleRole(role.id)}
                                                className="w-4 h-4 rounded accent-blue-600"
                                            />
                                            <span className="text-sm font-bold text-slate-700 flex-1">{role.name}</span>
                                            <span className="text-[10px] text-slate-400">
                                                {(role.permissions || []).length} perms
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Groups — read only */}
                        <section className="p-6 bg-white rounded-3xl border border-slate-200">
                            <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 mb-4">
                                <Boxes size={14} /> Grupos
                            </h2>
                            {(access.groups || []).length === 0 ? (
                                <p className="text-xs text-slate-400">
                                    Não pertence a nenhum grupo. A associação se edita do lado do grupo.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {access.groups.map((g) => (
                                        <Link
                                            key={g.id}
                                            to="../grupos"
                                            className="block px-4 py-3 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors"
                                        >
                                            <span className="text-sm font-bold text-slate-700">{g.name}</span>
                                            <span className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                {(g.roles || []).map((r) => (
                                                    <Chip key={r.id} tone="blue">
                                                        {r.name}
                                                    </Chip>
                                                ))}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Individual grants */}
                    <section className="p-6 bg-white rounded-3xl border border-slate-200">
                        <div className="flex items-center justify-between gap-4 mb-4">
                            <div>
                                <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
                                    <Ban size={14} /> Permissões individuais
                                </h2>
                                <p className="text-xs text-slate-400 mt-1">
                                    A exceção pontual: conceder algo sem criar um papel para uma pessoa, ou tirar algo
                                    que um papel dá. Negar vence qualquer permissão.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPermEditor({ action: '', effect: 'allow' })}
                                className="px-5 py-2.5 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 shrink-0"
                            >
                                Adicionar
                            </button>
                        </div>
                        {(access.individual_permissions || []).length === 0 ? (
                            <p className="text-xs text-slate-400">Nenhuma. Todo o acesso vem de papéis e grupos.</p>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-2">
                                {access.individual_permissions.map((g) => (
                                    <div
                                        key={`${g.action}:${g.effect}`}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                                            g.effect === 'deny'
                                                ? 'border-red-200 bg-red-50'
                                                : 'border-green-200 bg-green-50'
                                        }`}
                                    >
                                        {g.effect === 'deny' ? (
                                            <Ban size={14} className="text-red-600 shrink-0" />
                                        ) : (
                                            <Check size={14} className="text-green-600 shrink-0" />
                                        )}
                                        <code className="text-xs font-bold text-slate-700 flex-1 truncate">
                                            {g.action}
                                        </code>
                                        <button
                                            type="button"
                                            disabled={saving}
                                            onClick={() => setGrant(g.action, null)}
                                            className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 disabled:opacity-40"
                                        >
                                            Remover
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Effective permissions — the "why" panel */}
                    <section className="p-6 bg-white rounded-3xl border border-slate-200">
                        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                            <div>
                                <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">
                                    Acessos efetivos
                                </h2>
                                <p className="text-xs text-slate-400 mt-1">
                                    O veredito por ação e de onde ele vem. É a resposta a “por que fulano não
                                    consegue X” sem virar chamado.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    <input
                                        type="checkbox"
                                        checked={onlyGranted}
                                        onChange={(e) => setOnlyGranted(e.target.checked)}
                                        className="w-4 h-4 rounded accent-blue-600"
                                    />
                                    Só o que pode
                                </label>
                                <div className="relative">
                                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={term}
                                        onChange={(e) => setTerm(e.target.value)}
                                        placeholder="Filtrar ação"
                                        className="pl-9 pr-3 py-2 w-52 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {permissions.length === 0 ? (
                            <Empty
                                icon={AlertTriangle}
                                title="Nada aqui"
                                hint="Esta pessoa não tem nenhuma permissão que bata com o filtro."
                            />
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {permissions.map((p) => (
                                    <li key={p.action} className="py-3 flex items-start gap-4">
                                        <span className="shrink-0 mt-0.5">
                                            {p.effect === 'deny' ? (
                                                <Ban size={16} className="text-red-600" />
                                            ) : (
                                                <Check size={16} className="text-green-600" />
                                            )}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <code className="text-xs font-bold text-slate-800">{p.action}</code>
                                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                {p.sources.map((src, i) => (
                                                    <SourceChip key={`${p.action}-${i}`} source={src} />
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <GrantToggle
                                                current={individualByAction.get(p.action) || null}
                                                disabled={saving}
                                                onPick={(effect) => setGrant(p.action, effect)}
                                            />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </>
            )}

            <Modal
                open={!!permEditor}
                title="Permissão individual"
                subtitle="Escolha a ação e se ela é concedida ou negada para esta pessoa."
                onClose={() => setPermEditor(null)}
            >
                {permEditor && (
                    <div className="p-6 space-y-4">
                        <label className="block">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ação</span>
                            <select
                                value={permEditor.action}
                                onChange={(e) => setPermEditor({ ...permEditor, action: e.target.value })}
                                className="mt-1 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Selecione…</option>
                                {catalog.map((group) => (
                                    <optgroup key={group.group} label={group.group}>
                                        <option value={`${group.group}.*`}>{group.group}.* (curinga)</option>
                                        {group.actions.map((a) => (
                                            <option key={a.name} value={a.name}>
                                                {a.label} — {a.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </label>
                        <div className="flex items-center gap-2">
                            {['allow', 'deny'].map((effect) => (
                                <button
                                    key={effect}
                                    type="button"
                                    onClick={() => setPermEditor({ ...permEditor, effect })}
                                    className={`flex-1 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${
                                        permEditor.effect === effect
                                            ? effect === 'deny'
                                                ? 'bg-red-600 text-white'
                                                : 'bg-green-600 text-white'
                                            : 'bg-slate-100 text-slate-500'
                                    }`}
                                >
                                    {effect === 'deny' ? 'Negar' : 'Conceder'}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setPermEditor(null)}
                                className="px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={!permEditor.action || saving}
                                onClick={() => {
                                    setGrant(permEditor.action, permEditor.effect);
                                    setPermEditor(null);
                                }}
                                className="px-6 py-3 rounded-2xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-40"
                            >
                                Aplicar
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                open={!!confirmAgain}
                title={CONFIRMABLE[confirmAgain?.code]?.title || 'Confirmar'}
                onClose={() => setConfirmAgain(null)}
            >
                {confirmAgain && (
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-slate-600 leading-relaxed">
                            {CONFIRMABLE[confirmAgain.code]?.body}
                        </p>
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setConfirmAgain(null)}
                                className="px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={saving}
                                onClick={() => submit(confirmAgain.retry, { confirm: true })}
                                className="px-6 py-3 rounded-2xl bg-red-600 text-white text-xs font-black uppercase tracking-widest hover:bg-red-700 disabled:opacity-40"
                            >
                                Entendi, prosseguir
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}

// SourceChip names the reason behind a verdict. A wildcard shows as the wildcard
// it is, not as the action it expanded to — otherwise "why does this person have
// this" has no answer worth reading.
function SourceChip({ source }) {
    const label =
        source.type === 'admin'
            ? 'admin (curinga)'
            : source.type === 'individual'
              ? 'individual'
              : source.group_name
                ? `${source.group_name} › ${source.name}`
                : source.name;

    const tone = source.effect === 'deny' ? 'red' : source.type === 'admin' ? 'purple' : 'blue';

    return (
        <Chip tone={tone}>
            {source.effect === 'deny' ? 'negado por ' : ''}
            {label}
            {source.matched && source.matched.endsWith('*') ? ` (${source.matched})` : ''}
        </Chip>
    );
}

function GrantToggle({ current, disabled, onPick }) {
    const options = [
        { effect: 'allow', icon: Check, tone: 'text-green-600 bg-green-100' },
        { effect: 'deny', icon: Ban, tone: 'text-red-600 bg-red-100' },
    ];
    return (
        <div className="flex items-center gap-1">
            {options.map(({ effect, icon: Icon, tone }) => (
                <button
                    key={effect}
                    type="button"
                    disabled={disabled}
                    title={current === effect ? 'Remover esta exceção individual' : `Definir ${effect} individual`}
                    onClick={() => onPick(current === effect ? null : effect)}
                    className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                        current === effect ? tone : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
                    }`}
                >
                    <Icon size={14} />
                </button>
            ))}
        </div>
    );
}

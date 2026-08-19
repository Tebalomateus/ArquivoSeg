import { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, Plus, Pencil, Trash2, Users, KeyRound, Lock } from 'lucide-react';
import {
    listGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    setGroupMembers,
    listRoles,
} from '../../../api/iam';
import { useClaims } from '../../../context/ClaimsContext';
import { Spinner, ErrorNote, Empty, Modal, Chip } from './ui';
import { useConfirm } from '../../../components/ConfirmDialog';

// The key is the stable slug the API stores; the server accepts lowercase
// letters, digits and hyphens only, so derive one that already fits.
function keyFrom(name) {
    return name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^[^a-z]+/, '')
        .replace(/-+$/, '')
        .slice(0, 50);
}

const KEY_PATTERN = /^[a-z][a-z0-9-]{0,49}$/;

// Typing is sanitised, not slugified: trimming a trailing hyphen mid-keystroke
// would make "equipe-regulacao" impossible to type by hand.
function sanitizeKeyInput(value) {
    return value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^[^a-z]+/, '')
        .slice(0, 50);
}

const EMPTY = { key: '', name: '', description: '', role_ids: [] };

export default function AccessGroups() {
    const { backendUsers, refreshUsers } = useClaims();
    const [groups, setGroups] = useState(null);
    const [roles, setRoles] = useState([]);
    const [error, setError] = useState(null);

    const [editor, setEditor] = useState(null);
    const [members, setMembers] = useState(null); // { group, selected:Set, saving, error }
    const ask = useConfirm();

    const load = useCallback(async () => {
        setError(null);
        try {
            const [groupsRes, rolesRes] = await Promise.all([listGroups(), listRoles()]);
            setGroups(groupsRes?.data || []);
            setRoles(rolesRes?.data || []);
        } catch (err) {
            setError(err);
            setGroups([]);
        }
    }, []);

    useEffect(() => {
        load();
        refreshUsers?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]);

    const usersById = useMemo(
        () => new Map((backendUsers || []).map((u) => [u.id, u])),
        [backendUsers],
    );

    const openCreate = () =>
        setEditor({ group: null, form: { ...EMPTY }, saving: false, error: null, keyTouched: false });

    const openEdit = (group) =>
        setEditor({
            group,
            form: {
                key: group.key,
                name: group.name,
                description: group.description || '',
                role_ids: (group.roles || []).map((r) => r.id),
            },
            saving: false,
            error: null,
            keyTouched: true,
        });

    const patchForm = (patch) => setEditor((e) => ({ ...e, form: { ...e.form, ...patch } }));

    const handleName = (name) => {
        if (!editor.group && !editor.keyTouched) patchForm({ name, key: keyFrom(name) });
        else patchForm({ name });
    };

    const toggleRole = (id) => {
        const has = editor.form.role_ids.includes(id);
        patchForm({
            role_ids: has ? editor.form.role_ids.filter((r) => r !== id) : [...editor.form.role_ids, id],
        });
    };

    const save = async (e) => {
        e.preventDefault();
        const { group, form } = editor;
        if (!form.name.trim() || !form.key.trim()) {
            setEditor((s) => ({ ...s, error: { message: 'Nome e chave são obrigatórios.' } }));
            return;
        }
        if (!group && !KEY_PATTERN.test(form.key)) {
            setEditor((s) => ({
                ...s,
                error: {
                    message:
                        'A chave aceita apenas letras minúsculas, números e hifens, começando por uma letra. Ex.: equipe-regulacao',
                },
            }));
            return;
        }
        setEditor((s) => ({ ...s, saving: true, error: null }));
        try {
            if (group) {
                await updateGroup(group.id, {
                    name: form.name,
                    description: form.description,
                    role_ids: form.role_ids,
                });
            } else {
                await createGroup(form);
            }
            setEditor(null);
            await load();
        } catch (err) {
            setEditor((s) => ({ ...s, saving: false, error: err }));
        }
    };

    const openMembers = (group) =>
        setMembers({
            group,
            selected: new Set(group.member_ids || []),
            saving: false,
            error: null,
        });

    const toggleMember = (id) => {
        setMembers((m) => {
            const next = new Set(m.selected);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return { ...m, selected: next };
        });
    };

    const saveMembers = async () => {
        setMembers((m) => ({ ...m, saving: true, error: null }));
        try {
            // The endpoint takes the membership as it should end up, not a delta —
            // two admins editing the same group cannot half-apply each other's work.
            await setGroupMembers(members.group.id, [...members.selected]);
            setMembers(null);
            await load();
        } catch (err) {
            setMembers((m) => ({ ...m, saving: false, error: err }));
        }
    };

    const remove = async (group) => {
        // O onConfirm mantém o diálogo aberto até o servidor responder: uma
        // recusa aparece dentro dele, que é onde a pessoa ainda está olhando.
        const done = await ask({
            title: `Excluir ${group.name}?`,
            message: 'Os membros perdem os papéis que vinham por este grupo. Papéis atribuídos diretamente a cada pessoa não são afetados.',
            detail: group.name,
            confirmLabel: 'Excluir',
            tone: 'danger',
            onConfirm: () => deleteGroup(group.id),
        });
        if (done) await load();
    };

    if (groups === null) return <Spinner label="Carregando grupos" />;

    return (
        <div className="space-y-5">
            <ErrorNote error={error} onRetry={load} />

            <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-slate-500 font-medium">
                    Um grupo não tem permissões próprias: ele empresta papéis a quem for membro. É como se
                    dá o mesmo acesso a uma equipe inteira sem repetir a atribuição pessoa a pessoa.
                </p>
                <button
                    type="button"
                    onClick={openCreate}
                    className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 shrink-0"
                >
                    <Plus size={16} /> Novo grupo
                </button>
            </div>

            {groups.length === 0 ? (
                <Empty
                    icon={Boxes}
                    title="Nenhum grupo ainda"
                    hint="Crie um grupo quando várias pessoas precisarem do mesmo conjunto de papéis."
                />
            ) : (
                <div className="grid gap-3">
                    {groups.map((group) => (
                        <div
                            key={group.id}
                            data-testid={`group-row-${group.key}`}
                            className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-200 hover:border-slate-300 transition-colors"
                        >
                            <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                                <Boxes size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-black text-slate-900">{group.name}</span>
                                    <code className="text-[10px] text-slate-400">{group.key}</code>
                                </div>
                                {group.description && (
                                    <p className="text-xs text-slate-500 mt-0.5 truncate">{group.description}</p>
                                )}
                                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                    {(group.roles || []).length === 0 ? (
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
                                            sem papéis — não concede nada
                                        </span>
                                    ) : (
                                        group.roles.map((r) => (
                                            <Chip key={r.id} tone="blue">
                                                {r.name}
                                            </Chip>
                                        ))
                                    )}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => openMembers(group)}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors shrink-0"
                            >
                                <Users size={14} /> {(group.member_ids || []).length} membros
                            </button>
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => openEdit(group)}
                                    className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                    title="Editar"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => remove(group)}
                                    className="p-2.5 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                    title="Excluir"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal
                open={!!editor}
                title={editor?.group ? editor.group.name : 'Novo grupo'}
                subtitle="Escolha os papéis que este grupo empresta aos seus membros."
                onClose={() => setEditor(null)}
            >
                {editor && (
                    <form onSubmit={save}>
                        <div className="p-6 space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <label className="block">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                        Nome
                                    </span>
                                    <input
                                        value={editor.form.name}
                                        onChange={(e) => handleName(e.target.value)}
                                        className="mt-1 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Equipe de regulação"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                        Chave
                                    </span>
                                    <input
                                        value={editor.form.key}
                                        onChange={(e) =>
                                            setEditor((s) => ({
                                                ...s,
                                                keyTouched: true,
                                                form: { ...s.form, key: sanitizeKeyInput(e.target.value) },
                                            }))
                                        }
                                        disabled={!!editor.group}
                                        className="mt-1 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                                        placeholder="equipe-regulacao"
                                    />
                                </label>
                            </div>
                            <label className="block">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    Descrição
                                </span>
                                <input
                                    value={editor.form.description}
                                    onChange={(e) => patchForm({ description: e.target.value })}
                                    className="mt-1 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Para que serve este grupo"
                                />
                            </label>

                            <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    Papéis emprestados
                                </span>
                                <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto pr-1">
                                    {roles.map((role) => (
                                        <label
                                            key={role.id}
                                            className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={editor.form.role_ids.includes(role.id)}
                                                onChange={() => toggleRole(role.id)}
                                                className="w-4 h-4 rounded accent-blue-600"
                                            />
                                            <KeyRound size={14} className="text-slate-400" />
                                            <span className="text-sm font-bold text-slate-700 flex-1">{role.name}</span>
                                            {role.is_system && (
                                                <Chip tone="purple">
                                                    <Lock size={9} className="inline mr-1" />
                                                    sistema
                                                </Chip>
                                            )}
                                            <span className="text-[10px] text-slate-400">
                                                {(role.permissions || []).length} perms
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 space-y-3">
                            <ErrorNote error={editor.error} />
                            <div className="flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEditor(null)}
                                    className="px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={editor.saving}
                                    className="px-6 py-3 rounded-2xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-40"
                                >
                                    {editor.saving ? 'Salvando…' : 'Salvar'}
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </Modal>

            <Modal
                open={!!members}
                title={`Membros de ${members?.group?.name || ''}`}
                subtitle="Quem estiver aqui recebe os papéis que o grupo empresta."
                onClose={() => setMembers(null)}
            >
                {members && (
                    <>
                        <div className="p-6">
                            {(backendUsers || []).length === 0 ? (
                                <Empty icon={Users} title="Nenhum usuário carregado" />
                            ) : (
                                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                                    {backendUsers.map((u) => (
                                        <label
                                            key={u.id}
                                            className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={members.selected.has(u.id)}
                                                onChange={() => toggleMember(u.id)}
                                                className="w-4 h-4 rounded accent-blue-600"
                                            />
                                            <span className="text-sm font-bold text-slate-700 flex-1 truncate">
                                                {u.email}
                                            </span>
                                            {u.status && u.status !== 'active' && <Chip tone="amber">{u.status}</Chip>}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-slate-100 space-y-3">
                            <ErrorNote error={members.error} />
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-xs font-bold text-slate-500">
                                    {members.selected.size} selecionados
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setMembers(null)}
                                        className="px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={saveMembers}
                                        disabled={members.saving}
                                        className="px-6 py-3 rounded-2xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-40"
                                    >
                                        {members.saving ? 'Salvando…' : 'Salvar membros'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </Modal>
        </div>
    );
}

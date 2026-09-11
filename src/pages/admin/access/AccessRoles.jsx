import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Plus, Pencil, Trash2, Lock, Users } from 'lucide-react';
import {
    listRoles,
    createRole,
    updateRole,
    deleteRole,
    getActionCatalog,
} from '../../../api/iam';
import ActionCatalogPicker from '../../../components/iam/ActionCatalogPicker';
import { Spinner, ErrorNote, Empty, Modal, Chip } from './ui';
import { useConfirm } from '../../../components/ConfirmDialog';

// A key is the stable identifier a policy refers to; the name is what people
// read. Deriving one from the other on the way in saves the admin from typing
// both, but the field stays editable — and locked once the role exists, because
// changing a key would silently orphan every reference to it.
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

// The server's slug rule, mirrored here so a bad key is caught before the round
// trip instead of coming back as an opaque error.
const KEY_PATTERN = /^[a-z][a-z0-9-]{0,49}$/;

// Typing is sanitised, not slugified: trimming a trailing hyphen mid-keystroke
// would make "regulador-senior" impossible to type by hand.
function sanitizeKeyInput(value) {
    return value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^[^a-z]+/, '')
        .slice(0, 50);
}

const EMPTY = { key: '', name: '', description: '', permissions: [] };

export default function AccessRoles() {
    const [roles, setRoles] = useState(null);
    const [catalog, setCatalog] = useState([]);
    const [error, setError] = useState(null);

    const [editor, setEditor] = useState(null); // { role|null, form, saving, error }
    const ask = useConfirm();

    const load = useCallback(async () => {
        setError(null);
        try {
            const [rolesRes, catalogRes] = await Promise.all([listRoles(), getActionCatalog()]);
            setRoles(rolesRes?.data || []);
            setCatalog(catalogRes?.data || []);
        } catch (err) {
            setError(err);
            setRoles([]);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const openCreate = () =>
        setEditor({ role: null, form: { ...EMPTY }, saving: false, error: null, keyTouched: false });

    const openEdit = (role) =>
        setEditor({
            role,
            form: {
                key: role.key,
                name: role.name,
                description: role.description || '',
                permissions: role.permissions || [],
            },
            saving: false,
            error: null,
            keyTouched: true,
        });

    const patchForm = (patch) => setEditor((e) => ({ ...e, form: { ...e.form, ...patch } }));

    const handleName = (name) => {
        // Only autofill the key while creating and while the admin has not taken
        // it over — retyping the name should never rewrite a key they chose.
        if (!editor.role && !editor.keyTouched) patchForm({ name, key: keyFrom(name) });
        else patchForm({ name });
    };

    const save = async (e) => {
        e.preventDefault();
        const { role, form } = editor;
        if (!form.name.trim() || !form.key.trim()) {
            setEditor((s) => ({ ...s, error: { message: 'Nome e chave são obrigatórios.' } }));
            return;
        }
        if (!role && !KEY_PATTERN.test(form.key)) {
            setEditor((s) => ({
                ...s,
                error: {
                    message:
                        'A chave aceita apenas letras minúsculas, números e hifens, começando por uma letra. Ex.: regulador-senior',
                },
            }));
            return;
        }
        setEditor((s) => ({ ...s, saving: true, error: null }));
        try {
            if (role) {
                await updateRole(role.id, {
                    name: form.name,
                    description: form.description,
                    permissions: form.permissions,
                });
            } else {
                await createRole(form);
            }
            setEditor(null);
            await load();
        } catch (err) {
            setEditor((s) => ({ ...s, saving: false, error: err }));
        }
    };

    const remove = async (role) => {
        // Duas perguntas, não uma. A API recusa um papel que alguém ainda tem e
        // diz quantas atribuições cairiam junto; esse número é o estrago, e
        // mostrá-lo é melhor do que pedir ao admin que adivinhe o que o force
        // quebra. Só a segunda pergunta é a que apaga com força.
        let force = false;
        let count = null;
        for (;;) {
            let escalate = false;
            const done = await ask({
                title: `Excluir ${role.name}?`,
                message: force
                    ? `Este papel ainda está atribuído${count !== null ? ` a ${count} atribuição(ões)` : ''}. Excluir agora remove essas atribuições junto — as pessoas afetadas perdem as permissões que só vinham daqui.`
                    : 'O papel some e deixa de valer para quem o tiver.',
                detail: role.name,
                confirmLabel: force ? 'Excluir mesmo assim' : 'Excluir',
                tone: force ? 'warning' : 'danger',
                onConfirm: async () => {
                    try {
                        await deleteRole(role.id, { force });
                    } catch (err) {
                        if (err.code !== 'ROLE_IN_USE') throw err;
                        count = err.body?.error?.details?.assignments ?? null;
                        escalate = true;
                    }
                },
            });
            if (escalate) {
                force = true;
                continue;
            }
            if (done) await load();
            return;
        }
    };

    if (roles === null) return <Spinner label="Carregando papéis" />;

    return (
        <div className="space-y-5">
            <ErrorNote error={error} onRetry={load} />

            <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-slate-500 font-medium">
                    Um papel é um conjunto de permissões com nome. Atribua papéis a pessoas ou a grupos.
                </p>
                <button
                    type="button"
                    onClick={openCreate}
                    className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                >
                    <Plus size={16} /> Novo papel
                </button>
            </div>

            {roles.length === 0 ? (
                <Empty
                    icon={KeyRound}
                    title="Nenhum papel ainda"
                    hint="Os papéis de sistema aparecem aqui assim que o tenant é provisionado."
                />
            ) : (
                <div className="grid gap-3">
                    {roles.map((role) => (
                        <div
                            key={role.id}
                            data-testid={`role-${role.key}`}
                            className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-200 hover:border-slate-300 transition-colors"
                        >
                            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                <KeyRound size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-black text-slate-900">{role.name}</span>
                                    <code className="text-[10px] text-slate-400">{role.key}</code>
                                    {role.is_system && (
                                        <Chip tone="purple">
                                            <Lock size={9} className="inline mr-1" />
                                            sistema
                                        </Chip>
                                    )}
                                </div>
                                {role.description && (
                                    <p className="text-xs text-slate-500 mt-0.5 truncate">{role.description}</p>
                                )}
                                <div className="flex items-center gap-3 mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    <span>{(role.permissions || []).length} permissões</span>
                                    <span className="flex items-center gap-1">
                                        <Users size={11} /> {role.members_count ?? 0}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => openEdit(role)}
                                    className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                    title={role.is_system ? 'Ver permissões' : 'Editar'}
                                >
                                    <Pencil size={16} />
                                </button>
                                <button
                                    type="button"
                                    disabled={role.is_system}
                                    onClick={() => remove(role)}
                                    className="p-2.5 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                                    title={role.is_system ? 'Papéis de sistema não podem ser excluídos' : 'Excluir'}
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
                wide
                title={editor?.role ? editor.role.name : 'Novo papel'}
                subtitle={
                    editor?.role?.is_system
                        ? 'Papel de sistema: as permissões são fixas até a fase 3 da migração.'
                        : 'Marque as permissões que este papel concede.'
                }
                onClose={() => setEditor(null)}
            >
                {editor && (
                    <form onSubmit={save} className="flex flex-col">
                        <div className="p-6 space-y-4 border-b border-slate-100">
                            <div className="grid md:grid-cols-2 gap-4">
                                <label className="block">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                        Nome
                                    </span>
                                    <input
                                        value={editor.form.name}
                                        onChange={(e) => handleName(e.target.value)}
                                        disabled={editor.role?.is_system}
                                        className="mt-1 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                                        placeholder="Regulador sênior"
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
                                        disabled={!!editor.role}
                                        className="mt-1 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                                        placeholder="regulador-senior"
                                    />
                                    {editor.role && (
                                        <span className="text-[10px] text-slate-400 mt-1 block">
                                            A chave não muda: políticas e integrações se referem a ela.
                                        </span>
                                    )}
                                </label>
                            </div>
                            <label className="block">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    Descrição
                                </span>
                                <input
                                    value={editor.form.description}
                                    onChange={(e) => patchForm({ description: e.target.value })}
                                    disabled={editor.role?.is_system}
                                    className="mt-1 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                                    placeholder="Para quem este papel serve"
                                />
                            </label>
                        </div>

                        <div className="p-6">
                            <ActionCatalogPicker
                                catalog={catalog}
                                value={editor.form.permissions}
                                onChange={(permissions) => patchForm({ permissions })}
                                disabled={editor.role?.is_system}
                            />
                        </div>

                        <div className="p-6 border-t border-slate-100 space-y-3 sticky bottom-0 bg-white rounded-b-3xl">
                            <ErrorNote error={editor.error} />
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-xs font-bold text-slate-500">
                                    {editor.form.permissions.length} selecionadas
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditor(null)}
                                        className="px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={editor.saving || editor.role?.is_system}
                                        className="px-6 py-3 rounded-2xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-40"
                                    >
                                        {editor.saving ? 'Salvando…' : 'Salvar'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
}

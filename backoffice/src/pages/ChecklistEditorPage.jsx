import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { oneDark } from '@codemirror/theme-one-dark';
import jsYaml from 'js-yaml';
import { getChecklistRaw, listChecklists, putChecklist } from '../api/backoffice';
import { NEW_TEMPLATE, TEMPLATES } from '../constants/templates';

// O que o servidor recusa com 422 (domain/checklist/validate.go), conferido
// aqui para apontar o problema antes de salvar.
function validateDef(def) {
    const problems = [];
    if (!def || typeof def !== 'object' || Array.isArray(def)) return ['O YAML precisa ser um objeto com type, title e stages.'];
    const stages = Array.isArray(def.stages) ? def.stages : [];
    if (stages.length === 0) problems.push('É preciso ao menos uma etapa em stages.');
    const stageIds = new Set();
    stages.forEach((st, si) => {
        const where = `Etapa ${si + 1}`;
        if (!st?.id) problems.push(`${where}: falta o id.`);
        else if (stageIds.has(String(st.id))) problems.push(`${where}: id de etapa repetido (${st.id}).`);
        else stageIds.add(String(st.id));
        if (!st?.title) problems.push(`${where}: falta o title.`);
        const itemIds = new Set();
        (Array.isArray(st?.items) ? st.items : []).forEach((it, ii) => {
            const iw = `${where}, item ${ii + 1}`;
            if (!it?.id) problems.push(`${iw}: falta o id.`);
            else if (itemIds.has(String(it.id))) problems.push(`${iw}: id de item repetido na etapa (${it.id}).`);
            else itemIds.add(String(it.id));
            if (!it?.label) problems.push(`${iw}: falta o label.`);
            if (it?.required !== undefined && typeof it.required !== 'boolean') problems.push(`${iw}: required precisa ser true ou false.`);
        });
    });
    return problems;
}

export default function ChecklistEditorPage() {
    const { tenantId, type } = useParams();
    const navigate = useNavigate();
    const isNew = type === 'novo';
    // ?modelo=padrao: tipo novo a partir do modelo padrão (Causa/Prejuízo/Liquidação).
    const [searchParams] = useSearchParams();
    const template = isNew ? TEMPLATES[searchParams.get('modelo')] : null;

    const [content, setContent] = useState(isNew ? (template?.yaml || NEW_TEMPLATE) : '');
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [parseError, setParseError] = useState(null);
    const [preview, setPreview] = useState(null);
    const [showPreview, setShowPreview] = useState(true);
    // Começa vazio mesmo vindo de um modelo: o PUT é upsert, e herdar o
    // identificador do modelo (padrao) faria o tipo novo sobrescrevê-lo.
    const [newTypeName, setNewTypeName] = useState('');

    useEffect(() => {
        if (isNew) return;
        getChecklistRaw(tenantId, type)
            .then(raw => setContent(typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2)))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [tenantId, type, isNew]);

    const handleChange = useCallback((val) => {
        setContent(val);
        setSaveSuccess(false);
        try {
            const parsed = jsYaml.load(val);
            setPreview(parsed);
            setParseError(null);
        } catch (e) {
            setParseError(e.message);
            setPreview(null);
        }
    }, []);

    // Parse initial content for preview
    useEffect(() => {
        if (content) handleChange(content);
    }, []);

    const handleSave = async () => {
        if (parseError) {
            alert('Corrija os erros de YAML antes de salvar.');
            return;
        }
        if (problems.length > 0) {
            alert('Corrija a definição antes de salvar:\n\n' + problems.join('\n'));
            return;
        }
        const finalType = isNew ? newTypeName.trim() : type;
        if (!finalType) {
            alert('Informe o identificador do tipo (ex: rcg_eventos).');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            if (isNew) {
                const existing = await listChecklists(tenantId);
                if ((existing?.data || []).includes(finalType)) {
                    setError(`Já existe um tipo "${finalType}". Escolha outro identificador ou edite o existente.`);
                    return;
                }
            }
            // O YAML do modelo traz type: padrao; o tipo novo leva o próprio nome.
            const body = isNew ? content.replace(/^type:.*$/m, `type: ${finalType}`) : content;
            await putChecklist(tenantId, finalType, body);
            setSaveSuccess(true);
            if (isNew) {
                navigate(`/tenants/${tenantId}/checklists/${encodeURIComponent(finalType)}`, { replace: true });
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const problems = preview && !parseError ? validateDef(preview) : [];

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <Loader2 size={24} className="text-slate-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-3 bg-slate-800 border-b border-slate-700">
                <div className="flex items-center gap-4">
                    <Link
                        to={`/tenants/${tenantId}/checklists`}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={14} />
                        Voltar
                    </Link>
                    <span className="text-slate-600">|</span>
                    {isNew ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Identificador:</span>
                            <input
                                value={newTypeName}
                                onChange={e => setNewTypeName(e.target.value)}
                                placeholder="ex: rcg_eventos"
                                className="bg-slate-700 text-white text-xs px-3 py-1.5 rounded-lg border border-slate-600 focus:outline-none focus:border-slate-400 font-mono w-48"
                            />
                        </div>
                    ) : (
                        <span className="text-white font-mono text-sm font-bold">{type}</span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {parseError && (
                        <span className="flex items-center gap-1.5 text-xs text-red-400">
                            <AlertCircle size={14} />
                            YAML inválido
                        </span>
                    )}
                    {!parseError && problems.length > 0 && (
                        <span className="flex items-center gap-1.5 text-xs text-amber-400">
                            <AlertTriangle size={14} />
                            {problems.length === 1 ? '1 problema na definição' : `${problems.length} problemas na definição`}
                        </span>
                    )}
                    {saveSuccess && !parseError && (
                        <span className="flex items-center gap-1.5 text-xs text-green-400">
                            <CheckCircle2 size={14} />
                            Salvo
                        </span>
                    )}
                    <button
                        onClick={() => setShowPreview(p => !p)}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-700"
                    >
                        {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                        {showPreview ? 'Ocultar preview' : 'Mostrar preview'}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !!parseError || problems.length > 0}
                        className="flex items-center gap-2 bg-white text-slate-900 px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Salvar
                    </button>
                </div>
            </div>

            {error && (
                <div className="px-6 py-2 bg-red-900/30 border-b border-red-800 text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle size={14} />
                    {error}
                </div>
            )}

            {/* Editor + Preview */}
            <div className={`flex-1 flex ${showPreview ? 'divide-x divide-slate-700' : ''}`}>
                <div className={showPreview ? 'w-1/2' : 'w-full'}>
                    <CodeMirror
                        value={content}
                        height="calc(100vh - 56px)"
                        theme={oneDark}
                        extensions={[yaml()]}
                        onChange={handleChange}
                        basicSetup={{
                            lineNumbers: true,
                            foldGutter: true,
                            autocompletion: true,
                        }}
                    />
                </div>

                {showPreview && (
                    <div className="w-1/2 overflow-y-auto bg-slate-50 p-6">
                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Preview</h2>
                        {parseError ? (
                            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-4 font-mono whitespace-pre-wrap">
                                {parseError}
                            </div>
                        ) : preview ? (
                            <div className="space-y-4" data-testid="checklist-preview">
                                {problems.length > 0 && (
                                    <div className="text-amber-800 text-xs bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1" role="alert">
                                        <p className="font-bold">O servidor recusa esta definição:</p>
                                        <ul className="list-disc pl-4 space-y-0.5">
                                            {problems.map(p => <li key={p}>{p}</li>)}
                                        </ul>
                                    </div>
                                )}
                                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de sinistro</p>
                                    <p className="font-black text-slate-900">{preview.title || <span className="text-slate-300">sem título</span>}</p>
                                    <p className="text-xs text-slate-400 font-mono">type: {preview.type} · v{preview.version}</p>
                                    <p className="text-xs text-slate-500 pt-1">Assim ficam as etapas na abertura do sinistro.</p>
                                </div>
                                <ol className="space-y-4">
                                    {(Array.isArray(preview.stages) ? preview.stages : []).map((stage, si) => {
                                        const items = Array.isArray(stage?.items) ? stage.items : [];
                                        return (
                                            <li key={si} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
                                                    <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0">{si + 1}</span>
                                                    <p className="font-bold text-slate-900">{stage?.title || <span className="text-slate-300">sem título</span>}</p>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                        {items.length} {items.length === 1 ? 'item' : 'itens'}
                                                    </span>
                                                </div>
                                                {items.length === 0 ? (
                                                    <p className="px-4 py-4 text-xs text-slate-400">Nenhum item nesta etapa.</p>
                                                ) : (
                                                    <ul className="divide-y divide-slate-50">
                                                        {items.map((item, ii) => {
                                                            const required = item?.required !== false;
                                                            return (
                                                                <li key={ii} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                                                                    <span className="flex-1 text-slate-700">{item?.label || <span className="text-slate-300">sem label</span>}</span>
                                                                    {required ? (
                                                                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">obrigatório</span>
                                                                    ) : (
                                                                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-50 text-slate-400 border border-slate-100">opcional</span>
                                                                    )}
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ol>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
}

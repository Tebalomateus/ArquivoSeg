import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { oneDark } from '@codemirror/theme-one-dark';
import jsYaml from 'js-yaml';
import { getChecklistRaw, putChecklist } from '../api/backoffice';

const NEW_TEMPLATE = `type: novo_tipo
title: "Título da Checklist"
version: "2025.11"
stages:
  - id: etapa_1
    title: "Etapa 1"
    items:
      - id: item_1
        label: "Descrição do item"
      - id: item_2
        label: "Descrição do item"
`;

export default function ChecklistEditorPage() {
    const { tenantId, type } = useParams();
    const navigate = useNavigate();
    const isNew = type === 'novo';

    const [content, setContent] = useState(isNew ? NEW_TEMPLATE : '');
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [parseError, setParseError] = useState(null);
    const [preview, setPreview] = useState(null);
    const [showPreview, setShowPreview] = useState(true);
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
        const finalType = isNew ? newTypeName.trim() : type;
        if (!finalType) {
            alert('Informe o identificador do tipo (ex: rcg_eventos).');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await putChecklist(tenantId, finalType, content);
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
                        disabled={saving || !!parseError}
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
                            <div className="space-y-4">
                                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
                                    <p className="font-black text-slate-900">{preview.title}</p>
                                    <p className="text-xs text-slate-400 font-mono">type: {preview.type} · v{preview.version}</p>
                                </div>
                                {(preview.stages || []).map((stage, si) => (
                                    <div key={si} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                                            <p className="font-bold text-xs text-slate-700 uppercase tracking-widest">{stage.title}</p>
                                        </div>
                                        <div>
                                            {(stage.items || []).map((item, ii) => (
                                                <div key={ii} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${ii < stage.items.length - 1 ? 'border-b border-slate-50' : ''}`}>
                                                    <div className="w-4 h-4 rounded-full border-2 border-slate-200 flex-shrink-0" />
                                                    <span className="text-slate-700">{item.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
}

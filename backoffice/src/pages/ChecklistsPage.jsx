import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ListChecks, Plus, ChevronRight, Loader2, AlertCircle, ArrowLeft, Trash2 } from 'lucide-react';
import { listChecklists, deleteChecklist } from '../api/backoffice';

export default function ChecklistsPage() {
    const { tenantId } = useParams();
    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [deleting, setDeleting] = useState(null);

    const load = () => {
        setLoading(true);
        listChecklists(tenantId)
            .then(res => setTypes(res?.data || []))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [tenantId]);

    const handleDelete = async (type) => {
        if (!confirm(`Excluir checklist "${type}"? Esta ação não pode ser desfeita.`)) return;
        setDeleting(type);
        try {
            await deleteChecklist(tenantId, type);
            setTypes(prev => prev.filter(t => t !== type));
        } catch (err) {
            alert('Erro ao excluir: ' + err.message);
        } finally {
            setDeleting(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-3xl mx-auto">
                <div className="mb-8 flex items-start justify-between">
                    <div>
                        <Link to="/" className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 mb-2 transition-colors">
                            <ArrowLeft size={14} />
                            Empresas
                        </Link>
                        <h1 className="text-2xl font-black text-slate-900">Checklists</h1>
                        <p className="text-slate-500 text-xs mt-1 font-mono">{tenantId}</p>
                    </div>
                    <Link
                        to={`/tenants/${tenantId}/checklists/novo`}
                        className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors"
                    >
                        <Plus size={16} />
                        Nova Checklist
                    </Link>
                </div>

                {loading && (
                    <div className="flex items-center gap-3 text-slate-400 py-12 justify-center">
                        <Loader2 size={20} className="animate-spin" />
                        <span>Carregando...</span>
                    </div>
                )}

                {error && (
                    <div className="flex items-center gap-3 text-red-600 bg-red-50 border border-red-100 rounded-xl p-4">
                        <AlertCircle size={20} />
                        <span>{error}</span>
                    </div>
                )}

                {!loading && !error && types.length === 0 && (
                    <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                        <ListChecks size={40} className="mx-auto mb-3 opacity-40" />
                        <p>Nenhuma checklist cadastrada para esta empresa.</p>
                        <Link
                            to={`/tenants/${tenantId}/checklists/novo`}
                            className="inline-flex items-center gap-2 mt-4 text-sm font-bold text-slate-700 hover:text-slate-900 transition-colors"
                        >
                            <Plus size={14} />
                            Criar a primeira checklist
                        </Link>
                    </div>
                )}

                <div className="space-y-3">
                    {types.map(type => (
                        <div key={type} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-6 py-4">
                            <Link
                                to={`/tenants/${tenantId}/checklists/${encodeURIComponent(type)}`}
                                className="flex items-center gap-4 flex-1 hover:text-slate-600 transition-colors group"
                            >
                                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-slate-800 transition-colors">
                                    <ListChecks size={18} className="text-slate-600 group-hover:text-white transition-colors" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 font-mono">{type}</p>
                                </div>
                                <ChevronRight size={16} className="text-slate-300 ml-auto group-hover:text-slate-600 transition-colors" />
                            </Link>
                            <button
                                onClick={() => handleDelete(type)}
                                disabled={deleting === type}
                                className="ml-4 p-2 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50"
                            >
                                {deleting === type
                                    ? <Loader2 size={16} className="animate-spin" />
                                    : <Trash2 size={16} />
                                }
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

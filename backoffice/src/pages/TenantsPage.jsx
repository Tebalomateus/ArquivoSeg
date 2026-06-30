import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { listTenants } from '../api/backoffice';

export default function TenantsPage() {
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        listTenants()
            .then(res => setTenants(res?.data || []))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-3xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl font-black text-slate-900">Empresas</h1>
                    <p className="text-slate-500 text-sm mt-1">Selecione uma empresa para gerenciar suas checklists.</p>
                </div>

                {loading && (
                    <div className="flex items-center gap-3 text-slate-400 py-12 justify-center">
                        <Loader2 size={20} className="animate-spin" />
                        <span>Carregando empresas...</span>
                    </div>
                )}

                {error && (
                    <div className="flex items-center gap-3 text-red-600 bg-red-50 border border-red-100 rounded-xl p-4">
                        <AlertCircle size={20} />
                        <span>{error}</span>
                    </div>
                )}

                {!loading && !error && tenants.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                        <Building2 size={40} className="mx-auto mb-3 opacity-40" />
                        <p>Nenhuma empresa cadastrada.</p>
                    </div>
                )}

                <div className="space-y-3">
                    {tenants.map(tenant => (
                        <Link
                            key={tenant.id}
                            to={`/tenants/${tenant.id}/checklists`}
                            className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-6 py-4 hover:border-slate-900 hover:shadow-sm transition-all group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-slate-900 transition-colors">
                                    <Building2 size={18} className="text-slate-600 group-hover:text-white transition-colors" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900">{tenant.name}</p>
                                    <p className="text-xs text-slate-400 font-mono">{tenant.id}</p>
                                </div>
                            </div>
                            <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-900 transition-colors" />
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

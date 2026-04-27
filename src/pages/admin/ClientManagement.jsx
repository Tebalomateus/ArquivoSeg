import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Users,
    Building2,
    Search,
    Plus,
    MoreHorizontal,
    ArrowLeft,
    Wallet,
    Mail,
    ShieldCheck,
    Briefcase
} from 'lucide-react';
import { useClaims } from '../../context/ClaimsContext';

export default function ClientManagement() {
    const { clients, clientsLoading, addClientEntity, updateClientEntity, deleteClientEntity, refreshClients } = useClaims();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ name: '', type: 'SEGURADORA', contact: '', billing_method: '' });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const openCreate = () => {
        setEditingId(null);
        setForm({ name: '', type: 'SEGURADORA', contact: '', billing_method: '' });
        setIsModalOpen(true);
    };

    const openEdit = (client) => {
        setEditingId(client.id);
        setForm({
            name: client.name || '',
            type: client.type || 'SEGURADORA',
            contact: client.contact || '',
            billing_method: client.billing_method || client.billingMethod || '',
        });
        setError('');
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
        setForm({ name: '', type: 'SEGURADORA', contact: '', billing_method: '' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.name) { setError('Nome obrigatório.'); return; }
        setSubmitting(true);
        try {
            if (editingId) {
                await updateClientEntity(editingId, form);
            } else {
                await addClientEntity(form);
            }
            closeModal();
        } catch (err) {
            setError(err?.message || 'Falha ao salvar cliente.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Excluir este cliente?')) return;
        try { await deleteClientEntity(id); }
        catch (err) { alert(err?.message || 'Falha ao excluir.'); }
    };

    const filteredClients = useMemo(() => {
        return clients.filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.type.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [clients, searchTerm]);

    return (
        <div className="space-y-8 animate-fade-in relative z-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <Link to="/admin" className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-blue-500 transition-all mb-2 tracking-widest">
                        <ArrowLeft size={16} />
                        Voltar ao Painel
                    </Link>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold text-slate-900 font-display">Gestão de Clientes</h1>
                        {clientsLoading && <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Carregando...</span>}
                        <button onClick={() => refreshClients?.()} className="text-[10px] font-black text-blue-600 hover:underline uppercase tracking-widest">Atualizar</button>
                    </div>
                    <p className="text-slate-500 font-medium">Administre seguradoras, corretoras e níveis de faturamento.</p>
                </div>
                <button
                    onClick={openCreate}
                    className="bg-blue-600 text-white px-6 py-3.5 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center gap-2 group"
                >
                    <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                    Novo Cliente B2B
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-6">
                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                        <Building2 size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seguradoras</p>
                        <h3 className="text-2xl font-black text-slate-900">{clients.filter(c => c.type === 'SEGURADORA').length}</h3>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-6">
                    <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                        <Briefcase size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Corretoras</p>
                        <h3 className="text-2xl font-black text-slate-900">{clients.filter(c => c.type === 'CORRETORA').length}</h3>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-6">
                    <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consultorias/Auditoria</p>
                        <h3 className="text-2xl font-black text-slate-900">{clients.filter(c => c.type === 'AUDITORIA').length}</h3>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between gap-4">
                    <div className="relative group flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Pesquisar por nome ou contato..."
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 transition-all font-bold text-sm"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/50">
                            <tr className="text-left border-b border-slate-100">
                                <th className="p-7 font-black text-slate-400 text-[10px] uppercase tracking-widest">Entidade / Tipo</th>
                                <th className="p-7 font-black text-slate-400 text-[10px] uppercase tracking-widest">Contato / E-mail</th>
                                <th className="p-7 font-black text-slate-400 text-[10px] uppercase tracking-widest">Método de Faturamento</th>
                                <th className="p-7 font-black text-slate-400 text-[10px] uppercase tracking-widest">Status Finan.</th>
                                <th className="p-7"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredClients.map((client) => (
                                <tr key={client.id} className="hover:bg-slate-50/50 transition-all group">
                                    <td className="p-7">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all font-black">
                                                {client.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900 text-base">{client.name}</p>
                                                <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">{client.type}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-7">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                            <Mail size={14} className="text-slate-300" /> {client.contact}
                                        </div>
                                    </td>
                                    <td className="p-7">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 w-fit px-3 py-1.5 rounded-lg border border-slate-100">
                                            <Wallet size={14} className="text-emerald-500" /> {client.billing_method || client.billingMethod || '-'}
                                        </div>
                                    </td>
                                    <td className="p-7">
                                        <span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${client.status === 'Ativo' || client.status === 'Adimplente' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                            }`}>
                                            {client.status}
                                        </span>
                                    </td>
                                    <td className="p-7 text-right">
                                        <div className="flex justify-end gap-3">
                                            <button onClick={() => openEdit(client)} className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800">Editar</button>
                                            <button onClick={() => handleDelete(client.id)} className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-700">Excluir</button>
                                        </div>
                                    </td>
                                    <td className="p-7 text-right">
                                        <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-100 shadow-sm">
                                            <MoreHorizontal size={20} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeModal}>
                    <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black text-gray-900 font-display">{editingId ? 'Editar Cliente B2B' : 'Novo Cliente B2B'}</h3>
                        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nome *</label>
                                <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 mt-1" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tipo *</label>
                                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 mt-1 bg-white">
                                    <option value="SEGURADORA">Seguradora</option>
                                    <option value="CORRETORA">Corretora</option>
                                    <option value="AUDITORIA">Auditoria</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Contato</label>
                                <input type="text" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} placeholder="email, telefone ou nome" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 mt-1" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Método de cobrança</label>
                                <input type="text" value={form.billing_method} onChange={e => setForm({ ...form, billing_method: e.target.value })} placeholder="Boleto, PIX, Cartão..." className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 mt-1" />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={closeModal} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold">Cancelar</button>
                                <button type="submit" disabled={submitting} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50">{submitting ? 'Salvando...' : (editingId ? 'Salvar' : 'Criar')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

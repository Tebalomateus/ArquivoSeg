import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserPlus, Shield, Mail, MoreHorizontal, Building2, Search, X, CheckCircle, Lock, ArrowLeft } from 'lucide-react';
import { useClaims } from '../context/ClaimsContext';

const InviteModal = ({ isOpen, onClose, onInvite }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [company, setCompany] = useState('');
    const [role, setRole] = useState('CORRETOR');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onInvite({ name, email, company, role });
        setName('');
        setEmail('');
        setCompany('');
        setRole('CORRETOR');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-fade-in border border-gray-100">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 font-display">Convidar Colaborador</h3>
                        <p className="text-xs text-gray-500 font-medium">O novo usuário receberá um convite por e-mail.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-gray-400 transition-all border border-transparent hover:border-gray-100"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Nome Completo</label>
                        <input
                            required
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex: João Silva"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-300 transition-all font-bold text-gray-900 shadow-inner"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">E-mail Corporativo</label>
                        <input
                            required
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="ex: joao@empresa.com"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-300 transition-all font-bold text-gray-900 shadow-inner"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Empresa</label>
                            <input
                                required
                                type="text"
                                value={company}
                                onChange={(e) => setCompany(e.target.value)}
                                placeholder="Porto Seguro, ABC..."
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-300 transition-all font-bold text-gray-900 shadow-inner"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Papel (Role)</label>
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-300 transition-all font-bold text-gray-900 appearance-none shadow-inner"
                            >
                                <option value="ADMIN">Admin da Conta</option>
                                <option value="ANALISTA">Admin do Sinistro</option>
                                <option value="CORRETOR">Tipo 1 (Externo)</option>
                                <option value="PERITO">Tipo 2 (Interno/Técnico)</option>
                                <option value="AUDITOR">Auditor de Sistema</option>
                            </select>
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2 mt-4"
                    >
                        <CheckCircle size={20} />
                        Gerar Convite de Acesso
                    </button>
                </form>
            </div>
        </div>
    );
};

// Maps backend role (viewer/contributor/manager/admin) to the PT-BR label used in the UI.
const BACK_TO_UI_ROLE = {
    admin: 'ADMIN',
    manager: 'CORRETOR',
    contributor: 'PERITO',
    viewer: 'ANALISTA',
};

const adaptBackendUser = (u) => ({
    id: u.id,
    name: u.email?.split('@')[0] || 'Usuário',
    email: u.email,
    company: u.email?.split('@')[1] || '-',
    role: BACK_TO_UI_ROLE[u.role] || u.role.toUpperCase(),
    status: 'Ativo',
    backRole: u.role,
});

export default function UserManagement() {
    const { backendUsers, usersLoading, refreshUsers } = useClaims();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Source of truth is the backend listing for managers+; if it's empty
    // (e.g. lower-privilege session) the table shows nothing real.
    const displayUsers = (backendUsers || []).map(adaptBackendUser);

    const filteredUsers = displayUsers.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.company.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const roles = [
        { name: 'Admin da Conta', desc: 'Dono da conta. Gestão de faturamento, usuários e logs totais.', color: 'border-purple-200 bg-purple-50 text-purple-700' },
        { name: 'Admin do Sinistro', desc: 'Gestão operacional de processos, SLAs e documentação.', color: 'border-blue-200 bg-blue-50 text-blue-700' },
        { name: 'Tipo 1 (Externo)', desc: 'Corretores e Segurados. Upload de documentos e acompanhamento.', color: 'border-green-200 bg-green-50 text-green-700' },
        { name: 'Tipo 2 (Técnico)', desc: 'Peritos e Reguladores. Acesso total a pastas técnicas e sigilosas.', color: 'border-amber-200 bg-amber-50 text-amber-700' },
        { name: 'Auditor de Sistema', desc: 'Foco em integridade e auditoria (Tokio Marine). Sem acesso a conteúdo.', color: 'border-slate-200 bg-slate-50 text-slate-700' },
    ];

    return (
        <div className="space-y-8 animate-fade-in relative z-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <Link to="/" className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400 hover:text-blue-600 transition-all mb-2 tracking-widest">
                        <ArrowLeft size={16} />
                        Voltar ao Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900 font-display">Gestão de Usuários</h1>
                    <p className="text-gray-500 font-medium">Controle permissões e acessos por papel (RBAC).</p>
                </div>
                <div className="flex items-center gap-3">
                    {usersLoading && <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Carregando...</span>}
                    <button onClick={() => refreshUsers?.()} className="bg-white text-gray-600 px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold uppercase tracking-wider hover:bg-gray-50">
                        Atualizar
                    </button>
                    <button
                        disabled
                        title="Convites devem ser feitos no console do Zitadel (http://localhost:8081)"
                        className="bg-gray-200 text-gray-400 px-6 py-3 rounded-xl font-bold cursor-not-allowed flex items-center gap-2"
                    >
                        <UserPlus size={20} />
                        Convidar Usuário
                    </button>
                </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
                <Lock size={18} className="text-amber-600 mt-0.5 shrink-0" />
                <div>
                    <p className="text-sm font-bold text-amber-800">Lista vinda do backend (Zitadel + tabela `users`)</p>
                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                        Esta tela é <strong>somente leitura</strong>. Convites e mudanças de papel exigem o console do Zitadel em <code>http://localhost:8081</code>, porque a permissão real é definida pela claim do JWT — alterar a coluna <code>users.role</code> no banco não muda o acesso.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {roles.map((role) => (
                    <div key={role.name} className={`p-4 rounded-2xl border-2 ${role.color} h-full flex flex-col shadow-sm transition-all hover:scale-[1.02] cursor-default`}>
                        <div className="flex items-center gap-2 mb-2">
                            <Shield size={14} />
                            <h4 className="font-bold text-[10px] uppercase tracking-tighter">{role.name}</h4>
                        </div>
                        <p className="text-[10px] opacity-80 leading-relaxed font-bold">{role.desc}</p>
                    </div>
                ))}
            </div>

            <div className="card">
                <div className="flex flex-col md:flex-row gap-4 mb-8">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar por nome, email ou empresa..."
                            className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-300 transition-all font-bold text-sm shadow-inner"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left border-b border-gray-100">
                                <th className="pb-5 font-bold text-gray-400 text-[10px] uppercase tracking-widest pl-2">Usuário</th>
                                <th className="pb-5 font-bold text-gray-400 text-[10px] uppercase tracking-widest">Empresa</th>
                                <th className="pb-5 font-bold text-gray-400 text-[10px] uppercase tracking-widest">Papel</th>
                                <th className="pb-5 font-bold text-gray-400 text-[10px] uppercase tracking-widest">Status</th>
                                <th className="pb-5 text-right pr-2"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-blue-50/30 transition-all group">
                                    <td className="py-5 pl-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white border border-gray-100 text-blue-600 rounded-full flex items-center justify-center font-black text-xs shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">
                                                {user.name.split(' ').map(n => n[0]).join('')}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 text-sm tracking-tight">{user.name}</p>
                                                <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                                                    <Mail size={10} /> {user.email}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-5">
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-600 bg-white border border-gray-100 w-fit px-3 py-1 rounded-lg shadow-sm">
                                            <Building2 size={12} className="text-blue-500" />
                                            {user.company}
                                        </div>
                                    </td>
                                    <td className="py-5">
                                        <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                                            user.role === 'PERITO' ? 'bg-amber-100 text-amber-700' :
                                                user.role === 'AUDITOR' ? 'bg-slate-100 text-slate-700' :
                                                    'bg-blue-100 text-blue-700'
                                            }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="py-5">
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-50 text-green-700 w-fit ring-4 ring-green-100">
                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                            <span className="text-[9px] font-black uppercase tracking-widest">{user.status}</span>
                                        </div>
                                    </td>
                                    <td className="py-5 text-right pr-2">
                                        <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100 shadow-sm">
                                            <MoreHorizontal size={20} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <InviteModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onInvite={addUser}
            />
        </div>
    );
}

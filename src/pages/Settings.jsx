import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Bell, Key, Database, Mail, Clock, CheckCircle, Save, ArrowLeft, ExternalLink, Server, Lock, FileCheck, AlertTriangle } from 'lucide-react';
import { useClaims } from '../context/ClaimsContext';

const formatBytes = (n) => {
    if (!n || Number.isNaN(n)) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
};

export default function Settings() {
    const { settings, updateSettings, claims, backendUsers } = useClaims();
    const [localSettings, setLocalSettings] = useState(settings);
    const [activeSection, setActiveSection] = useState('Notificações');
    const [healthOk, setHealthOk] = useState(null);

    useEffect(() => {
        if (settings) {
            setLocalSettings(settings);
        }
    }, [settings]);

    useEffect(() => {
        const check = async () => {
            try {
                const res = await fetch('/health/ready');
                setHealthOk(res.ok);
            } catch { setHealthOk(false); }
        };
        check();
        const t = setInterval(check, 30000);
        return () => clearInterval(t);
    }, []);

    // Aggregations for Storage & Backup tab
    const storage = useMemo(() => {
        let totalDocs = 0;
        let totalSize = 0;
        let totalVersions = 0;
        for (const c of claims) {
            for (const f of c.folders || []) {
                for (const d of f.documents || []) {
                    if (!d.backFileVerId) continue;
                    totalDocs++;
                    totalSize += Number(d.size_bytes || 0);
                    totalVersions += Number(d.backVersion || 1);
                }
            }
        }
        return { totalDocs, totalSize, totalVersions };
    }, [claims]);

    const handleSave = () => {
        updateSettings(localSettings);
        alert('Configurações atualizadas com sucesso!');
    };

    const sections = [
        { title: 'Segurança', icon: Shield, desc: 'Políticas de 2FA e RBAC (Auditor).' },
        { title: 'Notificações', icon: Bell, desc: 'Frequência de alertas e relatórios.' },
        { title: 'Integrações', icon: Key, desc: 'Configurar APIs e conexões externas.' },
        { title: 'Storage & Backup', icon: Database, desc: 'Limites e retenção (Lei 15.040).' },
        { title: 'Templates de Email', icon: Mail, desc: 'Personalizar avisos automáticos.' },
    ];

    const intervals = [
        { id: '1h', label: '1 Hora', desc: 'Alertas em tempo quase real.' },
        { id: '3h', label: '3 Horas', desc: 'Equilíbrio entre foco e alerta.' },
        { id: '6h', label: '6 Horas', desc: 'Resumo por turno de trabalho.' },
        { id: 'diario', label: 'Diário', desc: 'Consolidado ao final do dia.' },
    ];

    return (
        <div className="space-y-8 max-w-5xl animate-fade-in relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <Link to="/" className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400 hover:text-blue-600 transition-all mb-2 tracking-widest">
                        <ArrowLeft size={16} />
                        Voltar ao Dashboard
                    </Link>
                    <h1 className="text-3xl font-black text-gray-900 font-display tracking-tight uppercase">Configurações Globais</h1>
                    <p className="text-gray-500 font-medium">Ajuste os parâmetros operacionais e de segurança do ecossistema.</p>
                </div>
                <button
                    onClick={handleSave}
                    className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center gap-2"
                >
                    <Save size={18} />
                    Salvar Mudanças
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Menu Lateral */}
                <div className="lg:col-span-1 space-y-2">
                    {sections.map((section) => (
                        <button
                            key={section.title}
                            onClick={() => setActiveSection(section.title)}
                            className={`w-full flex flex-col p-4 rounded-2xl transition-all border text-left group ${activeSection === section.title
                                ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-100'
                                : 'bg-white border-gray-100 hover:border-blue-200 hover:bg-blue-50/10'
                                }`}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`p-2 rounded-lg transition-colors ${activeSection === section.title ? 'bg-white/20' : 'bg-gray-50 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                                    <section.icon size={18} />
                                </div>
                                <span className={`font-black text-[10px] uppercase tracking-widest ${activeSection === section.title ? 'text-white' : 'text-gray-900'}`}>{section.title}</span>
                            </div>
                            <p className={`text-[10px] font-bold leading-relaxed ${activeSection === section.title ? 'text-blue-100' : 'text-gray-400'}`}>{section.desc}</p>
                        </button>
                    ))}
                </div>

                {/* Conteúdo Central */}
                <div className="lg:col-span-3">
                    <div className="card h-full min-h-[500px] border-gray-100 shadow-2xl shadow-gray-100 relative overflow-hidden">
                        {activeSection === 'Notificações' && (
                            <div className="space-y-10 animate-fade-in">
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 font-display uppercase tracking-tight flex items-center gap-3 mb-2">
                                        <Clock size={24} className="text-blue-600" /> Frequência de Alertas
                                    </h3>
                                    <p className="text-sm text-gray-500 font-medium">Defina com que frequência o time deve receber notificações por e-mail sobre atualizações nos sinistros.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {intervals.map((interval) => (
                                        <button
                                            key={interval.id}
                                            onClick={() => setLocalSettings({ ...localSettings, notificationInterval: interval.id })}
                                            className={`p-6 rounded-2xl border-2 transition-all flex flex-col text-left group
                                                ${localSettings.notificationInterval === interval.id
                                                    ? 'border-blue-600 bg-blue-50/50 shadow-inner'
                                                    : 'border-gray-50 bg-gray-50/30 hover:border-blue-100 hover:bg-white'}
                                            `}
                                        >
                                            <div className="flex justify-between items-center mb-3">
                                                <span className={`font-black text-xs uppercase tracking-widest ${localSettings.notificationInterval === interval.id ? 'text-blue-700' : 'text-gray-900'}`}>
                                                    {interval.label}
                                                </span>
                                                {localSettings.notificationInterval === interval.id && (
                                                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg">
                                                        <CheckCircle size={14} />
                                                    </div>
                                                )}
                                            </div>
                                            <p className={`text-[10px] font-bold uppercase tracking-tight ${localSettings.notificationInterval === interval.id ? 'text-blue-600' : 'text-gray-400'}`}>
                                                {interval.desc}
                                            </p>
                                        </button>
                                    ))}
                                </div>

                                <div className="pt-10 border-t border-gray-100">
                                    <div className="flex items-start justify-between p-6 bg-slate-900 rounded-2xl shadow-2xl shadow-slate-200">
                                        <div className="space-y-1">
                                            <h4 className="text-white font-black text-sm uppercase tracking-widest">Relatório Semanal Consolidado</h4>
                                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-tight">Enviado todas as segundas-feiras às 08h00.</p>
                                        </div>
                                        <button
                                            onClick={() => setLocalSettings({ ...localSettings, weeklyReport: !localSettings.weeklyReport })}
                                            className={`w-14 h-8 rounded-full transition-all relative ${localSettings.weeklyReport ? 'bg-blue-600' : 'bg-slate-700'}`}
                                        >
                                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-lg ${localSettings.weeklyReport ? 'right-1' : 'left-1'}`}></div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'Segurança' && (
                            <div className="space-y-8 animate-fade-in">
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 font-display uppercase tracking-tight flex items-center gap-3 mb-2">
                                        <Shield size={24} className="text-blue-600" /> Segurança da Plataforma
                                    </h3>
                                    <p className="text-sm text-gray-500 font-medium">Controles ativos no backend ArquivoSeg.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-5 rounded-2xl border-2 border-green-100 bg-green-50/30">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Lock size={18} className="text-green-600" />
                                            <span className="text-xs font-black uppercase tracking-widest text-green-700">Multi-tenant RLS</span>
                                        </div>
                                        <p className="text-[11px] text-green-800/70 font-medium leading-relaxed">
                                            Postgres Row-Level Security ativo em todas as tabelas. <code className="font-mono">app.current_tenant_id</code> definido por request via JWT.
                                        </p>
                                    </div>
                                    <div className="p-5 rounded-2xl border-2 border-green-100 bg-green-50/30">
                                        <div className="flex items-center gap-3 mb-2">
                                            <FileCheck size={18} className="text-green-600" />
                                            <span className="text-xs font-black uppercase tracking-widest text-green-700">Audit append-only</span>
                                        </div>
                                        <p className="text-[11px] text-green-800/70 font-medium leading-relaxed">
                                            <code className="font-mono">REVOKE UPDATE, DELETE ON audit_logs FROM app</code>. Adulteração da trilha exige acesso ao DB admin.
                                        </p>
                                    </div>
                                    <div className="p-5 rounded-2xl border-2 border-blue-100 bg-blue-50/30">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Key size={18} className="text-blue-600" />
                                            <span className="text-xs font-black uppercase tracking-widest text-blue-700">OIDC + Zitadel</span>
                                        </div>
                                        <p className="text-[11px] text-blue-800/70 font-medium leading-relaxed">
                                            Autenticação via Personal Access Tokens, com introspection contra Zitadel. Senhas e MFA gerenciados pelo IdP.
                                        </p>
                                    </div>
                                    <div className="p-5 rounded-2xl border-2 border-blue-100 bg-blue-50/30">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Database size={18} className="text-blue-600" />
                                            <span className="text-xs font-black uppercase tracking-widest text-blue-700">RBAC hierárquico</span>
                                        </div>
                                        <p className="text-[11px] text-blue-800/70 font-medium leading-relaxed">
                                            <code className="font-mono">viewer &lt; contributor &lt; manager &lt; admin</code>. Enforcement no middleware <code className="font-mono">RequireRole</code>.
                                        </p>
                                    </div>
                                </div>

                                <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                                    <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold text-amber-800">2FA, política de senha e sessões</p>
                                        <p className="text-[11px] text-amber-800/80 font-medium mt-1 leading-relaxed">
                                            São configurados no console do Zitadel — não nesta tela. Acesse <code className="font-mono">http://localhost:8081</code>.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'Integrações' && (
                            <div className="space-y-8 animate-fade-in">
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 font-display uppercase tracking-tight flex items-center gap-3 mb-2">
                                        <Key size={24} className="text-blue-600" /> Integrações
                                    </h3>
                                    <p className="text-sm text-gray-500 font-medium">Serviços externos que o ArquivoSeg consome.</p>
                                </div>

                                <div className="space-y-3">
                                    {[
                                        { name: 'PostgreSQL 16', purpose: 'Persistência multi-tenant com RLS', status: healthOk, link: null },
                                        { name: 'MinIO (S3)', purpose: 'Storage de arquivos com presigned URLs', status: healthOk, link: 'http://localhost:9001' },
                                        { name: 'Zitadel OIDC', purpose: 'Identity provider e token introspection', status: healthOk, link: 'http://localhost:8081' },
                                    ].map((svc) => (
                                        <div key={svc.name} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-2.5 h-2.5 rounded-full ${svc.status === null ? 'bg-slate-300' : svc.status ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-gray-900">{svc.name}</p>
                                                    <p className="text-[11px] text-gray-500 font-medium">{svc.purpose}</p>
                                                </div>
                                            </div>
                                            {svc.link && (
                                                <a href={svc.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline">
                                                    Console <ExternalLink size={12} />
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <p className="text-[11px] text-gray-400 font-medium leading-relaxed">
                                    Status atualizado a cada 30s via <code className="font-mono">/health/ready</code> (verifica DB + S3 simultaneamente).
                                </p>
                            </div>
                        )}

                        {activeSection === 'Storage & Backup' && (
                            <div className="space-y-8 animate-fade-in">
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 font-display uppercase tracking-tight flex items-center gap-3 mb-2">
                                        <Database size={24} className="text-blue-600" /> Storage & Backup
                                    </h3>
                                    <p className="text-sm text-gray-500 font-medium">Volume armazenado e política de retenção.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-5 rounded-2xl bg-blue-50 border border-blue-100">
                                        <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Documentos ativos</p>
                                        <p className="text-3xl font-black text-blue-900 mt-1">{storage.totalDocs}</p>
                                    </div>
                                    <div className="p-5 rounded-2xl bg-purple-50 border border-purple-100">
                                        <p className="text-[10px] font-black text-purple-700 uppercase tracking-widest">Versões totais</p>
                                        <p className="text-3xl font-black text-purple-900 mt-1">{storage.totalVersions}</p>
                                    </div>
                                    <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100">
                                        <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Espaço usado</p>
                                        <p className="text-3xl font-black text-emerald-900 mt-1">{formatBytes(storage.totalSize)}</p>
                                    </div>
                                </div>

                                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">Política de retenção</h4>
                                    <ul className="text-[11px] text-slate-600 font-medium space-y-1.5 leading-relaxed">
                                        <li>• Versões antigas mantidas indefinidamente (soft-delete em <code className="font-mono">deleted_at</code>).</li>
                                        <li>• Audit log preservado por 5 anos (Lei do Seguro / SUSEP).</li>
                                        <li>• Backup do Postgres é responsabilidade da infraestrutura (RDS / cron).</li>
                                        <li>• MinIO/S3 com versionamento por chave; cada upload do mesmo arquivo cria nova versão lógica.</li>
                                    </ul>
                                </div>
                            </div>
                        )}

                        {activeSection === 'Templates de Email' && (
                            <div className="space-y-8 animate-fade-in">
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 font-display uppercase tracking-tight flex items-center gap-3 mb-2">
                                        <Mail size={24} className="text-blue-600" /> Templates de Email
                                    </h3>
                                    <p className="text-sm text-gray-500 font-medium">Modelos de notificação automática.</p>
                                </div>

                                <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                                    <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold text-amber-800">Disparo de email não está no escopo do back atual</p>
                                        <p className="text-[11px] text-amber-800/80 font-medium mt-1 leading-relaxed">
                                            O backend ArquivoSeg apenas registra eventos no audit log. Notificações por email são tratadas externamente (Zitadel para identidade; SES/SendGrid para domínio operacional, em produção).
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {[
                                        { id: 'sla', name: 'SLA SUSEP em risco', desc: 'Disparado quando faltam 5 dias para os 30d e o sinistro não foi liquidado.' },
                                        { id: 'assigned', name: 'Sinistro atribuído', desc: 'Avisa o responsável recém-designado.' },
                                        { id: 'document', name: 'Novo documento anexado', desc: 'Notifica gestores de sinistro sobre uploads.' },
                                        { id: 'share-access', name: 'Link público acessado', desc: 'Avisa o criador do share quando o portal externo é aberto.' },
                                    ].map((t) => (
                                        <div key={t.id} className="p-4 bg-white border border-gray-100 rounded-2xl">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-gray-900">{t.name}</p>
                                                    <p className="text-[11px] text-gray-500 font-medium mt-0.5">{t.desc}</p>
                                                </div>
                                                <span className="text-[9px] font-black px-2 py-1 rounded-md bg-slate-100 text-slate-500 uppercase tracking-widest shrink-0">Read-only</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="pt-8 border-t border-gray-100">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-4 ml-1">Ambiente de Operação</h3>
                <div className="card bg-gray-50/50 border-gray-100">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        <div>
                            <p className="text-[9px] text-gray-400 font-black uppercase mb-1 tracking-widest">Versão Core</p>
                            <p className="text-xs font-black text-gray-700 tracking-tight">POC v0.2.0 (MEETING 3)</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-gray-400 font-black uppercase mb-1 tracking-widest">Infraestrutura</p>
                            <p className="text-xs font-black text-blue-600 tracking-tight flex items-center gap-1.5 uppercase">
                                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-sm shadow-blue-200"></span>
                                AWS Cloud Provisioned
                            </p>
                        </div>
                        <div>
                            <p className="text-[9px] text-gray-400 font-black uppercase mb-1 tracking-widest">Sincronização</p>
                            <p className="text-xs font-black text-gray-700 tracking-tight uppercase">Real-time (Active)</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-gray-400 font-black uppercase mb-1 tracking-widest">Security Audit</p>
                            <p className="text-xs font-black text-green-600 tracking-tight flex items-center gap-1.5 uppercase">
                                <span className="w-2 h-2 bg-green-500 rounded-full shadow-sm shadow-green-100"></span>
                                Compliant
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

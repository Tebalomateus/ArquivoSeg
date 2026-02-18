import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Bell, Key, Database, Mail, Clock, Calendar, CheckCircle, Save, Trash2, ShieldAlert, ArrowLeft } from 'lucide-react';
import { useClaims } from '../context/ClaimsContext';

export default function Settings() {
    const { settings, updateSettings } = useClaims();
    const [localSettings, setLocalSettings] = useState(settings);
    const [activeSection, setActiveSection] = useState('Notificações');

    useEffect(() => {
        if (settings) {
            setLocalSettings(settings);
        }
    }, [settings]);

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

                        {activeSection !== 'Notificações' && (
                            <div className="py-24 text-center flex flex-col items-center animate-fade-in">
                                <ShieldAlert size={64} className="text-gray-100 mb-6" />
                                <h4 className="text-xl font-black text-gray-300 uppercase tracking-[0.2em]">Seção em Construção</h4>
                                <p className="text-gray-200 text-xs font-bold uppercase mt-2 tracking-widest">Disponível na próxima iteração da POC</p>
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

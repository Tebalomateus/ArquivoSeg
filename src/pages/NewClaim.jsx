import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, X, Plus, Trash2, Shield, Info, Link as LinkIcon, Share2, Building2, User, FileText, Calendar, MapPin, Briefcase, ArrowLeft } from 'lucide-react';
import { useClaims } from '../context/ClaimsContext';
import { GENERAL_CHECKLIST } from '../constants/config';

// Configuração de Seguradoras e Modalidades com suas listas de documentos padrão
const INSURERS_CONFIG = {
    'Porto Seguro': {
        id: 'porto',
        modalities: {
            'Incêndio': [
                { name: 'Laudo do Corpo de Bombeiros', folder: 'Causa', required: true },
                { name: 'Boletim de Ocorrência', folder: 'Causa', required: true },
                { name: 'Fotos do Local', folder: 'Causa', required: true },
                { name: 'Planilha de Bens Danificados', folder: 'Prejuízo', required: true },
                { name: 'Notas Fiscais dos Bens', folder: 'Prejuízo', required: true },
                { name: 'Orçamentos de Reparo (3x)', folder: 'Prejuízo', required: true },
            ],
            'Roubo/Furto': [
                { name: 'Boletim de Ocorrência', folder: 'Causa', required: true },
                { name: 'Manifesto de Carga', folder: 'Causa', required: true },
                { name: 'CNH do Motorista', folder: 'Causa', required: true },
                { name: 'Notas Fiscais da Carga', folder: 'Prejuízo', required: true },
                { name: 'Relatório de Rastreamento', folder: 'Causa', required: false },
            ],
            'Colisão Veicular': [
                { name: 'B.O do Acidente', folder: 'Causa', required: true },
                { name: 'CNH do Condutor', folder: 'Causa', required: true },
                { name: 'Fotos do Veículo', folder: 'Causa', required: true },
                { name: 'Orçamentos (3x)', folder: 'Prejuízo', required: true },
            ],
        }
    },
    'Allianz': {
        id: 'allianz',
        modalities: {
            'Alagamento': [
                { name: 'Laudo Técnico Municipal', folder: 'Causa', required: true },
                { name: 'Documentos do Imóvel', folder: 'Causa', required: true },
                { name: 'Fotos do Alagamento', folder: 'Causa', required: true },
                { name: 'Relatório de Máquinas Danificadas', folder: 'Prejuízo', required: true },
                { name: 'Inventário de Estoque', folder: 'Prejuízo', required: true },
            ],
            'Vendaval': [
                { name: 'Laudo Meteorológico', folder: 'Causa', required: true },
                { name: 'Fotos dos Danos', folder: 'Causa', required: true },
                { name: 'Orçamentos de Reparo', folder: 'Prejuízo', required: true },
            ],
        }
    },
    'Tokio Marine': {
        id: 'tokio',
        modalities: {
            'Responsabilidade Civil': [
                { name: 'Documentação do Reclamante', folder: 'Causa', required: true },
                { name: 'Laudo Pericial', folder: 'Causa', required: true },
                { name: 'Comprovantes de Danos', folder: 'Prejuízo', required: true },
            ],
            'Riscos Ambientais': [
                { name: 'Laudo Ambiental', folder: 'Causa', required: true },
                { name: 'Relatório de Impacto', folder: 'Causa', required: true },
                { name: 'Licenças Ambientais', folder: 'Causa', required: true },
                { name: 'Custos de Remediação', folder: 'Prejuízo', required: true },
                { name: 'Plano de Ação Corretiva', folder: 'Prejuízo', required: true },
            ],
            'D&O': [
                { name: 'Notificação/Citação', folder: 'Causa', required: true },
                { name: 'Procuração', folder: 'Causa', required: true },
                { name: 'Custos de Defesa', folder: 'Prejuízo', required: true },
            ],
        }
    },
    'Bradesco Seguros': {
        id: 'bradesco',
        modalities: {
            'Frota': [
                { name: 'B.O do Acidente', folder: 'Causa', required: true },
                { name: 'CNH do Condutor', folder: 'Causa', required: true },
                { name: 'CRLV do Veículo', folder: 'Causa', required: true },
                { name: 'Orçamentos (3x)', folder: 'Prejuízo', required: true },
            ],
            'Empresarial': [
                { name: 'Contrato Social', folder: 'Causa', required: true },
                { name: 'Laudo Pericial', folder: 'Causa', required: true },
                { name: 'Inventário de Bens', folder: 'Prejuízo', required: true },
            ],
        }
    },
    'SulAmérica': {
        id: 'sulamerica',
        modalities: {
            'Incêndio': [
                { name: 'Laudo do Corpo de Bombeiros', folder: 'Causa', required: true },
                { name: 'Boletim de Ocorrência', folder: 'Causa', required: true },
                { name: 'Planilha de Bens', folder: 'Prejuízo', required: true },
            ],
            'Equipamentos': [
                { name: 'Termo de Vistoria', folder: 'Causa', required: true },
                { name: 'Nota Fiscal do Equipamento', folder: 'Prejuízo', required: true },
                { name: 'Orçamento de Reparo/Substituição', folder: 'Prejuízo', required: true },
            ],
        }
    },
};

export default function NewClaim() {
    const navigate = useNavigate();
    const { addClaim, clients } = useClaims();

    // Combine hardcoded config (which provides modality templates) with the
    // tenant's registered insurers/brokers from the backend clients API.
    const apiInsurerNames = (clients || [])
        .filter(c => c.type === 'SEGURADORA')
        .map(c => c.name);
    const apiBrokerNames = (clients || [])
        .filter(c => c.type === 'CORRETORA')
        .map(c => c.name);
    const insurerOptions = Array.from(new Set([
        ...Object.keys(INSURERS_CONFIG),
        ...apiInsurerNames,
    ])).sort((a, b) => a.localeCompare(b));

    // Informações da Apólice
    const [claimNumber, setClaimNumber] = useState('');
    const [insurer, setInsurer] = useState('');
    const [customInsurer, setCustomInsurer] = useState('');
    const [policyNumber, setPolicyNumber] = useState('');
    const [policyStartDate, setPolicyStartDate] = useState('');
    const [policyEndDate, setPolicyEndDate] = useState('');
    const [retroactiveDate, setRetroactiveDate] = useState('');
    const [modality, setModality] = useState('');
    const [customModality, setCustomModality] = useState('');

    // Informações do Segurado
    const [insuredName, setInsuredName] = useState('');
    const [brokerName, setBrokerName] = useState('');
    const [brokerClaimId, setBrokerClaimId] = useState('');

    // Informações do Prestador
    const [adjusterName, setAdjusterName] = useState('');
    const [adjusterClaimId, setAdjusterClaimId] = useState('');

    // Informações do Sinistro
    const [title, setTitle] = useState('');
    const [occurrenceDate, setOccurrenceDate] = useState('');
    const [occurrenceLocation, setOccurrenceLocation] = useState('');
    const [description, setDescription] = useState('');

    // Checklist dinâmico
    const [checklist, setChecklist] = useState([]);

    const isCustomInsurer = insurer === '__other__';
    const effectiveInsurer = isCustomInsurer ? customInsurer : insurer;

    // Modalidades disponíveis baseadas na seguradora selecionada
    const availableModalities = useMemo(() => {
        if (!insurer || isCustomInsurer || !INSURERS_CONFIG[insurer]) return [];
        return Object.keys(INSURERS_CONFIG[insurer].modalities);
    }, [insurer, isCustomInsurer]);

    const isCustomModality = modality === '__other__';
    const effectiveModality = isCustomModality ? customModality : modality;

    // Quando seguradora ou modalidade mudam, atualizar checklist
    const handleInsurerChange = (value) => {
        setInsurer(value);
        setCustomInsurer('');
        setModality('');
        setCustomModality('');
        setChecklist([]);
    };

    const buildChecklist = (modalityDocs) => {
        const allDocs = [...GENERAL_CHECKLIST, ...(modalityDocs || [])];
        return allDocs.map((doc, idx) => ({ id: Date.now() + idx, ...doc, received: false }));
    };

    const handleModalityChange = (value) => {
        setModality(value);
        setCustomModality('');
        if (value === '__other__') {
            setChecklist(buildChecklist([]));
        } else if (insurer && value && INSURERS_CONFIG[insurer]?.modalities[value]) {
            setChecklist(buildChecklist(INSURERS_CONFIG[insurer].modalities[value]));
        } else {
            setChecklist([]);
        }
    };

    const addDoc = () => {
        setChecklist([...checklist, { id: Date.now(), name: '', folder: 'Causa', required: true, received: false }]);
    };

    const removeDoc = (id) => {
        setChecklist(checklist.filter(item => item.id !== id));
    };

    const handleSave = () => {
        if (!claimNumber) {
            alert('O número do sinistro é obrigatório!');
            return;
        }
        if (!effectiveInsurer) {
            alert('Selecione ou digite uma seguradora!');
            return;
        }
        if (!insuredName) {
            alert('O nome do segurado é obrigatório!');
            return;
        }

        const newClaimId = addClaim({
            number: claimNumber,
            title: title || `Sinistro ${claimNumber}`,
            insurer: effectiveInsurer,
            insuredName,
            policyNumber,
            policyStartDate,
            policyEndDate,
            retroactiveDate,
            modality: effectiveModality,
            brokerName,
            brokerClaimId,
            adjusterName,
            adjusterClaimId,
            occurrenceDate,
            occurrenceLocation,
            description,
            initialChecklist: checklist
        });

        // Relative navigation works under both /app/sinistros/novo and /admin/sinistros/novo.
        navigate(`../${newClaimId}`);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-20 relative z-10">
            <div className="flex items-center justify-between">
                <div>
                    <Link to=".." className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400 hover:text-blue-600 transition-all mb-2 tracking-widest">
                        <ArrowLeft size={16} />
                        Voltar para Sinistros
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900 font-display">Abrir Novo Sinistro</h1>
                    <p className="text-gray-500">Cadastre os dados do sinistro conforme informações da seguradora.</p>
                </div>
                <button
                    onClick={() => navigate('..')}
                    className="p-2 hover:bg-white rounded-full text-gray-400 hover:text-gray-600 transition-all border border-transparent hover:border-gray-200"
                >
                    <X size={24} />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Coluna 1: Informações da Apólice */}
                <div className="card space-y-5">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
                        <FileText size={18} className="text-blue-600" />
                        Informações da Apólice
                    </h3>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nº do Sinistro *</label>
                        <input
                            type="text"
                            value={claimNumber}
                            onChange={(e) => setClaimNumber(e.target.value)}
                            placeholder="Ex: 2024-001"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-300 font-bold text-lg"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Número fornecido pela seguradora</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Seguradora *</label>
                        <select
                            value={insurer}
                            onChange={(e) => handleInsurerChange(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                        >
                            <option value="">Selecione...</option>
                            {insurerOptions.map(ins => (
                                <option key={ins} value={ins}>{ins}</option>
                            ))}
                            <option value="__other__">Outra (digitar)</option>
                        </select>
                        {isCustomInsurer && (
                            <input
                                type="text"
                                value={customInsurer}
                                onChange={(e) => setCustomInsurer(e.target.value)}
                                placeholder="Digite o nome da seguradora"
                                className="w-full mt-2 px-4 py-2.5 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-blue-50/30 placeholder:text-gray-300"
                                autoFocus
                            />
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Modalidade</label>
                        {isCustomInsurer ? (
                            <input
                                type="text"
                                value={customModality}
                                onChange={(e) => { setModality('__other__'); setCustomModality(e.target.value); if (checklist.length === 0) setChecklist(buildChecklist([])); }}
                                placeholder="Digite a modalidade"
                                className="w-full px-4 py-2.5 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-blue-50/30 placeholder:text-gray-300"
                            />
                        ) : (
                            <>
                                <select
                                    value={modality}
                                    onChange={(e) => handleModalityChange(e.target.value)}
                                    disabled={!insurer}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white disabled:bg-gray-50 disabled:text-gray-400"
                                >
                                    <option value="">Selecione...</option>
                                    {availableModalities.map(mod => (
                                        <option key={mod} value={mod}>{mod}</option>
                                    ))}
                                    {insurer && <option value="__other__">Outra (digitar)</option>}
                                </select>
                                {isCustomModality && (
                                    <input
                                        type="text"
                                        value={customModality}
                                        onChange={(e) => setCustomModality(e.target.value)}
                                        placeholder="Digite a modalidade"
                                        className="w-full mt-2 px-4 py-2.5 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-blue-50/30 placeholder:text-gray-300"
                                        autoFocus
                                    />
                                )}
                            </>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1">Define a lista de documentos padrão</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nº da Apólice</label>
                        <input
                            type="text"
                            value={policyNumber}
                            onChange={(e) => setPolicyNumber(e.target.value)}
                            placeholder="Ex: 123456789"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-300"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Vigência Início</label>
                            <input
                                type="date"
                                value={policyStartDate}
                                onChange={(e) => setPolicyStartDate(e.target.value)}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Vigência Fim</label>
                            <input
                                type="date"
                                value={policyEndDate}
                                onChange={(e) => setPolicyEndDate(e.target.value)}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Vigência Retroativa</label>
                        <input
                            type="date"
                            value={retroactiveDate}
                            onChange={(e) => setRetroactiveDate(e.target.value)}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Para casos ambientais/RC</p>
                    </div>
                </div>

                {/* Coluna 2: Segurado e Prestadores */}
                <div className="space-y-6">
                    {/* Segurado */}
                    <div className="card space-y-4">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
                            <User size={18} className="text-green-600" />
                            Segurado
                        </h3>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nome do Segurado *</label>
                            <input
                                type="text"
                                value={insuredName}
                                onChange={(e) => setInsuredName(e.target.value)}
                                placeholder="Nome completo ou razão social"
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-300"
                            />
                        </div>
                    </div>

                    {/* Corretora */}
                    <div className="card space-y-4">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
                            <Building2 size={18} className="text-purple-600" />
                            Corretora
                        </h3>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nome da Corretora</label>
                            <input
                                type="text"
                                value={brokerName}
                                onChange={(e) => setBrokerName(e.target.value)}
                                placeholder="Ex: Silva Corretora de Seguros"
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-300"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">ID do Sinistro na Corretora</label>
                            <input
                                type="text"
                                value={brokerClaimId}
                                onChange={(e) => setBrokerClaimId(e.target.value)}
                                placeholder="Número interno da corretora"
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-300"
                            />
                        </div>
                    </div>

                    {/* Reguladora/Perito */}
                    <div className="card space-y-4">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
                            <Briefcase size={18} className="text-amber-600" />
                            Reguladora / Perito
                        </h3>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nome do Prestador</label>
                            <input
                                type="text"
                                value={adjusterName}
                                onChange={(e) => setAdjusterName(e.target.value)}
                                placeholder="Ex: XYZ Regulação de Sinistros"
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-300"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">ID do Sinistro na Reguladora</label>
                            <input
                                type="text"
                                value={adjusterClaimId}
                                onChange={(e) => setAdjusterClaimId(e.target.value)}
                                placeholder="Número interno do prestador"
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-300"
                            />
                        </div>
                    </div>
                </div>

                {/* Coluna 3: Dados do Sinistro */}
                <div className="space-y-6">
                    <div className="card space-y-4">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
                            <Info size={18} className="text-red-600" />
                            Dados do Sinistro
                        </h3>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Título / Descrição Curta</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Ex: Incêndio Galpão Comercial"
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-300"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Data da Ocorrência</label>
                            <input
                                type="date"
                                value={occurrenceDate}
                                onChange={(e) => setOccurrenceDate(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Local da Ocorrência</label>
                            <input
                                type="text"
                                value={occurrenceLocation}
                                onChange={(e) => setOccurrenceLocation(e.target.value)}
                                placeholder="Endereço ou descrição do local"
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-300"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Descrição do Sinistro</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                                placeholder="Breve descrição do ocorrido (máx. 500 caracteres)"
                                rows={4}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-300 resize-none"
                            />
                            <p className="text-[10px] text-gray-400 mt-1 text-right">{description.length}/500</p>
                        </div>
                    </div>

                    {/* Link compartilhável */}
                    <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 space-y-3">
                        <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                            <Share2 size={16} />
                            Link de Compartilhamento
                        </h4>
                        <p className="text-xs text-blue-700">O sistema gerará um link único para envio de documentos após criação do sinistro.</p>
                        <div className="flex flex-wrap gap-2">
                            {['Causa', 'Prejuízo', 'Liquidação', 'Gerencial'].map(p => (
                                <span key={p} className="px-2.5 py-1 bg-white/80 border border-blue-100 rounded-full text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                                    {p}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Checklist de Documentos (Full Width) */}
            <div className="card">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Shield size={18} className="text-blue-600" />
                            Checklist de Documentos
                        </h3>
                        {effectiveInsurer && effectiveModality && (
                            <p className="text-xs text-gray-500 mt-1">
                                Template: <span className="font-bold">{effectiveInsurer}</span> → <span className="font-bold">{effectiveModality}</span>
                            </p>
                        )}
                    </div>
                    <button
                        onClick={addDoc}
                        className="px-4 py-2 border border-blue-100 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors flex items-center gap-2"
                    >
                        <Plus size={16} />
                        Adicionar Documento
                    </button>
                </div>

                {checklist.length === 0 ? (
                    <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-xl">
                        <FileText size={40} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-400 font-medium">Selecione uma seguradora e modalidade para carregar a lista padrão</p>
                        <p className="text-gray-300 text-sm">ou adicione documentos manualmente</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <div className="grid grid-cols-12 gap-4 px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                            <div className="col-span-1">#</div>
                            <div className="col-span-6">Documento</div>
                            <div className="col-span-3">Pasta</div>
                            <div className="col-span-1">Obrig.</div>
                            <div className="col-span-1"></div>
                        </div>
                        {checklist.map((item, idx) => (
                            <div key={item.id} className="grid grid-cols-12 gap-4 items-center p-3 bg-gray-50 rounded-xl border border-gray-100 group hover:bg-white hover:shadow-sm transition-all">
                                <div className="col-span-1">
                                    <div className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-400">
                                        {idx + 1}
                                    </div>
                                </div>
                                <div className="col-span-6">
                                    <input
                                        type="text"
                                        value={item.name}
                                        onChange={(e) => {
                                            const next = [...checklist];
                                            next[idx].name = e.target.value;
                                            setChecklist(next);
                                        }}
                                        placeholder="Nome do documento..."
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                    />
                                </div>
                                <div className="col-span-3">
                                    <select
                                        value={item.folder}
                                        onChange={(e) => {
                                            const next = [...checklist];
                                            next[idx].folder = e.target.value;
                                            setChecklist(next);
                                        }}
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600"
                                    >
                                        <option value="Causa">Causa</option>
                                        <option value="Prejuízo">Prejuízo</option>
                                        <option value="Liquidação">Liquidação</option>
                                    </select>
                                </div>
                                <div className="col-span-1 flex justify-center">
                                    <input
                                        type="checkbox"
                                        checked={item.required}
                                        onChange={(e) => {
                                            const next = [...checklist];
                                            next[idx].required = e.target.checked;
                                            setChecklist(next);
                                        }}
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="col-span-1 flex justify-end">
                                    <button
                                        onClick={() => removeDoc(item.id)}
                                        className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                <button
                    className="px-8 py-2.5 text-gray-500 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                    onClick={() => navigate('/sinistros')}
                >
                    Cancelar
                </button>
                <button
                    className="bg-blue-600 text-white px-12 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2"
                    onClick={handleSave}
                >
                    <Save size={18} />
                    Criar Sinistro
                </button>
            </div>
        </div>
    );
}

import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, X, Plus, Trash2, Info, Building2, User, FileText, Briefcase, ArrowLeft, ListChecks, AlertCircle, Loader2, Megaphone } from 'lucide-react';
import { useClaims } from '../context/ClaimsContext';
import { INSURERS_CONFIG } from '../constants/config';
import { DEFAULT_CLAIM_TYPE, defToSteps, draftKey } from '../constants/claimTypes';
import { loadClaimTypes, loadClaimTypeDef } from '../api/checklist';
import { useConfirm, useUnsavedGuard } from '../components/ConfirmDialog';

const br = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

// A mensagem embaixo do campo. Erro impede criar; aviso é o que se ganha em
// preencher, e some sozinho quando o campo é preenchido.
function FieldNote({ error, warning }) {
    if (error) return <p className="text-[11px] font-bold text-red-600 mt-1 flex items-start gap-1"><AlertCircle size={12} className="mt-px shrink-0" />{error}</p>;
    if (warning) return <p className="text-[10px] text-amber-600 mt-1">{warning}</p>;
    return null;
}

export default function NewClaim() {
    const navigate = useNavigate();
    const ask = useConfirm();
    const { addClaim, claims, clients } = useClaims();

    // Seguradoras do config (com as modalidades sugeridas) mais as cadastradas
    // em clientes. Seguradora e modalidade são só dados do sinistro: as etapas
    // e os documentos vêm do tipo de sinistro.
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

    // Tipo de sinistro → etapas. A definição do tipo (backoffice) vira um
    // rascunho editável aqui; o que se muda vale só para este sinistro.
    const [claimTypes, setClaimTypes] = useState([]);
    const [claimType, setClaimType] = useState('');
    const [steps, setSteps] = useState([]);
    const [stepsEdited, setStepsEdited] = useState(false);
    const [loadingDef, setLoadingDef] = useState(false);
    const [defError, setDefError] = useState(null);
    const [disclaimer, setDisclaimer] = useState('');

    const applyType = async (type) => {
        setClaimType(type);
        setStepsEdited(false);
        setDefError(null);
        if (!type) { setSteps([]); return; }
        setLoadingDef(true);
        try {
            const def = await loadClaimTypeDef(type);
            setSteps(defToSteps(def));
        } catch (e) {
            setSteps([]);
            setDefError(e?.message || 'Não foi possível carregar as etapas deste tipo.');
        } finally {
            setLoadingDef(false);
        }
    };

    useEffect(() => {
        let off = false;
        loadClaimTypes().then(types => {
            if (off) return;
            setClaimTypes(types);
            // O padrão já vem escolhido quando existe; com um tipo só, é ele.
            const initial = types.find(t => t.type === DEFAULT_CLAIM_TYPE.type) || (types.length === 1 ? types[0] : null);
            if (initial) applyType(initial.type);
        });
        return () => { off = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleTypeChange = async (type) => {
        if (type === claimType) return;
        if (stepsEdited && !await ask({
            title: 'Trocar o tipo de sinistro?',
            message: 'As etapas são recarregadas do novo tipo e as alterações feitas nos itens se perdem.',
            confirmLabel: 'Trocar o tipo',
            cancelLabel: 'Manter',
            tone: 'warning',
        })) return;
        applyType(type);
    };

    const editSteps = (fn) => { setSteps(prev => fn(prev)); setStepsEdited(true); };
    const updateItem = (stepKey, itemKey, patch) => editSteps(prev => prev.map(st => st.key !== stepKey ? st : {
        ...st, items: st.items.map(it => it.key === itemKey ? { ...it, ...patch } : it),
    }));
    const removeItem = (stepKey, itemKey) => editSteps(prev => prev.map(st => st.key !== stepKey ? st : {
        ...st, items: st.items.filter(it => it.key !== itemKey),
    }));
    const addItem = (stepKey) => editSteps(prev => prev.map(st => st.key !== stepKey ? st : {
        ...st, items: [...st.items, { key: draftKey(), id: '', label: '', required: true }],
    }));

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

    // Sair daqui joga fora tudo: o formulário não tem rascunho, e nada do que foi
    // digitado existe em outro lugar até o Criar Sinistro. Vale para as três
    // saídas — o X, o Cancelar e o voltar do navegador.
    const dirty = [
        claimNumber, insurer, customInsurer, policyNumber, policyStartDate,
        policyEndDate, retroactiveDate, modality, customModality, insuredName, brokerName,
        brokerClaimId, adjusterName, adjusterClaimId, title, occurrenceDate,
        occurrenceLocation, description, disclaimer,
    ].some(v => (v || '').trim() !== '') || stepsEdited;

    useUnsavedGuard(dirty);

    const leave = async () => {
        if (dirty && !await ask({
            title: 'Sair sem criar o sinistro?',
            message: 'O que você preencheu não é salvo em rascunho: ao sair, os dados se perdem.',
            confirmLabel: 'Sair e descartar',
            cancelLabel: 'Continuar preenchendo',
            tone: 'warning',
        })) return;
        // ".." sozinho sobe um nível de *rota*, e "sinistros/novo" é um
        // segmento só: daria em /app. O destino é a lista, e ela fica ao lado.
        navigate('../sinistros');
    };

    const isCustomInsurer = insurer === '__other__';
    const effectiveInsurer = isCustomInsurer ? customInsurer : insurer;

    // Modalidades disponíveis baseadas na seguradora selecionada
    const availableModalities = useMemo(() => {
        if (!insurer || isCustomInsurer || !INSURERS_CONFIG[insurer]) return [];
        return Object.keys(INSURERS_CONFIG[insurer].modalities);
    }, [insurer, isCustomInsurer]);

    const isCustomModality = modality === '__other__';
    const effectiveModality = isCustomModality ? customModality : modality;

    // ── Conferências do formulário ──────────────────────────────────────────
    //
    // Um sinistro entra aqui com dados que vêm de fora — do aviso da
    // seguradora, do e-mail da corretora — e sai daqui como a verdade do
    // processo inteiro. Erro de digitação em data de vigência não aparece hoje:
    // aparece na hora de decidir se o caso é coberto, com o processo já montado.
    //
    // A separação abaixo é a que importa: `erros` impede a criação porque o
    // dado está errado; `avisos` deixa criar porque o dado está apenas
    // faltando, e faltar é normal no primeiro aviso do sinistro.
    const hoje = new Date().toISOString().slice(0, 10);

    // `faltando` são os erros de campo vazio: existem, mas não se mostram antes
    // da primeira tentativa — reclamar de um campo que ainda não chegou a vez é
    // ruído, e o formulário abre inteiro em branco.
    const { erros, faltando } = useMemo(() => {
        const e = {};
        const f = new Set();
        if (!claimNumber.trim()) { e.claimNumber = 'Informe o número do sinistro.'; f.add('claimNumber'); }
        else if (claims?.some(c => (c.number || '').trim().toLowerCase() === claimNumber.trim().toLowerCase())) {
            e.claimNumber = 'Já existe um sinistro com este número.';
        }
        if (!effectiveInsurer.trim()) { e.insurer = 'Selecione ou digite a seguradora.'; f.add('insurer'); }
        if (!insuredName.trim()) { e.insuredName = 'Informe o nome do segurado.'; f.add('insuredName'); }

        // Sinistro se abre em apólice que já está valendo; início no futuro é
        // data digitada errada.
        if (policyStartDate && policyStartDate > hoje) {
            e.policyStartDate = 'O início da vigência não pode estar no futuro.';
        }
        if (policyStartDate && policyEndDate && policyEndDate < policyStartDate) {
            e.policyEndDate = 'O fim da vigência é anterior ao início.';
        }
        // A retroativa é o quanto a apólice enxerga para trás; depois do início
        // ela não retroage nada, é só uma data trocada de campo.
        if (retroactiveDate && policyStartDate && retroactiveDate > policyStartDate) {
            e.retroactiveDate = 'A retroativa é anterior ao início da vigência, não posterior.';
        }

        if (occurrenceDate && occurrenceDate > hoje) {
            e.occurrenceDate = 'A ocorrência não pode estar no futuro.';
        } else if (occurrenceDate && policyEndDate && occurrenceDate > policyEndDate) {
            e.occurrenceDate = `A ocorrência é posterior ao fim da vigência (${br(policyEndDate)}).`;
        } else if (occurrenceDate && policyStartDate && occurrenceDate < policyStartDate) {
            // Antes do início só passa se a retroativa cobrir — é para isso que
            // ela existe, e o texto tem de dizer qual das duas datas mandou.
            if (!retroactiveDate) {
                e.occurrenceDate = `A ocorrência é anterior ao início da vigência (${br(policyStartDate)}). Se a apólice tem retroativa, informe a data.`;
            } else if (occurrenceDate < retroactiveDate) {
                e.occurrenceDate = `A ocorrência é anterior à retroativa (${br(retroactiveDate)}) e fica fora da cobertura.`;
            }
        }

        if (!claimType) { e.claimType = 'Selecione o tipo de sinistro.'; f.add('claimType'); }
        else if (!loadingDef && steps.length === 0) { e.claimType = 'Este tipo não tem etapas. Escolha outro tipo.'; }
        if (steps.some(st => st.items.some(it => !it.label.trim()))) {
            e.checklist = 'Há item sem nome nas etapas. Dê um nome ou remova a linha.';
        }
        return { erros: e, faltando: f };
    }, [claimNumber, claims, effectiveInsurer, insuredName, policyStartDate, policyEndDate,
        retroactiveDate, occurrenceDate, claimType, loadingDef, steps, hoje]);

    const avisos = useMemo(() => {
        const a = {};
        if (!policyNumber.trim()) a.policyNumber = 'Sem o número da apólice a cobrança de documentos fica só pelo sinistro.';
        if (!policyStartDate || !policyEndDate) a.policyEndDate = 'Sem a vigência não dá para conferir se a ocorrência está coberta.';
        if (!occurrenceDate) a.occurrenceDate = 'A data da ocorrência é o que amarra o sinistro à vigência.';
        // Coberta pela retroativa é um caso legítimo, mas raro o bastante para
        // valer um segundo olhar antes de criar.
        if (occurrenceDate && policyStartDate && occurrenceDate < policyStartDate && retroactiveDate && occurrenceDate >= retroactiveDate) {
            a.occurrenceDate = `Fora da vigência, coberta pela retroativa de ${br(retroactiveDate)}.`;
        }
        return a;
    }, [policyNumber, policyStartDate, policyEndDate, occurrenceDate, retroactiveDate]);

    // Antes da primeira tentativa, campo vazio não é erro — é campo que ainda
    // não chegou a vez. Depois dela, o formulário confere a cada tecla.
    const [tentou, setTentou] = useState(false);
    // A recusa do servidor, que não é erro de campo: nada aqui está errado, o
    // gravar é que não foi.
    const [erroAoSalvar, setErroAoSalvar] = useState(null);
    const [salvando, setSalvando] = useState(false);
    const primeiroSemNome = steps.flatMap(st => st.items).find(it => !it.label.trim())?.key;
    const erroDe = (campo) => (tentou || !faltando.has(campo) ? erros[campo] : undefined);

    const handleInsurerChange = (value) => {
        setInsurer(value);
        setCustomInsurer('');
        setModality('');
        setCustomModality('');
    };

    const handleModalityChange = (value) => {
        setModality(value);
        setCustomModality('');
    };

    const handleSave = async () => {
        if (loadingDef) return; // as etapas ainda estão chegando
        setTentou(true);
        setErroAoSalvar(null);
        const primeiro = Object.keys(erros)[0];
        if (primeiro) {
            // Levar até o campo em vez de descrever o problema numa caixa que
            // some ao ser fechada: o erro fica escrito embaixo do campo errado.
            document.getElementById(`campo-${primeiro}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            document.getElementById(`campo-${primeiro}`)?.focus?.();
            return;
        }

        // addClaim é assíncrono — sem o await o id vira uma promessa, a URL vira
        // /sinistros/[object Promise] e a pessoa chega no sinistro que acabou de
        // criar para ler "Sinistro não encontrado".
        setSalvando(true);
        let newClaimId;
        try {
            newClaimId = await addClaim({
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
                steps,
                disclaimer: disclaimer.trim(),
                claimType: claimType || null,
            });
        } catch (e) {
            // Nada foi criado, e o formulário continua de pé com tudo dentro:
            // mandar para a lista aqui perderia o que a pessoa digitou.
            setErroAoSalvar(e?.message || 'Não foi possível criar o sinistro. Tente de novo.');
            setSalvando(false);
            return;
        }

        // Relativo contra a rota, não contra a URL: "sinistros/novo" é um segmento só, então ".." é /app.
        navigate(`../sinistros/${newClaimId}`);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-20 relative z-10">
            <div className="flex items-center justify-between">
                <div>
                    <button type="button" onClick={leave} className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400 hover:text-blue-600 transition-all mb-2 tracking-widest">
                        <ArrowLeft size={16} />
                        Voltar para Sinistros
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900 font-display">Abrir Novo Sinistro</h1>
                    <p className="text-gray-500">Cadastre os dados do sinistro conforme informações da seguradora.</p>
                </div>
                <button
                    onClick={leave}
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
                        <label htmlFor="campo-claimType" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <ListChecks size={13} className="text-blue-600" />
                            Tipo de Sinistro *
                        </label>
                        <select
                            id="campo-claimType"
                            value={claimType}
                            onChange={(e) => handleTypeChange(e.target.value)}
                            aria-invalid={!!erroDe('claimType')}
                            className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 outline-none transition-all bg-white ${erroDe('claimType') ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500'}`}
                        >
                            <option value="">Selecione o tipo...</option>
                            {claimTypes.map(t => (
                                <option key={t.type} value={t.type}>{t.title}</option>
                            ))}
                        </select>
                        {erroDe('claimType')
                            ? <FieldNote error={erroDe('claimType')} />
                            : <p className="text-[10px] text-gray-400 mt-1">Define as etapas e os documentos do sinistro</p>}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nº do Sinistro *</label>
                        <input
                            id="campo-claimNumber"
                            type="text"
                            value={claimNumber}
                            onChange={(e) => setClaimNumber(e.target.value)}
                            placeholder="Ex: 2024-001"
                            aria-invalid={!!erroDe('claimNumber')}
                            className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 outline-none transition-all placeholder:text-gray-300 font-bold text-lg ${erroDe('claimNumber') ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500'}`}
                        />
                        {erroDe('claimNumber')
                            ? <FieldNote error={erroDe('claimNumber')} />
                            : <p className="text-[10px] text-gray-400 mt-1">Número fornecido pela seguradora</p>}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Seguradora *</label>
                        <select
                            id="campo-insurer"
                            value={insurer}
                            onChange={(e) => handleInsurerChange(e.target.value)}
                            aria-invalid={!!erroDe('insurer')}
                            className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 outline-none transition-all bg-white ${erroDe('insurer') ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500'}`}
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
                        <FieldNote error={erroDe('insurer')} />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Modalidade</label>
                        {isCustomInsurer ? (
                            <input
                                type="text"
                                value={customModality}
                                onChange={(e) => { setModality('__other__'); setCustomModality(e.target.value); }}
                                placeholder="Digite a modalidade"
                                className="w-full px-4 py-2.5 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-blue-50/30 placeholder:text-gray-300"
                            />
                        ) : (
                            <>
                                <select
                                    id="campo-modality"
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
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nº da Apólice</label>
                        <input
                            id="campo-policyNumber"
                            type="text"
                            value={policyNumber}
                            onChange={(e) => setPolicyNumber(e.target.value)}
                            placeholder="Ex: 123456789"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-300"
                        />
                        <FieldNote warning={avisos.policyNumber} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Vigência Início</label>
                            <input
                                id="campo-policyStartDate"
                                type="date"
                                value={policyStartDate}
                                onChange={(e) => setPolicyStartDate(e.target.value)}
                                max={hoje}
                                aria-invalid={!!erroDe('policyStartDate')}
                                className={`w-full px-3 py-2.5 border rounded-xl focus:ring-2 outline-none transition-all text-sm ${erroDe('policyStartDate') ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500'}`}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Vigência Fim</label>
                            <input
                                id="campo-policyEndDate"
                                type="date"
                                value={policyEndDate}
                                onChange={(e) => setPolicyEndDate(e.target.value)}
                                aria-invalid={!!erroDe('policyEndDate')}
                                className={`w-full px-3 py-2.5 border rounded-xl focus:ring-2 outline-none transition-all text-sm ${erroDe('policyEndDate') ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500'}`}
                            />
                        </div>
                        <div className="col-span-2">
                            <FieldNote error={erroDe('policyStartDate')} />
                            <FieldNote error={erroDe('policyEndDate')} warning={avisos.policyEndDate} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Vigência Retroativa</label>
                        <input
                            id="campo-retroactiveDate"
                            type="date"
                            value={retroactiveDate}
                            onChange={(e) => setRetroactiveDate(e.target.value)}
                            aria-invalid={!!erroDe('retroactiveDate')}
                            className={`w-full px-3 py-2.5 border rounded-xl focus:ring-2 outline-none transition-all text-sm ${erroDe('retroactiveDate') ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500'}`}
                        />
                        {erroDe('retroactiveDate')
                            ? <FieldNote error={erroDe('retroactiveDate')} />
                            : <p className="text-[10px] text-gray-400 mt-1">Cobre ocorrências anteriores ao início da vigência. Para casos ambientais/RC.</p>}
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
                                id="campo-insuredName"
                                type="text"
                                value={insuredName}
                                onChange={(e) => setInsuredName(e.target.value)}
                                placeholder="Nome completo ou razão social"
                                aria-invalid={!!erroDe('insuredName')}
                                className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 outline-none transition-all placeholder:text-gray-300 ${erroDe('insuredName') ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500'}`}
                            />
                            <FieldNote error={erroDe('insuredName')} />
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
                                id="campo-occurrenceDate"
                                type="date"
                                value={occurrenceDate}
                                onChange={(e) => setOccurrenceDate(e.target.value)}
                                max={hoje}
                                aria-invalid={!!erroDe('occurrenceDate')}
                                className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 outline-none transition-all ${erroDe('occurrenceDate') ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500'}`}
                            />
                            <FieldNote error={erroDe('occurrenceDate')} warning={avisos.occurrenceDate} />
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
                </div>
            </div>

            {/* Etapas do sinistro (Full Width): o tipo escolhido, editável só para este sinistro. */}
            <div className="card" data-testid="claim-steps">
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <ListChecks size={18} className="text-blue-600" />
                            Etapas e Documentos
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                            {claimType
                                ? <>Modelo: <span className="font-bold">{claimTypes.find(t => t.type === claimType)?.title || claimType}</span>. As alterações valem só para este sinistro.</>
                                : 'Escolha o tipo de sinistro para carregar as etapas.'}
                        </p>
                    </div>
                    {loadingDef && <Loader2 size={18} className="text-gray-400 animate-spin shrink-0" aria-label="Carregando etapas" />}
                </div>

                {erroDe('checklist') && (
                    <div className="mb-4">
                        <FieldNote error={erroDe('checklist')} />
                    </div>
                )}

                {defError ? (
                    <div className="py-8 text-center border-2 border-dashed border-red-100 rounded-xl">
                        <AlertCircle size={32} className="mx-auto text-red-300 mb-2" />
                        <p className="text-sm text-red-600 font-medium">{defError}</p>
                        <button type="button" onClick={() => applyType(claimType)} className="mt-3 text-xs font-bold text-blue-600 hover:underline">Tentar de novo</button>
                    </div>
                ) : steps.length === 0 ? (
                    <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-xl">
                        <FileText size={40} className="mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-400 font-medium">{loadingDef ? 'Carregando etapas…' : 'Selecione o tipo de sinistro para carregar as etapas'}</p>
                    </div>
                ) : (
                    <ol className="space-y-4">
                        {steps.map((st, si) => (
                            <li key={st.key} className="rounded-xl border border-gray-100 overflow-hidden" aria-label={`Etapa ${si + 1}: ${st.title}`}>
                                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0">{si + 1}</span>
                                        <h4 className="font-bold text-gray-900 truncate">{st.title}</h4>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0">
                                            {st.items.length} {st.items.length === 1 ? 'item' : 'itens'}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => addItem(st.key)}
                                        className="px-3 py-1.5 border border-blue-100 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-50 transition-colors flex items-center gap-1.5 shrink-0 bg-white"
                                    >
                                        <Plus size={14} />
                                        Adicionar item
                                    </button>
                                </div>
                                {st.items.length === 0 ? (
                                    <p className="px-4 py-4 text-xs text-gray-400">Nenhum item nesta etapa.</p>
                                ) : (
                                    <ul className="divide-y divide-gray-50">
                                        {st.items.map((it) => (
                                            <li key={it.key} className="flex items-center gap-3 px-4 py-2.5 group hover:bg-gray-50/60">
                                                <input
                                                    id={it.key === primeiroSemNome ? 'campo-checklist' : undefined}
                                                    type="text"
                                                    value={it.label}
                                                    onChange={(e) => updateItem(st.key, it.key, { label: e.target.value })}
                                                    placeholder="Nome do documento..."
                                                    aria-label={`Item da etapa ${st.title}`}
                                                    aria-invalid={tentou && !it.label.trim()}
                                                    className={`flex-1 min-w-0 px-3 py-2 bg-white border rounded-lg outline-none focus:ring-1 text-sm ${tentou && !it.label.trim() ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500'}`}
                                                />
                                                <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 shrink-0 cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={it.required}
                                                        onChange={(e) => updateItem(st.key, it.key, { required: e.target.checked })}
                                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    Obrigatório
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(st.key, it.key)}
                                                    className="p-1.5 text-gray-300 hover:text-red-500 transition-colors shrink-0"
                                                    title="Remover item"
                                                    aria-label={`Remover ${it.label || 'item'}`}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        ))}
                    </ol>
                )}

                <div className="mt-6 pt-6 border-t border-gray-100">
                    <label htmlFor="campo-disclaimer" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Megaphone size={13} className="text-amber-500" />
                        Disclaimer
                    </label>
                    <textarea
                        id="campo-disclaimer"
                        value={disclaimer}
                        onChange={(e) => setDisclaimer(e.target.value.slice(0, 2000))}
                        rows={3}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-300 resize-none"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Opcional. Aparece no topo de todas as etapas do sinistro.</p>
                </div>
            </div>

            {/* O botão continua clicável de propósito: desabilitado, ele não conta
                o que falta, e a pessoa fica clicando num botão morto. */}
            {tentou && Object.keys(erros).length > 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3" role="alert">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
                    <div>
                        <p className="text-sm font-bold text-red-700">
                            {Object.keys(erros).length === 1 ? 'Falta acertar um campo antes de criar o sinistro.' : `Faltam acertar ${Object.keys(erros).length} campos antes de criar o sinistro.`}
                        </p>
                        <ul className="mt-1 space-y-0.5 text-xs text-red-600">
                            {Object.values(erros).map((msg) => <li key={msg}>{msg}</li>)}
                        </ul>
                    </div>
                </div>
            )}

            {erroAoSalvar && (
                <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3" role="alert">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
                    <p className="text-sm font-bold text-red-700">{erroAoSalvar}</p>
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                <button
                    className="px-8 py-2.5 text-gray-500 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                    onClick={leave}
                >
                    Cancelar
                </button>
                {/* Travado só enquanto grava, para não criar dois sinistros com o
                    mesmo número num clique duplo. Fora disso ele fica clicável de
                    propósito, porque desabilitado não conta o que falta. */}
                <button
                    className="bg-blue-600 text-white px-12 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2 disabled:opacity-60"
                    onClick={handleSave}
                    disabled={salvando}
                >
                    <Save size={18} />
                    {salvando ? 'Criando…' : 'Criar Sinistro'}
                </button>
            </div>
        </div>
    );
}

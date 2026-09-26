import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, HelpCircle } from 'lucide-react';

/**
 * A confirmação, num lugar só.
 *
 * Antes disto o app pedia confirmação de três jeitos: o confirm() do navegador
 * (que não diz de qual sistema veio, não é traduzível e trava a aba), um modal
 * escrito à mão em cada tela que precisou de justificativa, e nada nas ações
 * mais caras do board — desanexar tarefa e remover arquivo iam direto. Ter três
 * jeitos significa que a terceira tela a precisar disso inventa o quarto.
 *
 * A API é uma promessa, e não um componente, porque é assim que o confirm()
 * nativo era usado: `if (!await ask({...})) return;` no começo do handler,
 * exatamente onde a linha antiga estava. Um <ConfirmModal> com estado próprio
 * obrigaria a partir cada handler em dois.
 *
 *   const ask = useConfirm();
 *   if (!await ask({ title: 'Excluir o documento?', tone: 'danger' })) return;
 *
 * Com `reason`, a justificativa é obrigatória e volta no resultado:
 *
 *   const res = await ask({ title: 'Remover item', reason: { label: 'Justificativa' } });
 *   if (!res) return;
 *   await remove(res.reason);
 */

const ConfirmContext = createContext(null);

const TONES = {
    danger: { icon: Trash2, fg: '#E11D48', bg: '#FEF2F4', button: 'bg-[#E11D48] hover:bg-[#BE123C]' },
    warning: { icon: AlertTriangle, fg: '#B45309', bg: '#FEF3E2', button: 'bg-[#D97706] hover:bg-[#B45309]' },
    default: { icon: HelpCircle, fg: '#2563EB', bg: '#EAF1FE', button: 'bg-[#2563EB] hover:bg-[#1D4ED8]' },
};

export function ConfirmProvider({ children }) {
    const [req, setReq] = useState(null);
    const seq = useRef(0);

    // A promessa é resolvida uma vez só: fechar pelo Esc, pelo fundo e pelo botão
    // são o mesmo "não", e todos passam por aqui.
    const settle = useCallback((value) => {
        setReq(prev => { prev?.resolve(value); return null; });
    }, []);

    // O id vira a key do diálogo. Sem ele, duas perguntas seguidas — a segunda
    // aberta em resposta à primeira, como o "excluir mesmo assim" dos papéis —
    // caem na mesma instância e herdam o texto digitado e o estado de espera da
    // anterior, que fica travada em "Aguarde…" e não aceita mais clique.
    const confirm = useCallback((options) => new Promise(resolve => {
        seq.current += 1;
        setReq({ id: seq.current, tone: 'default', confirmLabel: 'Confirmar', cancelLabel: 'Cancelar', ...options, resolve });
    }), []);

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            <AnimatePresence>
                {req && <ConfirmDialog key={req.id} req={req} onSettle={settle} />}
            </AnimatePresence>
        </ConfirmContext.Provider>
    );
}

export function useConfirm() {
    const confirm = useContext(ConfirmContext);
    if (!confirm) throw new Error('useConfirm precisa estar dentro de <ConfirmProvider>.');
    return confirm;
}

function ConfirmDialog({ req, onSettle }) {
    const { title, message, detail, confirmLabel, cancelLabel, tone, reason, onConfirm } = req;
    const [text, setText] = useState('');
    const [err, setErr] = useState(null);
    const [working, setWorking] = useState(false);
    const firstRef = useRef(null);
    const t = TONES[tone] || TONES.default;
    const Icon = t.icon;

    useEffect(() => { firstRef.current?.focus(); }, []);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' && !working) onSettle(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onSettle, working]);

    const accept = async () => {
        let value = '';
        if (reason) {
            value = text.trim();
            const min = reason.minLength ?? 3;
            if (value.length < min) {
                setErr(`Escreva ao menos ${min} caracteres.`);
                return;
            }
        }
        // Com onConfirm o diálogo fica de pé até o servidor responder, e uma
        // recusa aparece aqui dentro. Fechar antes e alertar depois tira a
        // pessoa do contexto no exato momento em que ela precisa dele — foi por
        // precisar disso que as telas de papéis e grupos escreveram modal próprio.
        if (!onConfirm) { onSettle({ reason: value }); return; }
        setWorking(true);
        setErr(null);
        try {
            await onConfirm(value);
            onSettle({ reason: value });
        } catch (e) {
            setErr(e?.message || 'Não foi possível concluir. Tente de novo.');
            setWorking(false);
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}
            onClick={() => !working && onSettle(false)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(15,23,42,.45)] p-4 backdrop-blur-[3px]">
            <motion.div initial={{ opacity: 0, y: 10, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.99 }}
                transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }} onClick={(e) => e.stopPropagation()}
                role="alertdialog" aria-modal="true" aria-label={title} data-testid="confirm-dialog"
                className="w-full max-w-[460px] rounded-[20px] bg-white p-6 shadow-[0_40px_80px_-30px_rgba(15,23,42,.5)]">
                <div className="flex items-start gap-3">
                    <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px]" style={{ background: t.bg, color: t.fg }}>
                        <Icon size={18} />
                    </span>
                    <div className="flex-1">
                        <h3 className="text-[16px] font-extrabold leading-snug text-slate-900">{title}</h3>
                        {message && <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">{message}</p>}
                    </div>
                </div>

                {detail && (
                    <p className="mt-3 rounded-[10px] border border-[#E9EEF5] bg-[#F7FAFF] p-[9px_11px] text-[12px] font-bold text-slate-600">{detail}</p>
                )}

                {reason && (
                    <div className="mt-4">
                        <label htmlFor="confirm-reason" className="text-[11px] font-extrabold text-slate-600">
                            {reason.label || 'Justificativa'} <span className="text-[#E11D48]">*</span>
                        </label>
                        <textarea id="confirm-reason" ref={firstRef} rows={3} value={text}
                            onChange={(e) => { setText(e.target.value); setErr(null); }}
                            placeholder={reason.placeholder || 'Registrado para auditoria.'}
                            className="mt-1.5 w-full resize-none rounded-[12px] border border-[#E9EEF5] p-[10px_12px] text-[12.5px] outline-none focus:border-[#2563EB]" />
                        {err && <p className="mt-1 text-[11.5px] font-bold text-[#E11D48]">{err}</p>}
                    </div>
                )}

                {err && !reason && <p className="mt-3 text-[11.5px] font-bold text-[#E11D48]">{err}</p>}

                <div className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={() => onSettle(false)} disabled={working}
                        className="rounded-lg px-4 py-2 text-xs font-extrabold text-slate-500 hover:bg-slate-100 disabled:opacity-40">{cancelLabel}</button>
                    <button type="button" ref={reason ? undefined : firstRef} onClick={accept} disabled={working}
                        className={`rounded-lg px-4 py-2 text-xs font-extrabold text-white disabled:opacity-60 ${t.button}`}>{working ? 'Aguarde…' : confirmLabel}</button>
                </div>
            </motion.div>
        </motion.div>
    );
}

/**
 * O aviso de sair com formulário preenchido, para o que o app não controla:
 * fechar a aba, recarregar, voltar pelo botão do navegador. Dentro do app a
 * saída passa por um botão nosso, e lá o useConfirm dá um texto melhor do que o
 * genérico que o navegador impõe aqui.
 */
export function useUnsavedGuard(dirty) {
    useEffect(() => {
        if (!dirty) return undefined;
        const onLeave = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', onLeave);
        return () => window.removeEventListener('beforeunload', onLeave);
    }, [dirty]);
}

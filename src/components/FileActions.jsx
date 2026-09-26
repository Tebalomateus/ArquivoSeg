import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2, Eye, Download, Share2, Copy } from 'lucide-react';
import { formatBytes } from '../api/files';
import { createShare } from '../api/shares';

// As ações de um arquivo, onde quer que ele esteja listado: no cartão do deck,
// na análise e na visão gerencial. Quem monta a lista decide pela permissão
// quais handlers passa; aqui só se desenha o que veio.

// Extension badge text: uppercase, max 4 chars, "DOC" fallback.
export function extBadge(name) {
    const m = /\.([A-Za-z0-9]+)$/.exec(name || '');
    if (!m) return 'DOC';
    return m[1].toUpperCase().slice(0, 4);
}

// ── Ações por arquivo ───────────────────────────────────────────────────────────
// Ver, baixar e compartilhar, na linha do arquivo. Um botão só aparece quando há
// handler: quem monta o board decide pela permissão, e aqui não se sabe (nem se
// precisa saber) por que um deles falta.
export function FileActions({ file, onView, onDownload, onShare }) {
    const cls = 'flex h-[26px] w-[26px] items-center justify-center rounded-[8px] text-slate-400 hover:bg-[#EAF1FE] hover:text-[#2563EB]';
    if (!onView && !onDownload && !onShare) return null;
    return (
        <span className="flex items-center gap-0.5" data-testid={`file-actions-${file.fileVerId}`}>
            {onView && (
                <button type="button" onClick={() => onView(file)} className={cls} title="Visualizar" aria-label={`Visualizar ${file.nome}`}><Eye size={14} /></button>
            )}
            {onDownload && (
                <button type="button" onClick={() => onDownload(file)} className={cls} title="Baixar" aria-label={`Baixar ${file.nome}`}><Download size={14} /></button>
            )}
            {onShare && (
                <button type="button" onClick={() => onShare(file)} className={cls} title="Compartilhar" aria-label={`Compartilhar ${file.nome}`}><Share2 size={14} /></button>
            )}
        </span>
    );
}

// ── Compartilhar arquivo ────────────────────────────────────────────────────────
// Cria um link público para um arquivo do deck. É o mesmo link da aba de gestão
// (/portal/:token), só que pedido de onde o arquivo está. Quem precisa ver todos
// os links, ou revogar um, continua indo à gestão do sinistro.
const SHARE_EXPIRY = [
    { value: '7', label: '7 dias' },
    { value: '30', label: '30 dias' },
    { value: '90', label: '90 dias' },
    { value: '', label: 'Sem expiração' },
];

export function ShareFileModal({ file, onClose }) {
    const [label, setLabel] = useState('');
    const [days, setDays] = useState('30');
    const [working, setWorking] = useState(false);
    const [error, setError] = useState(null);
    const [share, setShare] = useState(null);
    const [copied, setCopied] = useState(false);

    const create = async () => {
        if (working) return;
        setWorking(true);
        setError(null);
        try {
            const expiresAt = days ? new Date(Date.now() + parseInt(days, 10) * 86400000).toISOString() : undefined;
            const res = await createShare(file.fileVerId, { label: label.trim() || undefined, expiresAt });
            const st = res?.data ?? res;
            if (!st?.token) throw new Error('Resposta inválida do servidor (sem token do link).');
            setShare(st);
        } catch (err) {
            setError(err?.message || String(err));
        } finally {
            setWorking(false);
        }
    };

    const url = share ? `${window.location.origin}/portal/${share.token}` : '';
    const copy = async () => {
        try { await navigator.clipboard.writeText(url); setCopied(true); }
        catch { setCopied(false); }
    };
    const expires = share?.expires_at ? new Date(share.expires_at).toLocaleDateString('pt-BR') : 'sem expiração';

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}
            onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,.42)] p-4 backdrop-blur-[3px]">
            <motion.div initial={{ opacity: 0, y: 12, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.99 }}
                transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }} onClick={(e) => e.stopPropagation()}
                role="dialog" aria-label="Compartilhar arquivo" data-testid="share-modal"
                className="w-full max-w-[480px] rounded-[20px] bg-white p-6 shadow-[0_40px_80px_-30px_rgba(15,23,42,.5)]">
                <p className="text-[10px] font-extrabold tracking-[0.14em] text-slate-400 uppercase">Link público</p>
                <h3 className="mt-1 text-[19px] font-extrabold text-slate-900">Compartilhar arquivo</h3>
                <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-[#E4EBF6] bg-[#F7FAFF] p-[7px_9px]">
                    <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-white text-[8px] font-extrabold text-slate-600">{extBadge(file.nome)}</span>
                    <span className="flex-1 truncate text-[12px] font-bold text-slate-700">{file.nome}</span>
                    <span className="text-[10.5px] font-bold text-slate-400">{typeof file.tamanho === 'number' ? formatBytes(file.tamanho) : file.tamanho}</span>
                </div>

                {!share ? (
                    <>
                        <p className="mt-3 text-[12.5px] text-slate-500">Quem tiver o link abre o arquivo sem entrar no sistema. Para ver ou revogar os links deste sinistro, use a gestão.</p>
                        <label className="mt-4 block text-[10px] font-extrabold tracking-[0.12em] text-slate-400 uppercase">Rótulo (opcional)</label>
                        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: para a oficina" aria-label="Rótulo do link"
                            className="mt-1 w-full rounded-[12px] border border-[#E9EEF5] p-[10px_12px] text-[12.5px] outline-none focus:border-[#2563EB]" />
                        <label className="mt-3 block text-[10px] font-extrabold tracking-[0.12em] text-slate-400 uppercase">Expira em</label>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                            {SHARE_EXPIRY.map(o => (
                                <button key={o.value} type="button" onClick={() => setDays(o.value)}
                                    className={`rounded-[9px] px-[11px] py-[7px] text-[11px] font-extrabold ${days === o.value ? 'bg-[#2563EB] text-white' : 'bg-[#F4F7FB] text-slate-500 hover:bg-[#EAF1FE]'}`}>
                                    {o.label}
                                </button>
                            ))}
                        </div>
                        {error && <p className="mt-3 rounded-[10px] bg-[#FEF2F2] p-[9px_11px] text-[12px] font-semibold text-[#B91C1C]" role="alert">{error}</p>}
                        <div className="mt-5 flex justify-end gap-2">
                            <button onClick={onClose} className="rounded-lg px-4 py-2 text-xs font-extrabold text-slate-500 hover:bg-slate-100">Cancelar</button>
                            <button onClick={create} disabled={working} className="flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-extrabold text-white disabled:opacity-60">
                                {working ? <Loader2 size={13} className="animate-spin" /> : <Share2 size={13} />} Gerar link
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <p className="mt-3 text-[12.5px] text-slate-500">Link criado · {share.label ? `${share.label} · ` : ''}expira {expires}.</p>
                        <div className="mt-3 flex items-center gap-2">
                            <input readOnly value={url} aria-label="Link público" onFocus={(e) => e.target.select()}
                                className="min-w-0 flex-1 rounded-[12px] border border-[#E9EEF5] bg-[#F7FAFF] p-[10px_12px] font-mono text-[11px] text-slate-600 outline-none" />
                            <button type="button" onClick={copy} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#EAF1FE] px-3 py-[10px] text-xs font-extrabold text-[#2563EB] hover:bg-[#DCE7F9]">
                                {copied ? <Check size={13} strokeWidth={3} /> : <Copy size={13} />} {copied ? 'Copiado' : 'Copiar'}
                            </button>
                        </div>
                        <div className="mt-5 flex justify-end">
                            <button onClick={onClose} className="rounded-lg bg-[#0F172A] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#1E293B]">Fechar</button>
                        </div>
                    </>
                )}
            </motion.div>
        </motion.div>
    );
}

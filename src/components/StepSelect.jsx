import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

/**
 * As etapas do sinistro numa aba só, com a lista num menu. Tipo com seis
 * etapas fazia a barra de abas rolar para o lado; aqui a aba mostra a etapa
 * atual e o menu, todas, em ordem e com o % de cada uma.
 *
 * Fora de uma etapa (avulsos, gerencial, auditoria) a aba mostra a última
 * etapa vista. O nome acessível da aba e de cada item é "Etapa (N%)": o
 * número vem do CSS (data-step), fora do texto.
 */
export default function StepSelect({ steps, activeId, lastId, onSelect, tabClass, pctOf, titleOf }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState(null);
    const btnRef = useRef(null);
    const menuRef = useRef(null);

    const shownIndex = Math.max(0, steps.findIndex(s => s.id === (activeId ?? lastId)));
    const shown = steps[shownIndex];
    const on = steps.some(s => s.id === activeId);

    // O menu sai por portal: a barra de abas tem overflow-x e cortaria o painel.
    useLayoutEffect(() => {
        if (!open || !btnRef.current) return;
        const place = () => {
            const r = btnRef.current.getBoundingClientRect();
            setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 288)) });
        };
        place();
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onDown = (e) => {
            if (btnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); } };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    }, [open]);

    useEffect(() => {
        if (open) menuRef.current?.querySelector('[aria-checked="true"]')?.focus();
    }, [open, pos]);

    if (!shown) return null;

    const moveFocus = (e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const items = [...menuRef.current.querySelectorAll('[role="menuitemradio"]')];
        const i = items.indexOf(document.activeElement);
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    };

    return (
        <div className="flex items-center" data-testid="step-selector">
            <button ref={btnRef} type="button" role="tab" aria-selected={on} aria-haspopup="menu" aria-expanded={open}
                data-testid="step-select-trigger" onClick={() => setOpen(o => !o)} className={tabClass(on)}>
                <span aria-hidden="true" data-step={shownIndex + 1} className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 before:content-[attr(data-step)] ${on ? 'bg-secondary text-white' : 'bg-gray-100 text-gray-500'}`} />
                {shown.name} <span className="text-gray-400 font-semibold" data-testid={`folder-progress-${shown.id}`} title={titleOf(shown.id)}>({pctOf(shown.id)}%)</span>
                <ChevronDown size={14} aria-hidden="true" className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && pos && createPortal(
                <div ref={menuRef} role="menu" aria-label="Etapas do sinistro" data-testid="step-menu" onKeyDown={moveFocus}
                    style={{ top: pos.top, left: pos.left }}
                    className="fixed z-50 w-[280px] max-h-[60vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-[0_20px_40px_-20px_rgba(15,23,42,.45)]">
                    {steps.map((s, i) => {
                        const cur = s.id === shown.id;
                        return (
                            <button key={s.id} type="button" role="menuitemradio" aria-checked={cur}
                                onClick={() => { onSelect(s.id); setOpen(false); }}
                                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-bold outline-none transition focus-visible:bg-gray-100 ${cur ? 'bg-secondary/5 text-primary' : 'text-gray-600 hover:bg-gray-50'}`}>
                                <span aria-hidden="true" data-step={i + 1} className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 before:content-[attr(data-step)] ${cur ? 'bg-secondary text-white' : 'bg-gray-100 text-gray-500'}`} />
                                <span className="flex-1 truncate">{s.name} <span className="text-gray-400 font-semibold" title={titleOf(s.id)}>({pctOf(s.id)}%)</span></span>
                                {cur && <Check size={14} aria-hidden="true" className="text-secondary shrink-0" />}
                            </button>
                        );
                    })}
                </div>,
                document.body,
            )}
        </div>
    );
}

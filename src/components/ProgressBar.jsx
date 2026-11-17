import { progressLabel } from '../services/claimProgress';

/**
 * Barra de conclusão empilhada: atendido (sólido) seguido de enviado (o mesmo
 * tom, mais claro). `progress` é o que claimProgress/folderProgress devolvem.
 */
export default function ProgressBar({ progress, className = 'h-1.5', label = 'Conclusão', color = 'bg-secondary', track = 'bg-gray-200' }) {
    const a = progress?.atendidoPct ?? 0;
    const e = progress?.enviadoPct ?? 0;
    return (
        <div className={`${className} w-full rounded-full ${track} overflow-hidden flex`}
            role="progressbar" aria-valuenow={a} aria-valuemin={0} aria-valuemax={100}
            aria-valuetext={progressLabel(progress)} aria-label={label}>
            <div data-segment="atendido" className={`h-full ${color} transition-all duration-700`} style={{ width: `${a}%` }} />
            <div data-segment="enviado" className={`h-full ${color} opacity-40 transition-all duration-700`} style={{ width: `${e}%` }} />
        </div>
    );
}

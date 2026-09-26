// Prazo regulatório, visto das listas (álbum, painel, relatórios).
//
// O servidor devolve em todo processo `deadline_start_at` (quando o último
// obrigatório chegou, ou o ajuste manual) e `deadline_due_at` (o vencimento
// efetivo: o manual, senão início + 30 dias, senão null). Tudo o que as listas
// mostram sai desses dois campos — não existe mais prazo "suspenso", e nada é
// calculado a partir da data de criação.

const DAY_MS = 86_400_000;

// Com 5 dias ou menos (e vencido) o sinistro é crítico — o mesmo corte que
// pinta de vermelho o prazo no cartão do sinistro.
export const CRITICAL_DAYS = 5;

const CLOSED = new Set(['done', 'archived']);
const CLOSED_UI = new Set(['Concluído', 'Arquivado']);

export function isClosedClaim(claim) {
    return CLOSED.has(claim?.backStatus) || CLOSED_UI.has(claim?.status);
}

const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

// Dias de calendário até o vencimento (fuso local): 0 no dia do vencimento,
// negativo depois dele. O dia do vencimento ainda conta como dentro do prazo.
// null sem data.
export function daysUntil(dueAt, now = Date.now()) {
    if (!dueAt) return null;
    const due = Date.parse(dueAt);
    if (Number.isNaN(due)) return null;
    return Math.round((startOfDay(due) - startOfDay(now)) / DAY_MS);
}

/**
 * → { state, daysLeft, startAt, dueAt }
 *   state: 'closed' | 'waiting' (sem início e sem vencimento manual)
 *          | 'running' | 'overdue'
 * Um vencimento manual vale mesmo sem início: o prazo corre até ele.
 */
export function deadlineInfo(claim, now = Date.now()) {
    const startAt = claim?.deadlineStartAt || null;
    const dueAt = claim?.deadlineDueAt || null;
    if (isClosedClaim(claim)) return { state: 'closed', daysLeft: null, startAt, dueAt };
    const daysLeft = daysUntil(dueAt, now);
    if (daysLeft === null) return { state: 'waiting', daysLeft: null, startAt, dueAt };
    return { state: daysLeft < 0 ? 'overdue' : 'running', daysLeft, startAt, dueAt };
}

// Aberto, com prazo correndo e 5 dias ou menos — inclui o dia do vencimento e
// os vencidos.
export function isCriticalClaim(claim, now = Date.now()) {
    const { daysLeft } = deadlineInfo(claim, now);
    return daysLeft !== null && daysLeft <= CRITICAL_DAYS;
}

// Chave de ordenação por urgência: vencidos e perto de vencer primeiro, sem
// prazo e encerrados por último.
export function urgencyKey(claim, now = Date.now()) {
    const { daysLeft } = deadlineInfo(claim, now);
    return daysLeft === null ? Number.POSITIVE_INFINITY : daysLeft;
}

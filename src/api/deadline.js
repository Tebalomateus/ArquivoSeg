import { api } from './client';

// Prazo regulatório do sinistro (process-manager, rodada 2).
//
// O prazo só começa a contar quando o último item obrigatório do checklist é
// cumprido: o servidor grava start_at sozinho nessa hora (start_source "auto").
// Criador do sinistro e admin podem corrigir o início ou o vencimento, sempre
// com justificativa, e cada ajuste entra no histórico e na auditoria.
//
// Deadline = {
//   start_at: string|null,          // RFC3339; null = ainda aguardando documentos
//   start_source: 'auto'|'manual'|null,
//   total_days: number,             // 30
//   due_at: string|null,            // RFC3339; start_at + total_days, ou o ajuste manual
//   due_source: 'auto'|'manual'|null,
//   can_adjust: boolean,            // quem pergunta é o criador ou admin
//   history: [{ at, by, by_name, by_email, field: 'start_at'|'due_at', from, to, justification, source: 'auto'|'manual' }]
// }
export function getDeadline(processId) {
    return api.get(`/api/v1/processes/${processId}/deadline`);
}

// body: { start_at?: string, due_at?: string, justification: string (>= 5 chars) }
// 403 DEADLINE_FORBIDDEN quando quem pede não é criador nem admin.
export function adjustDeadline(processId, body) {
    return api.put(`/api/v1/processes/${processId}/deadline`, body);
}

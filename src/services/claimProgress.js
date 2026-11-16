// Conclusão do sinistro, calculada a partir do board de decks.
//
// O percentual guardado em `metadata.progress` / `folder.completion` dependia do
// `received` dos itens do checklist das pastas — que ninguém mais marca desde
// que o kanban assumiu. Quem sabe o que foi entregue é o board: cada tarefa
// (`pastaId.itemId`) tem status pendente, enviado (em análise) ou atendido.
//
// Duas medidas, sobre as tarefas obrigatórias (`required !== false`) das pastas
// não privadas (a Gerencial fica de fora):
//   - atendido: aprovadas pelo analista — conclusão de fato;
//   - enviado:  entregues e aguardando análise — conclusão parcial.
// Os percentuais são empilháveis: atendidoPct + enviadoPct nunca passa de 100.

import { STATUS, persistKey } from '../api/deckBoard';
import { isMockEnabled } from '../api/client';

// O board como o servidor o guarda no metadata do processo (chaves do domínio
// deck: decks, deck_seq, deck_task_status, deck_task_returns). A lista de
// processos já traz o metadata inteiro, então o álbum calcula sem buscar nada.
export function boardFromMetadata(meta) {
    if (!meta || typeof meta !== 'object') return null;
    const hasBoard = meta.decks !== undefined || meta.deck_task_status !== undefined;
    if (!hasBoard) return null;
    return {
        decks: Array.isArray(meta.decks) ? meta.decks : [],
        seq: meta.deck_seq ?? 0,
        taskStatus: (meta.deck_task_status && typeof meta.deck_task_status === 'object') ? meta.deck_task_status : {},
        taskReturns: (meta.deck_task_returns && typeof meta.deck_task_returns === 'object') ? meta.deck_task_returns : {},
    };
}

// O board conhecido de um sinistro. No modo mock a verdade é o sessionStorage
// que o kanban escreve; fora dele, o que veio no metadata (ou o que o kanban
// acabou de propagar para o contexto).
export function boardOf(claim) {
    if (!claim) return null;
    if (isMockEnabled()) {
        try {
            const raw = sessionStorage.getItem(persistKey(claim.id));
            if (raw) return JSON.parse(raw);
        } catch { /* sessionStorage indisponível: cai no que o sinistro tem */ }
    }
    return claim.board || null;
}

const pct = (n, total) => (total > 0 ? Math.round((n / total) * 100) : 0);

function summarize(atendido, enviado, total) {
    const atendidoPct = pct(atendido, total);
    // Cada um arredondado por si (1 de 3 é 33% nos dois rótulos); o teto só
    // impede a barra empilhada de passar de 100.
    const enviadoPct = Math.min(100 - atendidoPct, pct(enviado, total));
    return { total, atendido, enviado, atendidoPct, enviadoPct };
}

const isRequired = (item) => item?.required !== false;

// Progresso de uma pasta: só as tarefas obrigatórias contam.
export function folderProgress(folder, board) {
    const taskStatus = board?.taskStatus || {};
    let atendido = 0;
    let enviado = 0;
    let total = 0;
    for (const item of folder?.checklist || []) {
        if (!isRequired(item)) continue;
        total += 1;
        const st = taskStatus[`${folder.id}.${item.id}`];
        if (st === STATUS.ATENDIDO) atendido += 1;
        else if (st === STATUS.ENVIADO) enviado += 1;
    }
    return summarize(atendido, enviado, total);
}

// Progresso do sinistro inteiro (soma das tarefas, não média das pastas: uma
// pasta com uma tarefa não pesa o mesmo que uma com dez) e o de cada pasta.
export function claimProgress(claim, board = boardOf(claim)) {
    const folders = {};
    let atendido = 0;
    let enviado = 0;
    let total = 0;
    for (const f of claim?.folders || []) {
        if (f.private) continue;
        const p = folderProgress(f, board);
        folders[f.id] = p;
        atendido += p.atendido;
        enviado += p.enviado;
        total += p.total;
    }
    return { ...summarize(atendido, enviado, total), folders };
}

// "60% atendido · 20% enviado" — o rótulo das barras.
export function progressLabel(p) {
    return `${p?.atendidoPct ?? 0}% atendido · ${p?.enviadoPct ?? 0}% enviado`;
}

// dd/mm/aaaa de uma data ISO; '' se não houver data válida.
export function formatDateBR(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
}

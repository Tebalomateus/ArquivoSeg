// Montagem local da visão gerencial — espelha buildGerencialTree do servidor
// (process-manager internal/handler/gerencial.go) como deckBoard.js espelha o
// serviço de deck. Serve ao modo mock (VITE_ENABLE_MOCK), onde não há endpoint
// a chamar: as pastas vêm do sinistro, o board e os arquivos do que o kanban
// guarda no sessionStorage.
//
// Regras, iguais às do servidor:
//   - pastas = as do sinistro menos a própria gerencial (a visão é ela), na ordem;
//   - tarefas = o checklist de cada pasta, inclusive as que não estão em deck;
//   - os arquivos de um deck aparecem sob cada tarefa que o deck carrega (N:N);
//   - status da tarefa vem do board; sem entrada é null;
//   - avulsos = todo arquivo do sinistro que nenhum deck referencia.
//
// Uma diferença consciente: o servidor pula o fileVerId de deck cuja versão foi
// apagada. Aqui um arquivo de deck que não está na lista do sinistro é mantido
// com o que o próprio deck sabe dele — no mock, o upload por tarefa só grava o
// arquivo dentro do deck, não na lista de arquivos do sinistro.

import { parseFolderFromFileName } from './files';

export const LOOSE_ID = 'avulsos';

/**
 * Normaliza um arquivo para a forma da árvore. Aceita tanto a referência que o
 * board guarda ({ fileVerId, nome, tamanho }) quanto a file_version do servidor
 * ({ id, file_name, size_bytes, mime_type, version, created_at }).
 */
export function toTreeFile(f) {
    if (!f) return null;
    const fileVerId = f.fileVerId || f.id || f.ID || null;
    const rawName = f.nome ?? f.file_name ?? f.fileName ?? '';
    const nome = f.nome != null ? f.nome : parseFolderFromFileName(rawName).name;
    return {
        fileVerId,
        nome,
        tamanho: f.tamanho ?? f.size_bytes ?? f.sizeBytes ?? null,
        mimeType: f.mimeType ?? f.mime_type ?? null,
        versao: f.versao ?? f.version ?? null,
        enviadoEm: f.enviadoEm ?? f.created_at ?? f.createdAt ?? null,
        // Só no mock: object-URL da sessão para pré-visualizar sem servidor.
        ...(f.url ? { url: f.url } : {}),
    };
}

export function buildGerencialTree(folders, board, files, processId = null) {
    const decks = Array.isArray(board?.decks) ? board.decks : [];
    const taskStatus = board?.taskStatus || {};

    const byId = new Map();
    for (const raw of files || []) {
        const f = toTreeFile(raw);
        if (f?.fileVerId) byId.set(f.fileVerId, f);
    }

    // Tarefa → deck que a carrega (uma tarefa está em no máximo um deck).
    const deckOfTask = new Map();
    const referenced = new Set();
    for (const d of decks) {
        for (const k of d.tarefaIds || []) deckOfTask.set(k, d);
        for (const f of d.arquivos || []) if (f?.fileVerId) referenced.add(f.fileVerId);
    }

    const filesOfDeck = (d) => (d?.arquivos || [])
        .map(f => byId.get(f.fileVerId) || toTreeFile(f))
        .filter(f => f && f.fileVerId);

    const pastas = (folders || [])
        .filter(f => f.category !== 'gerencial')
        .map(f => ({
            id: f.id,
            nome: f.name,
            categoria: f.category,
            tarefas: (f.checklist || []).map(item => {
                const chave = `${f.id}.${item.id}`;
                const deck = deckOfTask.get(chave) || null;
                return {
                    chave,
                    rotulo: item.name,
                    recebida: !!item.received,
                    status: taskStatus[chave] || null,
                    deckCodigo: deck?.codigo || null,
                    arquivos: deck ? filesOfDeck(deck) : [],
                };
            }),
            arquivos: [],
        }));

    const avulsos = [...byId.values()].filter(f => !referenced.has(f.fileVerId));
    pastas.push({ id: LOOSE_ID, nome: 'Documentos avulsos', categoria: LOOSE_ID, tarefas: [], arquivos: avulsos });

    return { processId, pastas };
}

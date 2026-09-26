import { api } from './client';

// HTTP client for the deck board. State lives in processes.metadata server-side
// (see process-manager internal/handler/deck.go); every mutation returns the whole
// reconciled board: { decks, taskStatus, taskReturns }.

export function listDecks(processId) {
    return api.get(`/api/v1/processes/${processId}/decks`);
}

export function createDeck(processId, { tarefaIds, arquivos }) {
    return api.post(`/api/v1/processes/${processId}/decks`, { tarefaIds, arquivos });
}

// The server assembles the zip while it sends it — nothing is stored packed, so
// there is no "prepare" step to poll and the archive always reflects the deck as
// it is right now.
export function downloadDeckArchive(processId, deckId) {
    return api.download(`/api/v1/processes/${processId}/decks/${deckId}/arquivos.zip`);
}

export function addDeckFiles(processId, deckId, arquivos) {
    return api.post(`/api/v1/processes/${processId}/decks/${deckId}/arquivos`, { arquivos });
}

export function removeDeckFile(processId, deckId, fileVerId) {
    return api.delete(`/api/v1/processes/${processId}/decks/${deckId}/arquivos/${encodeURIComponent(fileVerId)}`);
}

export function attachTasks(processId, deckId, tarefaIds) {
    return api.post(`/api/v1/processes/${processId}/decks/${deckId}/tarefas`, { tarefaIds });
}

export function detachTask(processId, deckId, itemKey) {
    return api.delete(`/api/v1/processes/${processId}/decks/${deckId}/tarefas/${encodeURIComponent(itemKey)}`);
}

export function submitDeck(processId, deckId) {
    return api.post(`/api/v1/processes/${processId}/decks/${deckId}/enviar`, {});
}

export function analyzeDeck(processId, deckId, { devolvidas, motivo }) {
    return api.post(`/api/v1/processes/${processId}/decks/${deckId}/analise`, { devolvidas, motivo });
}

import { api } from './client';

// Uso de armazenamento: soma do tamanho de todas as versões de arquivo não
// excluídas.
//
// getStorageUsage → { data: { total_bytes, file_count,
//     processes: [{ process_id, title, bytes, file_count }] } }  // maior primeiro
// Guardado por processo.listar.
export function getStorageUsage() {
    return api.get('/api/v1/storage/usage');
}

// getProcessStorage → { data: { bytes, file_count } }. Guardado por processo.ver.
export function getProcessStorage(processId) {
    return api.get(`/api/v1/processes/${processId}/storage`);
}

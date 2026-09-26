import { api } from './client';

// A visão gerencial consolidada do sinistro: pastas → tarefas → arquivos, montada
// pelo servidor a partir do metadata do processo, do board e das versões de
// arquivo (process-manager internal/handler/gerencial.go). Só leitura; a rota é
// guardada por processo.verGerencial.
export function getGerencial(processId) {
    return api.get(`/api/v1/processes/${processId}/gerencial`);
}

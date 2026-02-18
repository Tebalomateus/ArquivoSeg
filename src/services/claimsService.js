/**
 * Camada de Serviço para Sinistros (Mock do Backend)
 * ------------------------------------------------
 * ESTE É O "PONTO DE ENTRADA" PARA O BACKEND.
 * Padrão: Repository Pattern simplificado.
 * Quando o back-end for construído (em Node.js, Python, etc.),
 * você deve substituir as chamadas de localStorage por fetch/axios aqui.
 */

export const claimsService = {
    /**
     * Simula a busca de todos os sinistros
     */
    async fetchAllClaims() {
        // Placeholder para GET /api/claims
        const saved = localStorage.getItem('arquivoseg_claims');
        return saved ? JSON.parse(saved) : [];
    },

    /**
     * Simula a criação de um novo sinistro
     */
    async createClaim(claimData) {
        // Placeholder para POST /api/claims
        console.log('[BACKEND MOCK] Criando sinistro:', claimData);
        return claimData;
    },

    /**
     * Simula o upload de um documento
     */
    async uploadDocument(claimId, folderId, file) {
        // Placeholder para POST /api/claims/:id/folders/:folderId/documents
        console.log(`[BACKEND MOCK] Uploading file for claim ${claimId}:`, file.name);
        return {
            id: Date.now().toString(),
            name: file.name,
            date: new Date().toLocaleDateString('pt-BR'),
            confidentiality: 'Geral'
        };
    },

    /**
     * Log de auditoria para visualização de documentos
     */
    async logDocumentView(claimId, docName, user) {
        // Placeholder para POST /api/audit/logs
        console.log(`[AUDIT LOG] Document "${docName}" viewed by ${user} at ${new Date().toISOString()}`);
    }
};

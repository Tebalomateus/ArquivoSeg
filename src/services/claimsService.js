import { isMockEnabled } from '../api/client';
import * as processesApi from '../api/processes';
import * as filesApi from '../api/files';
import * as commentsApi from '../api/comments';
import * as auditApi from '../api/audit';

const realService = {
    fetchAllClaims() {
        return processesApi.listProcesses();
    },
    createClaim({ title, description }) {
        return processesApi.createProcess({ title, description });
    },
    listFiles(processId) {
        return filesApi.listFiles(processId);
    },
    uploadDocument(processId, folderCategory, file) {
        return filesApi.uploadFile(processId, file, folderCategory);
    },
    addComment(processId, body, fileVerId) {
        return commentsApi.createComment(processId, body, fileVerId);
    },
    listComments(processId) {
        return commentsApi.listComments(processId);
    },
    listAudit(processId) {
        return auditApi.listAudit({ resourceType: 'process', resourceId: processId, limit: 50 });
    },
    downloadHref(fileId) {
        return filesApi.downloadHref(fileId);
    },
    async logDocumentView(claimId, docName, user) {
        console.log(`[AUDIT] view registrado pelo back: claim=${claimId} doc="${docName}" user=${user}`);
    },
};

const mockService = {
    async fetchAllClaims() {
        const saved = localStorage.getItem('arquivoseg_claims');
        return { data: saved ? JSON.parse(saved) : [], total: 0 };
    },
    async createClaim(claimData) {
        console.log('[MOCK] createClaim', claimData);
        return { id: Date.now().toString(), ...claimData };
    },
    async listFiles() {
        return { data: [], total: 0 };
    },
    async uploadDocument(claimId, folderCategory, file) {
        console.log(`[MOCK] uploadDocument claim=${claimId} folder=${folderCategory}`, file?.name);
        return { id: Date.now().toString(), file_name: `${folderCategory || ''}/${file?.name || ''}`, created_at: new Date().toISOString() };
    },
    async addComment(processId, body, fileVerId) {
        console.log(`[MOCK] addComment process=${processId} fileVer=${fileVerId}`, body);
        return { id: Date.now().toString(), body, file_ver_id: fileVerId };
    },
    async listComments() {
        return { data: [], total: 0 };
    },
    async listAudit() {
        return { data: [], total: 0 };
    },
    downloadHref(fileId) {
        return `#mock-download-${fileId}`;
    },
    async logDocumentView(claimId, docName, user) {
        console.log(`[MOCK AUDIT] doc "${docName}" visto por ${user} em ${new Date().toISOString()}`);
    },
};

export const claimsService = isMockEnabled() ? mockService : realService;

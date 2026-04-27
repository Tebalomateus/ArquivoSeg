import { isMockEnabled } from '../api/client';
import * as processesApi from '../api/processes';
import * as filesApi from '../api/files';
import * as commentsApi from '../api/comments';
import * as auditApi from '../api/audit';
import * as sharesApi from '../api/shares';
import * as clientsApi from '../api/clients';
import * as usersApi from '../api/users';

const realService = {
    fetchAllClaims(opts) {
        return processesApi.listProcesses(opts);
    },
    createClaim({ title, description, metadata }) {
        return processesApi.createProcess({ title, description, metadata });
    },
    updateClaim(processId, patch) {
        return processesApi.updateProcess(processId, patch);
    },
    archiveClaim(processId) {
        return processesApi.archiveProcess(processId);
    },
    listFiles(processId) {
        return filesApi.listFiles(processId);
    },
    uploadDocument(processId, folderCategory, file) {
        return filesApi.uploadFile(processId, file, folderCategory);
    },
    deleteDocument(fileVerId) {
        return filesApi.deleteFile(fileVerId);
    },
    listFileVersions(fileVerId) {
        return filesApi.listVersions(fileVerId);
    },
    addComment(processId, body, fileVerId) {
        return commentsApi.createComment(processId, body, fileVerId);
    },
    updateComment(commentId, body) {
        return commentsApi.updateComment(commentId, body);
    },
    deleteComment(commentId) {
        return commentsApi.deleteComment(commentId);
    },
    listComments(processId) {
        return commentsApi.listComments(processId);
    },
    listAudit(processId) {
        return auditApi.listAudit({ resourceType: 'process', resourceId: processId, limit: 50 });
    },
    listAuditByShareToken(tokenId) {
        return auditApi.listAudit({ resourceType: 'share_token', resourceId: tokenId, limit: 200 });
    },
    listShares(fileVerId) {
        return sharesApi.listShares(fileVerId);
    },
    createShare(fileVerId, opts) {
        return sharesApi.createShare(fileVerId, opts);
    },
    revokeShare(tokenId) {
        return sharesApi.revokeShare(tokenId);
    },
    listClients(opts) {
        return clientsApi.listClients(opts);
    },
    createClient(payload) {
        return clientsApi.createClient(payload);
    },
    updateClient(id, patch) {
        return clientsApi.updateClient(id, patch);
    },
    deleteClient(id) {
        return clientsApi.deleteClient(id);
    },
    listUsers() {
        return usersApi.listUsers();
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
    async updateClaim(processId, patch) {
        console.log(`[MOCK] updateClaim process=${processId}`, patch);
        return { id: processId, ...patch };
    },
    async archiveClaim(processId) {
        console.log(`[MOCK] archiveClaim process=${processId}`);
    },
    async listFiles() {
        return { data: [], total: 0 };
    },
    async uploadDocument(claimId, folderCategory, file) {
        console.log(`[MOCK] uploadDocument claim=${claimId} folder=${folderCategory}`, file?.name);
        return { id: Date.now().toString(), file_name: `${folderCategory || ''}/${file?.name || ''}`, created_at: new Date().toISOString() };
    },
    async deleteDocument(fileVerId) {
        console.log(`[MOCK] deleteDocument ${fileVerId}`);
    },
    async listFileVersions() {
        return { data: [], total: 0 };
    },
    async addComment(processId, body, fileVerId) {
        console.log(`[MOCK] addComment process=${processId} fileVer=${fileVerId}`, body);
        return { id: Date.now().toString(), body, file_ver_id: fileVerId };
    },
    async updateComment(commentId, body) {
        console.log(`[MOCK] updateComment ${commentId}`, body);
        return { id: commentId, body };
    },
    async deleteComment(commentId) {
        console.log(`[MOCK] deleteComment ${commentId}`);
    },
    async listComments() {
        return { data: [], total: 0 };
    },
    async listAudit() {
        return { data: [], total: 0 };
    },
    async listAuditByShareToken() {
        return { data: [], total: 0 };
    },
    async listShares() {
        return { data: [], total: 0 };
    },
    async createShare(fileVerId, opts) {
        console.log(`[MOCK] createShare file=${fileVerId}`, opts);
        return { id: Date.now().toString(), token: 'mock-' + Date.now() };
    },
    async revokeShare(tokenId) {
        console.log(`[MOCK] revokeShare ${tokenId}`);
    },
    async listClients() {
        const saved = localStorage.getItem('arquivoseg_clients');
        const clients = saved ? JSON.parse(saved) : [];
        return { data: clients, total: clients.length };
    },
    async createClient(payload) {
        return { id: 'c-' + Date.now(), ...payload };
    },
    async updateClient(id, patch) {
        return { id, ...patch };
    },
    async deleteClient() {
        return null;
    },
    async listUsers() {
        const saved = localStorage.getItem('arquivoseg_users');
        const users = saved ? JSON.parse(saved) : [];
        return { data: users, total: users.length };
    },
    downloadHref(fileId) {
        return `#mock-download-${fileId}`;
    },
    async logDocumentView(claimId, docName, user) {
        console.log(`[MOCK AUDIT] doc "${docName}" visto por ${user} em ${new Date().toISOString()}`);
    },
};

export const claimsService = isMockEnabled() ? mockService : realService;

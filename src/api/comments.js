import { api } from './client';

export function listComments(processId) {
    return api.get(`/api/v1/processes/${processId}/comments`);
}

export function createComment(processId, body, fileVerId) {
    const payload = { body };
    if (fileVerId) payload.file_ver_id = fileVerId;
    return api.post(`/api/v1/processes/${processId}/comments`, payload);
}

export function updateComment(commentId, body) {
    return api.patch(`/api/v1/comments/${commentId}`, { body });
}

export function deleteComment(commentId) {
    return api.delete(`/api/v1/comments/${commentId}`);
}

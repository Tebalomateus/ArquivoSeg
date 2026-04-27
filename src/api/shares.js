import { api } from './client';

export function listShares(fileVerId) {
    return api.get(`/api/v1/files/${fileVerId}/shares`);
}

export function createShare(fileVerId, { label, expiresAt } = {}) {
    const body = {};
    if (label) body.label = label;
    if (expiresAt) body.expires_at = expiresAt;
    return api.post(`/api/v1/files/${fileVerId}/shares`, body);
}

export function revokeShare(tokenId) {
    return api.delete(`/api/v1/shares/${tokenId}`);
}

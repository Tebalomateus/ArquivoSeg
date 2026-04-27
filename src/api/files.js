import { api } from './client';

export function listFiles(processId) {
    return api.get(`/api/v1/processes/${processId}/files`);
}

export async function uploadFile(processId, file, folderCategory) {
    const fd = new FormData();
    const prefix = folderCategory ? `${folderCategory}/` : '';
    fd.append('file', file, `${prefix}${file.name}`);
    return api.postMultipart(`/api/v1/processes/${processId}/files`, fd);
}

export function listVersions(fileId) {
    return api.get(`/api/v1/files/${fileId}/versions`);
}

export function downloadHref(fileId) {
    return `/api/v1/files/${fileId}/download`;
}

export function deleteFile(fileId) {
    return api.delete(`/api/v1/files/${fileId}`);
}

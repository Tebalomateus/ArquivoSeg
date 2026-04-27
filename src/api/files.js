import { api } from './client';

// The backend's multipart parser calls filepath.Base() on the upload filename, so any
// "/" path prefix is stripped. We encode the folder category as a "<cat>__<name>" prefix
// using a separator that survives Base() and is uncommon in filenames.
export const FOLDER_SEP = '__';

export function listFiles(processId) {
    return api.get(`/api/v1/processes/${processId}/files`);
}

export async function uploadFile(processId, file, folderCategory) {
    const fd = new FormData();
    const prefix = folderCategory ? `${folderCategory}${FOLDER_SEP}` : '';
    fd.append('file', file, `${prefix}${file.name}`);
    return api.postMultipart(`/api/v1/processes/${processId}/files`, fd);
}

export function parseFolderFromFileName(fileName, knownCategories = ['causa', 'prejuizo', 'liquidacao', 'gerencial']) {
    if (!fileName) return { category: null, name: '' };
    const idx = fileName.indexOf(FOLDER_SEP);
    if (idx <= 0) return { category: null, name: fileName };
    const head = fileName.slice(0, idx);
    if (!knownCategories.includes(head)) return { category: null, name: fileName };
    return { category: head, name: fileName.slice(idx + FOLDER_SEP.length) };
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

import { api, getToken } from './client';

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

// Pretty-print file size (back returns int64 size_bytes).
export function formatBytes(bytes) {
    if (bytes == null || isNaN(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Short label from a MIME type (e.g. "application/pdf" → "PDF").
export function mimeShortLabel(mime) {
    if (!mime) return '';
    const m = String(mime).toLowerCase();
    if (m.includes('pdf')) return 'PDF';
    if (m.startsWith('image/')) return 'Imagem';
    if (m.includes('spreadsheet') || m.includes('excel') || m.endsWith('csv')) return 'Planilha';
    if (m.includes('word') || m.includes('document')) return 'Documento';
    if (m.startsWith('text/')) return 'Texto';
    if (m.includes('zip') || m.includes('compressed')) return 'Compactado';
    return m.split('/')[1]?.toUpperCase() || 'Arquivo';
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

// GET /files/:id/download requires a Bearer token and 302s to a presigned MinIO URL.
// A plain <a href>/window.open() never attaches Authorization, so in production
// (front and back on different origins) this either 401s or — worse — resolves
// against the SPA's own origin and gets swallowed by its catch-all route.
// Fetch it ourselves, follow the redirect, and hand back a blob object URL.
async function fetchDocumentBlobUrl(fileId) {
    const token = getToken();
    const base = import.meta.env.VITE_API_BASE_URL ?? '';
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${base}${downloadHref(fileId)}`, { headers });
    if (!res.ok) {
        throw new Error(`Não foi possível baixar o documento (HTTP ${res.status}).`);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
}

export async function openDocument(fileId) {
    const url = await fetchDocumentBlobUrl(fileId);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadDocument(fileId, filename) {
    const url = await fetchDocumentBlobUrl(fileId);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'documento';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function deleteFile(fileId) {
    return api.delete(`/api/v1/files/${fileId}`);
}

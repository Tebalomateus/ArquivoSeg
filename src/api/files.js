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

// GET /files/:id/download requires a Bearer token and normally 302s to a presigned
// S3 URL. A cross-origin fetch that carries Authorization is preflighted, and
// browsers refuse to follow a cross-origin redirect on a preflighted request
// (surfaces as an opaque "Failed to fetch" / CORS error). So we ask the backend
// for the URL as JSON (?json=1 → no redirect) and then open/download it directly:
// a navigation to the presigned URL needs no CORS at all.
async function presignedUrl(fileId) {
    const token = getToken();
    const base = import.meta.env.VITE_API_BASE_URL ?? '';
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${base}${downloadHref(fileId)}?json=1`, { headers });
    if (!res.ok) {
        throw new Error(`Não foi possível obter o documento (HTTP ${res.status}).`);
    }
    const data = await res.json();
    if (!data?.url) throw new Error('Resposta inválida do servidor (sem URL do documento).');
    return data.url;
}

export async function openDocument(fileId) {
    // Open the tab synchronously (inside the click) so popup blockers allow it,
    // then point it at the presigned URL once we have it.
    const win = window.open('about:blank', '_blank');
    try {
        const url = await presignedUrl(fileId);
        if (win) { win.opener = null; win.location.replace(url); }
        else window.open(url, '_blank', 'noopener,noreferrer'); // popup was blocked — retry
    } catch (err) {
        if (win) win.close();
        throw err;
    }
}

export async function downloadDocument(fileId, filename) {
    const url = await presignedUrl(fileId);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'documento';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
}

export function deleteFile(fileId) {
    return api.delete(`/api/v1/files/${fileId}`);
}

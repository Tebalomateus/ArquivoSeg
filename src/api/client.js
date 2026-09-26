const TOKEN_KEY = 'sato_token';

export const isMockEnabled = () => import.meta.env.VITE_ENABLE_MOCK !== 'false';

export function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
}

class HttpError extends Error {
    constructor(status, code, message, body) {
        super(message);
        this.status = status;
        this.code = code;
        this.body = body;
    }
}

async function request(method, path, { body, headers = {}, multipart = false } = {}) {
    const token = getToken();
    const finalHeaders = { ...headers };
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`;

    let finalBody = body;
    if (body && !multipart) {
        finalHeaders['Content-Type'] = 'application/json';
        finalBody = JSON.stringify(body);
    }

    const base = import.meta.env.VITE_API_BASE_URL ?? '';
    const res = await fetch(`${base}${path}`, { method, headers: finalHeaders, body: finalBody });

    if (res.status === 204) return null;

    const text = await res.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }

    if (!res.ok) {
        const code = parsed?.error?.code || `HTTP_${res.status}`;
        const message = parsed?.error?.message || res.statusText || 'Request failed';
        throw new HttpError(res.status, code, message, parsed);
    }

    return parsed;
}

// Downloads that are not JSON. It cannot go through request(): that one reads
// the whole response as text to parse it, which would corrupt binary and defeat
// the point of the server streaming. A plain <a download> would be simpler but
// carries no Authorization header, so the fetch has to happen here.
//
// The caller gets a Blob, so the archive does land in browser memory even though
// the server never buffered it. That is the browser's limit, not the API's: the
// alternative is a short-lived signed URL, worth doing if deck sizes ever make
// this hurt.
async function download(path) {
    const token = getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const base = import.meta.env.VITE_API_BASE_URL ?? '';
    const res = await fetch(`${base}${path}`, { method: 'GET', headers });

    if (!res.ok) {
        // The error path *is* JSON — only the success path is binary.
        let parsed = null;
        try { parsed = await res.json(); } catch { /* empty or non-JSON body */ }
        throw new HttpError(
            res.status,
            parsed?.error?.code || `HTTP_${res.status}`,
            parsed?.error?.message || res.statusText || 'Download failed',
            parsed,
        );
    }

    return { blob: await res.blob(), fileName: fileNameFromDisposition(res.headers.get('Content-Disposition')) };
}

/** Reads `attachment; filename="DECK-01.zip"` — the server names the download. */
function fileNameFromDisposition(header) {
    const match = /filename="?([^";]+)"?/i.exec(header || '');
    return match ? match[1] : null;
}

export const api = {
    get: (path) => request('GET', path),
    download,
    post: (path, body) => request('POST', path, { body }),
    put: (path, body) => request('PUT', path, { body }),
    patch: (path, body) => request('PATCH', path, { body }),
    delete: (path) => request('DELETE', path),
    postMultipart: (path, formData) => request('POST', path, { body: formData, multipart: true }),
};

export { HttpError };

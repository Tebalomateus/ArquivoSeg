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

export const api = {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, { body }),
    patch: (path, body) => request('PATCH', path, { body }),
    delete: (path) => request('DELETE', path),
    postMultipart: (path, formData) => request('POST', path, { body: formData, multipart: true }),
};

export { HttpError };

const TOKEN_KEY = 'bo_token';

export function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
}

class HttpError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

async function request(method, path, { body, contentType } = {}) {
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let finalBody = undefined;
    if (body !== undefined) {
        if (typeof body === 'string') {
            headers['Content-Type'] = contentType || 'text/yaml; charset=utf-8';
            finalBody = body;
        } else {
            headers['Content-Type'] = 'application/json';
            finalBody = JSON.stringify(body);
        }
    }

    const base = import.meta.env.VITE_API_BASE_URL ?? '';
    const res = await fetch(`${base}${path}`, { method, headers, body: finalBody });

    if (res.status === 204) return null;

    const text = await res.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : text; } catch { parsed = text; }

    if (!res.ok) {
        const code = (parsed?.error?.code) || `HTTP_${res.status}`;
        const message = (parsed?.error?.message) || res.statusText || 'Request failed';
        throw new HttpError(res.status, code, message);
    }

    return parsed;
}

export const api = {
    get: (path) => request('GET', path),
    put: (path, body) => request('PUT', path, { body }),
    delete: (path) => request('DELETE', path),
};

export { HttpError };

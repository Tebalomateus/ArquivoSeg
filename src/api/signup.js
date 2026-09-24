import { api } from './client';

// Public self-service tenant signup — no auth token is attached (see api/client.js:
// request() only adds Authorization when a token exists in sessionStorage, which a
// prospect signing up doesn't have yet).

export function startSignup(data) {
    return api.post('/api/v1/signup', data);
}

export function getSignupStatus(id) {
    return api.get(`/api/v1/signup/${id}`);
}

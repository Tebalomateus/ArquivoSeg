import { api } from './client';

// The permission catalog describes the product, not the tenant, so it only
// changes on deploy — the backend serves it with an ETag and the browser
// revalidates for free.
export function getActionCatalog() {
    return api.get('/api/v1/iam/actions');
}

// The caller's own effective access. Returns the expanded list (wildcards
// already resolved against the catalog) plus a policy_version to revalidate on.
export function getMyPermissions() {
    return api.get('/api/v1/me/permissions');
}

export function listRoles() {
    return api.get('/api/v1/iam/roles');
}

export function getRole(id) {
    return api.get(`/api/v1/iam/roles/${id}`);
}

export function createRole(data) {
    return api.post('/api/v1/iam/roles', data);
}

export function updateRole(id, data) {
    return api.patch(`/api/v1/iam/roles/${id}`, data);
}

// force drops the assignments in the same transaction. Without it the API
// refuses with ROLE_IN_USE and says how many people hold the role, so the UI can
// name the blast radius instead of asking the admin to guess.
export function deleteRole(id, { force = false } = {}) {
    return api.delete(`/api/v1/iam/roles/${id}${force ? '?force=true' : ''}`);
}

export function listGroups() {
    return api.get('/api/v1/iam/groups');
}

export function getGroup(id) {
    return api.get(`/api/v1/iam/groups/${id}`);
}

export function createGroup(data) {
    return api.post('/api/v1/iam/groups', data);
}

export function updateGroup(id, data) {
    return api.patch(`/api/v1/iam/groups/${id}`, data);
}

export function deleteGroup(id) {
    return api.delete(`/api/v1/iam/groups/${id}`);
}

// The membership as it should end up, not a delta.
export function setGroupMembers(id, userIds) {
    return api.put(`/api/v1/iam/groups/${id}/members`, { user_ids: userIds });
}

export function getUserAccess(id) {
    return api.get(`/api/v1/users/${id}`);
}

// confirm is the admin's explicit go-ahead when the change costs them their own
// IAM access; without it the API answers 409 SELF_DEMOTION.
export function setUserRoles(id, roleIds, { confirm = false } = {}) {
    return api.put(`/api/v1/users/${id}/roles${confirm ? '?confirm=true' : ''}`, { role_ids: roleIds });
}

export function setUserPermissions(id, permissions, { confirm = false } = {}) {
    return api.put(
        `/api/v1/users/${id}/permissions${confirm ? '?confirm=true' : ''}`,
        { permissions },
    );
}

// Every action the person can be judged on, with the verdict and each reason
// behind it — including which pattern matched, so a wildcard reads as a
// wildcard and not as the action it expanded to.
export function getEffectivePermissions(id) {
    return api.get(`/api/v1/users/${id}/effective-permissions`);
}

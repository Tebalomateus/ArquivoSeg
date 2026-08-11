import { CATALOG, ALL_ACTIONS, matches } from './catalog.js';

/**
 * A small, stateful stand-in for the IAM API, installed as a Playwright route.
 *
 * It is not a mock in the "return canned JSON" sense: it holds state across
 * requests, so a spec can create a role, assign it, and then read the effective
 * access that follows from it. What it copies from the real server is only what
 * the screens can actually observe — the response envelope, and the three
 * refusals that exist as answers rather than as UI rules:
 *
 *   ROLE_IN_USE    a role somebody still holds, with the count in details
 *   SELF_DEMOTION  you are taking access away from yourself; confirm=true retries
 *   LAST_ADMIN     you are the last admin; there is no confirm, on purpose
 *
 * The state object is returned to the spec, so assertions can be made against
 * what the server ended up holding — "the wildcard was stored as processo.*" is
 * a stronger claim than "the checkbox looked ticked".
 *
 * With E2E_LIVE=1 nothing is installed and the specs hit whatever the app is
 * configured to talk to.
 */

export const SELF_ID = 'u-admin';

export function initialState() {
    return {
        catalog: CATALOG,
        users: [
            { id: SELF_ID, email: 'sato@arquivoseg.com.br', role: 'admin', status: 'active' },
            { id: 'u-ana', email: 'ana.souza@allianz.com', role: 'user', status: 'active' },
            { id: 'u-maria', email: 'analista@arquivoseg.com.br', role: 'user', status: 'invited' },
        ],
        roles: [
            {
                id: 'r-admin',
                key: 'admin',
                name: 'Administrador',
                description: 'Papel de sistema: acesso total ao tenant.',
                is_system: true,
                permissions: ['*'],
            },
            {
                id: 'r-leitor',
                key: 'leitor',
                name: 'Leitor',
                description: 'Só leitura de sinistros.',
                is_system: false,
                permissions: ['processo.listar', 'processo.ver'],
            },
        ],
        groups: [
            {
                id: 'g-regulacao',
                key: 'equipe_regulacao',
                name: 'Equipe de Regulação',
                description: 'Quem regula sinistros.',
                role_ids: ['r-leitor'],
                member_ids: ['u-maria'],
            },
        ],
        userRoles: { [SELF_ID]: ['r-admin'], 'u-ana': [], 'u-maria': [] },
        individual: { [SELF_ID]: [], 'u-ana': [], 'u-maria': [] },
        // Requests the specs may want to inspect afterwards.
        requests: [],
        nextId: 1,
    };
}

const ok = (data) => ({ status: 200, body: { data } });
const noContent = () => ({ status: 204, body: null });
const fail = (status, code, message, details) => ({
    status,
    body: { error: { code, message, request_id: 'e2e', ...(details ? { details } : {}) } },
});

function isAdminUser(state, userId) {
    return state.users.find((u) => u.id === userId)?.role === 'admin';
}

function adminCount(state) {
    return state.users.filter((u) => u.role === 'admin').length;
}

/** How many people hold a role, directly or through a group. */
function holders(state, roleId) {
    const direct = Object.values(state.userRoles).filter((ids) => ids.includes(roleId)).length;
    const viaGroups = state.groups
        .filter((g) => g.role_ids.includes(roleId))
        .reduce((n, g) => n + g.member_ids.length, 0);
    return direct + viaGroups;
}

/** Quem tem o papel diretamente — o que o servidor manda em member_ids. */
function directHolders(state, roleId) {
    return Object.entries(state.userRoles)
        .filter(([, ids]) => ids.includes(roleId))
        .map(([userId]) => userId);
}

function roleView(state, role) {
    return { ...role, members_count: holders(state, role.id), member_ids: directHolders(state, role.id) };
}

function groupsOf(state, userId) {
    return state.groups.filter((g) => g.member_ids.includes(userId));
}

// Groups travel with their roles embedded, the way the API serves them: the
// screen reads group.roles, and a list of ids would render a group as granting
// nothing.
function groupView(state, group) {
    return { ...group, roles: state.roles.filter((r) => group.role_ids.includes(r.id)).map((r) => ({ id: r.id, key: r.key, name: r.name })) };
}

function accessView(state, userId) {
    const roleIds = state.userRoles[userId] || [];
    return {
        user_id: userId,
        is_admin: isAdminUser(state, userId),
        roles: state.roles.filter((r) => roleIds.includes(r.id)).map((r) => ({ id: r.id, key: r.key, name: r.name })),
        groups: groupsOf(state, userId).map((g) => ({
            id: g.id,
            name: g.name,
            roles: state.roles.filter((r) => g.role_ids.includes(r.id)).map((r) => ({ id: r.id, name: r.name })),
        })),
        individual_permissions: state.individual[userId] || [],
    };
}

/**
 * The verdict per action, with every reason behind it — the same resolution the
 * backend does: deny wins over everything, admin is an implicit `*`, and the
 * pattern that matched travels with the source so a wildcard reads as one.
 */
function effectiveView(state, userId) {
    const grants = [];
    if (isAdminUser(state, userId)) {
        grants.push({ type: 'admin', name: 'admin', effect: 'allow', pattern: '*' });
    }
    for (const role of state.roles.filter((r) => (state.userRoles[userId] || []).includes(r.id))) {
        for (const pattern of role.permissions) {
            grants.push({ type: 'role', name: role.name, effect: 'allow', pattern });
        }
    }
    for (const group of groupsOf(state, userId)) {
        for (const role of state.roles.filter((r) => group.role_ids.includes(r.id))) {
            for (const pattern of role.permissions) {
                grants.push({ type: 'group_role', name: role.name, group_name: group.name, effect: 'allow', pattern });
            }
        }
    }
    for (const g of state.individual[userId] || []) {
        grants.push({ type: 'individual', name: 'individual', effect: g.effect, pattern: g.action });
    }

    const permissions = ALL_ACTIONS.map((action) => {
        const sources = grants
            .filter((g) => matches(g.pattern, action))
            .map((g) => ({
                type: g.type,
                name: g.name,
                ...(g.group_name ? { group_name: g.group_name } : {}),
                effect: g.effect,
                matched: g.pattern,
            }));
        const denied = sources.some((s) => s.effect === 'deny');
        const allowed = sources.some((s) => s.effect === 'allow');
        return { action, effect: !denied && allowed ? 'allow' : 'deny', sources };
    });

    return { user_id: userId, permissions, policy_version: state.nextId };
}

function handle(state, method, seg, params, body) {
    const confirm = params.get('confirm') === 'true';
    const force = params.get('force') === 'true';
    const [a, b, c] = seg;

    if (a === 'iam' && b === 'actions' && method === 'GET') return ok(state.catalog);

    if (a === 'me' && b === 'permissions' && method === 'GET') {
        const eff = effectiveView(state, SELF_ID);
        return ok({
            user_id: SELF_ID,
            is_admin: true,
            permissions: eff.permissions.filter((p) => p.effect === 'allow').map((p) => p.action),
            policy_version: eff.policy_version,
        });
    }

    if (a === 'iam' && b === 'roles') {
        if (!c && method === 'GET') return ok(state.roles.map((r) => roleView(state, r)));
        if (!c && method === 'POST') {
            if (state.roles.some((r) => r.key === body.key)) {
                return fail(409, 'ROLE_KEY_TAKEN', 'Já existe um papel com esta chave.');
            }
            const role = {
                id: `r-${state.nextId++}`,
                key: body.key,
                name: body.name,
                description: body.description || '',
                is_system: false,
                permissions: body.permissions || [],
            };
            state.roles.push(role);
            return { status: 201, body: { data: roleView(state, role) } };
        }
        const role = state.roles.find((r) => r.id === c);
        if (!role) return fail(404, 'NOT_FOUND', 'Papel não encontrado.');
        if (method === 'GET') return ok(roleView(state, role));
        if (method === 'PATCH') {
            if (role.is_system) return fail(403, 'ROLE_IMMUTABLE', 'Papel de sistema não pode ser alterado.');
            Object.assign(role, {
                name: body.name ?? role.name,
                description: body.description ?? role.description,
                permissions: body.permissions ?? role.permissions,
            });
            return ok(roleView(state, role));
        }
        if (method === 'DELETE') {
            if (role.is_system) return fail(403, 'ROLE_IMMUTABLE', 'Papel de sistema não pode ser excluído.');
            const count = holders(state, role.id);
            if (count > 0 && !force) {
                return fail(409, 'ROLE_IN_USE', 'Papel ainda atribuído.', { assignments: count });
            }
            state.roles = state.roles.filter((r) => r.id !== role.id);
            for (const uid of Object.keys(state.userRoles)) {
                state.userRoles[uid] = state.userRoles[uid].filter((id) => id !== role.id);
            }
            for (const g of state.groups) g.role_ids = g.role_ids.filter((id) => id !== role.id);
            return noContent();
        }
    }

    if (a === 'iam' && b === 'groups') {
        if (!c && method === 'GET') return ok(state.groups.map((g) => groupView(state, g)));
        if (!c && method === 'POST') {
            const group = {
                id: `g-${state.nextId++}`,
                key: body.key,
                name: body.name,
                description: body.description || '',
                role_ids: body.role_ids || [],
                member_ids: [],
            };
            state.groups.push(group);
            return { status: 201, body: { data: groupView(state, group) } };
        }
        const group = state.groups.find((g) => g.id === c);
        if (!group) return fail(404, 'NOT_FOUND', 'Grupo não encontrado.');
        if (seg[3] === 'members' && method === 'PUT') {
            group.member_ids = body.user_ids || [];
            return ok(groupView(state, group));
        }
        if (method === 'GET') return ok(groupView(state, group));
        if (method === 'PATCH') {
            Object.assign(group, {
                name: body.name ?? group.name,
                description: body.description ?? group.description,
                role_ids: body.role_ids ?? group.role_ids,
            });
            return ok(groupView(state, group));
        }
        if (method === 'DELETE') {
            state.groups = state.groups.filter((g) => g.id !== group.id);
            return noContent();
        }
    }

    if (a === 'users') {
        if (!b && method === 'GET') return ok(state.users);

        // Account lifecycle. The real handlers also talk to Zitadel; here only
        // the tenant-side effect is modelled, which is what the screen shows.
        if (b === 'invite' && method === 'POST') {
            if (state.users.some((u) => u.email === body.email)) {
                return fail(409, 'CONFLICT', 'Já existe um usuário com este e-mail.');
            }
            const created = {
                id: `u-${state.nextId++}`,
                email: body.email,
                role: 'user',
                status: 'invited',
            };
            state.users.push(created);
            state.userRoles[created.id] = body.role_ids || [];
            return ok(created);
        }

        const user = state.users.find((u) => u.id === b);
        if (!user) return fail(404, 'NOT_FOUND', 'Usuário não encontrado.');

        if (!c && method === 'GET') return ok(accessView(state, user.id));
        if (c === 'effective-permissions' && method === 'GET') return ok(effectiveView(state, user.id));

        if (c === 'resend-invite' && method === 'POST') return ok({ sent: true });

        if (!c && method === 'DELETE') {
            if (isAdminUser(state, user.id) && adminCount(state) === 1) {
                return fail(409, 'LAST_ADMIN', 'Este é o último admin do tenant.');
            }
            user.status = 'inactive';
            return noContent();
        }

        if (c === 'roles' && method === 'PUT') {
            const next = body.role_ids || [];
            const current = state.userRoles[user.id] || [];
            const removing = current.some((id) => !next.includes(id));
            if (removing && user.id === SELF_ID && !confirm) {
                return fail(409, 'SELF_DEMOTION', 'Você está removendo o seu próprio acesso.');
            }
            state.userRoles[user.id] = next;
            state.nextId++;
            return ok(accessView(state, user.id));
        }

        if (c === 'permissions' && method === 'PUT') {
            const next = body.permissions || [];
            const before = new Set((state.individual[user.id] || []).map((g) => `${g.action}:${g.effect}`));
            const addedDenies = next.filter((g) => g.effect === 'deny' && !before.has(`${g.action}:deny`));

            // The rule that has no override: the last admin cannot be cut off
            // from IAM, not even by their own hand. There is no confirm=true for
            // this one because nobody would be left to undo it.
            if (
                isAdminUser(state, user.id) &&
                adminCount(state) === 1 &&
                addedDenies.some((g) => matches(g.action, 'iam.atribuir') || matches(g.action, 'iam.gerenciarPapeis'))
            ) {
                return fail(409, 'LAST_ADMIN', 'Este é o último admin do tenant: o acesso de IAM não pode ser removido.');
            }
            if (addedDenies.length > 0 && user.id === SELF_ID && !confirm) {
                return fail(409, 'SELF_DEMOTION', 'Você está removendo o seu próprio acesso.');
            }
            state.individual[user.id] = next;
            state.nextId++;
            return ok(accessView(state, user.id));
        }
    }

    return null;
}

export async function installIamApi(page, mutate) {
    const state = initialState();
    if (mutate) mutate(state);
    if (process.env.E2E_LIVE === '1') return state;

    // Narrow on purpose: `**/api/**` would also catch the dev server serving
    // src/api/iam.js as a module, and the app would come up blank.
    await page.route('**/api/v1/**', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const seg = url.pathname.replace(/^\/api\/v1\/?/, '').split('/').filter(Boolean);
        let body = null;
        try {
            body = request.postData() ? JSON.parse(request.postData()) : null;
        } catch {
            body = null;
        }
        state.requests.push({ method: request.method(), path: url.pathname + url.search, body });

        const res = handle(state, request.method(), seg, url.searchParams, body);

        // Anything the specs do not model — /processes on the app shell, for
        // instance — answers empty instead of hanging or 404-ing into an error
        // banner that has nothing to do with what is under test.
        const final = res || ok([]);
        await route.fulfill({
            status: final.status,
            contentType: 'application/json',
            body: final.body === null ? '' : JSON.stringify(final.body),
        });
    });

    return state;
}

/**
 * Signing in, without the sign-in.
 *
 * The login screen is Zitadel's in every mode that matters, and driving an OIDC
 * dance would test Zitadel rather than the gating. So the specs plant the same
 * session the app itself persists — that is the contract ClaimsContext restores
 * from on boot, and if it changes, these break, which is the right outcome.
 */
export const PERSONAS = {
    admin: {
        id: 'u-admin',
        name: 'Carlos Sato',
        email: 'sato@arquivoseg.com.br',
        role: 'ADMIN',
        backRole: 'admin',
        isAdmin: true,
        status: 'Ativo',
        company: 'ArquivoSeg',
    },
    manager: {
        id: 2,
        name: 'Ricardo Silva',
        email: 'ricardo@corretora.com',
        role: 'CORRETOR',
        backRole: 'manager',
        isAdmin: false,
        status: 'Ativo',
        company: 'Silva Seguros',
    },
    contributor: {
        id: 3,
        name: 'Ana Souza',
        email: 'ana.souza@allianz.com',
        role: 'PERITO',
        backRole: 'contributor',
        isAdmin: false,
        status: 'Ativo',
        company: 'Allianz',
    },
    viewer: {
        id: 4,
        name: 'Maria Costa',
        email: 'analista@arquivoseg.com.br',
        role: 'ANALISTA',
        backRole: 'viewer',
        isAdmin: false,
        status: 'Ativo',
        company: 'ArquivoSeg',
    },
};

/**
 * signIn plants the session before the first navigation. `token` is what makes
 * ClaimsContext talk HTTP at all, so it is required in the API-backed project
 * and pointless in the mock one.
 */
export async function signIn(page, persona, { token } = {}) {
    const user = PERSONAS[persona];
    if (!user) throw new Error(`unknown persona: ${persona}`);
    await page.addInitScript(
        ({ user, token }) => {
            localStorage.setItem('arquivoseg_authenticated', 'true');
            localStorage.setItem('arquivoseg_current_user', JSON.stringify(user));
            // A permission cache from another run would answer before the API does.
            sessionStorage.removeItem('arquivoseg_permissions');
            if (token) sessionStorage.setItem('sato_token', token);
        },
        { user, token },
    );
}

/** The admin, signed in and talking to the fake API. The opening line of every access spec. */
export async function signInAdminWithApi(page, installIamApi, mutate) {
    await signIn(page, 'admin', { token: 'e2e-token' });
    return installIamApi(page, mutate);
}

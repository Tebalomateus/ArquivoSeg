import { defineConfig, devices } from '@playwright/test';

/**
 * The first test infrastructure in this repo, and IAM is what justifies it: a
 * gating bug does not show up as an error on screen, it shows up as access
 * somebody should not have had.
 *
 * Two profiles, on two dev servers, because the two halves of the feature fail
 * in different ways:
 *
 * - `mock` (VITE_ENABLE_MOCK=true) — the app running on its local fixtures, no
 *   backend anywhere. This is where the *gating* lives: which controls exist
 *   for which permission set.
 * - `acessos` (VITE_ENABLE_MOCK=false) — the app talking HTTP, with Playwright
 *   playing the API (see e2e/fixtures/iam-api.js). This is where the admin
 *   screens live, including the refusals (ROLE_IN_USE, SELF_DEMOTION,
 *   LAST_ADMIN) that only exist as server answers.
 *
 * Running against the real stack instead is `E2E_LIVE=1` plus a backend on
 * VITE_API_BASE_URL: the fake API then steps aside and the same specs exercise
 * the real 409s. See docs/IAM.md.
 */
const MOCK_PORT = Number(process.env.E2E_MOCK_PORT || 5175);
const API_PORT = Number(process.env.E2E_API_PORT || 5176);

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
    use: {
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'mock',
            testMatch: /(permissoes-ui|nao-admin)\.spec\.js/,
            use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${MOCK_PORT}` },
        },
        {
            name: 'acessos',
            testMatch: /(acessos-.*|anti-lockout)\.spec\.js/,
            use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${API_PORT}` },
        },
        {
            // O board, o upload e o download do zip. Também com a API falsa e não
            // com os fixtures locais: o deck só existe no servidor, e o download
            // inteiro do deck (Bearer, Content-Disposition, os bytes do zip) não
            // tem nada equivalente em modo mock — lá o botão nem aparece.
            name: 'decks',
            testMatch: /decks-.*\.spec\.js/,
            use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${API_PORT}` },
        },
    ],
    webServer: [
        {
            command: `npm run dev -- --port ${MOCK_PORT} --strictPort`,
            url: `http://localhost:${MOCK_PORT}`,
            reuseExistingServer: !process.env.CI,
            env: { VITE_ENABLE_MOCK: 'true' },
            timeout: 60_000,
        },
        {
            command: `npm run dev -- --port ${API_PORT} --strictPort`,
            url: `http://localhost:${API_PORT}`,
            reuseExistingServer: !process.env.CI,
            env: { VITE_ENABLE_MOCK: 'false' },
            timeout: 60_000,
        },
    ],
});

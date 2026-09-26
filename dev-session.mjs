// Abre um Chromium já autenticado como admin contra a API local (sem OIDC).
// Descartável: rode com `node dev-session.mjs` e feche a janela quando terminar.
import { chromium } from '@playwright/test';

const PAT = process.env.PAT_ADMIN;
if (!PAT) { console.error('Faltou PAT_ADMIN (source process-manager/.env.local)'); process.exit(1); }

const browser = await chromium.launch({ headless: false, args: ['--window-size=1500,950'] });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message));

await page.goto('http://127.0.0.1:5173/login');
await page.evaluate((pat) => {
    sessionStorage.setItem('sato_token', pat);
    localStorage.setItem('arquivoseg_authenticated', 'true');
    localStorage.setItem('arquivoseg_current_user', JSON.stringify({
        id: 'admin-local', email: 'admin@local.dev', name: 'Admin Local',
        isAdmin: true, role: 'ADMIN',
    }));
}, PAT);
await page.goto('http://127.0.0.1:5173/admin/acessos/usuarios');
console.log('Sessão aberta em /admin/acessos/usuarios — a janela fica aberta até você fechá-la.');
await page.waitForEvent('close', { timeout: 0 });
await browser.close();

import { test, expect } from '@playwright/test';
import { signIn } from './fixtures/session.js';
import { installSinistroApi } from './fixtures/sinistro-api.js';

/**
 * Armazenamento: o total do tenant no dashboard e, para o admin, cada
 * sinistro do maior para o menor. Sem permissão (403) o bloco some do
 * dashboard em vez de acusar erro.
 */

const ROUBO = '33333333-3333-4333-8333-333333333333';

test('o admin vê o total e os sinistros do maior para o menor, com barra proporcional', async ({ page }) => {
    await signIn(page, 'admin', { token: 'e2e-token' });
    await installSinistroApi(page, (s) => {
        // Fora de ordem de propósito: a tela ordena por conta própria.
        s.storage.processes.reverse();
    });
    await page.goto('/admin');
    await page.getByRole('link', { name: 'Armazenamento' }).click();
    await expect(page).toHaveURL(/\/admin\/armazenamento$/);

    await expect(page.getByTestId('storage-total')).toHaveText('750.0 MB');
    await expect(page.getByTestId('storage-files')).toHaveText('41');

    const rows = page.getByTestId('storage-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Roubo de carga');
    await expect(rows.nth(0)).toContainText('SD - 2026-0102');
    await expect(rows.nth(0).getByTestId('storage-row-bytes')).toHaveText('700.0 MB');
    await expect(rows.nth(0).getByTestId('storage-row-files')).toHaveText('30');
    await expect(rows.nth(1)).toContainText('Incêndio galpão');
    await expect(rows.nth(2).getByTestId('storage-row-bytes')).toHaveText('2.0 KB');

    const widths = await page.getByTestId('storage-row-bar').evaluateAll((els) => els.map((e) => e.style.width));
    expect(widths).toEqual(['100%', '7%', '1%']);

    await rows.nth(0).getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`/admin/sinistros/${ROUBO}$`));
});

test('o dashboard mostra o total e a contagem de arquivos', async ({ page }) => {
    await signIn(page, 'manager', { token: 'e2e-token' });
    const state = await installSinistroApi(page);
    await page.goto('/app');

    const card = page.getByTestId('storage-card');
    await expect(card.getByTestId('storage-total')).toHaveText('750.0 MB');
    await expect(card.getByTestId('storage-files')).toHaveText('em 41 arquivos');
    // O detalhe por sinistro é do admin.
    await expect(card.getByRole('link', { name: /Por sinistro/ })).toHaveCount(0);
    // Um total só, sem somar sinistro por sinistro no navegador.
    expect(state.requests.filter((r) => /\/processes\/[^/]+\/storage/.test(r.path))).toEqual([]);
});

test('sem permissão o card some do dashboard e a página do admin diz por quê', async ({ page }) => {
    await signIn(page, 'admin', { token: 'e2e-token' });
    await installSinistroApi(page, (s) => { s.failStorage = { status: 403, code: 'INSUFFICIENT_PERMISSION', message: 'insufficient permission' }; });

    await page.goto('/app');
    await expect(page.getByText('Timeline de Atualizações')).toBeVisible();
    await expect(page.getByTestId('storage-card')).toHaveCount(0);

    await page.goto('/admin/armazenamento');
    await expect(page.getByTestId('storage-forbidden')).toContainText('Você não tem permissão para ver o uso de armazenamento.');
    await expect(page.getByTestId('storage-row')).toHaveCount(0);
});

test('erro do servidor no card oferece tentar de novo', async ({ page }) => {
    await signIn(page, 'manager', { token: 'e2e-token' });
    const state = await installSinistroApi(page, (s) => { s.failStorage = { status: 500, code: 'INTERNAL_ERROR', message: 'banco fora' }; });
    await page.goto('/app');

    const card = page.getByTestId('storage-card');
    await expect(card.getByRole('alert')).toContainText('Não foi possível carregar o armazenamento.');
    state.failStorage = null;
    await card.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(card.getByTestId('storage-total')).toHaveText('750.0 MB');
});

test('em 360px a página do admin não vaza para o lado', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await signIn(page, 'admin', { token: 'e2e-token' });
    await installSinistroApi(page);
    await page.goto('/admin/armazenamento');
    await expect(page.getByTestId('storage-row')).toHaveCount(3);
    await expect(page.getByTestId('storage-row').first()).toContainText('30 arquivos');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});

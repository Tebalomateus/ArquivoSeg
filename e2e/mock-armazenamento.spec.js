import { test, expect } from '@playwright/test';
import { signIn } from './fixtures/session.js';

/**
 * Armazenamento no modo demonstração: sem servidor, o uso vem do mock e
 * nada sai para /storage. Com E2E_SHOTS_DIR definido, guarda as capturas do
 * dashboard e da página do admin em 1440px e 360px.
 */

for (const width of [1440, 360]) {
    test(`dashboard e página do admin mostram o uso da demo (${width}px)`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const calls = [];
        page.on('request', (r) => { if (/\/api\/v1\/(storage|processes\/[^/]+\/storage)/.test(r.url())) calls.push(r.url()); });
        await signIn(page, 'admin');
        const shots = process.env.E2E_SHOTS_DIR;

        await page.goto('/app');
        const card = page.getByTestId('storage-card');
        await expect(card.getByTestId('storage-total')).toHaveText(/\d+(\.\d)? MB/);
        await expect(card.getByTestId('storage-files')).toHaveText(/em \d+ arquivos/);
        if (shots) {
            await card.scrollIntoViewIfNeeded();
            await page.screenshot({ path: `${shots}/c-dashboard-${width}.png`, fullPage: true, animations: 'disabled' });
        }

        await page.goto('/admin/armazenamento');
        await expect(page.getByTestId('storage-row')).toHaveCount(1);
        await expect(page.getByTestId('storage-row')).toContainText('Incêndio Depósito Norte');
        await expect(page.getByTestId('storage-row-bar')).toHaveAttribute('style', /width: 100%/);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        if (shots) await page.screenshot({ path: `${shots}/c-armazenamento-${width}.png`, fullPage: true, animations: 'disabled' });

        expect(calls).toEqual([]);
    });
}

import { test, expect } from '@playwright/test';
import { signIn } from './fixtures/session.js';

/**
 * O álbum no modo demonstração, com o sinistro de exemplo. Com E2E_SHOTS_DIR
 * definido, guarda as capturas em 1440px e 360px.
 */

for (const width of [1440, 360]) {
    test(`o álbum mostra o sinistro de demonstração em cartão (${width}px)`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await signIn(page, 'manager');
        await page.goto('/app/sinistros');

        const card = page.getByTestId('album-card').first();
        await expect(card).toContainText('SD - 2024-001');
        await expect(card).toContainText('Incêndio Depósito Norte');
        await expect(card).toContainText('Porto Seguro');
        await expect(card.getByTestId('album-progress')).toHaveText('72%');
        await expect(card.getByTestId('album-prazo')).toHaveText('18 dias');

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);

        if (process.env.E2E_SHOTS_DIR) {
            await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/c-album-${width}.png`, fullPage: true, animations: 'disabled' });
        }
    });
}

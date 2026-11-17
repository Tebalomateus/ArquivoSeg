import { test, expect } from '@playwright/test';
import { signIn } from './fixtures/session.js';
import { mountComponent } from './fixtures/mount.js';

/**
 * A trilha de auditoria no modo demonstração: sem servidor, ela precisa ter
 * uma história para mostrar — quatro pessoas e um acesso externo — e não pode
 * sair do mock para a rede.
 *
 * Com E2E_SHOTS_DIR definido, guarda as capturas em 1440px e 360px.
 */

for (const width of [1440, 360]) {
    test(`a história de demonstração tem quatro pessoas e o acesso externo (${width}px)`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const apiCalls = [];
        // A trilha não pode sair do mock; outras partes da tela não são assunto daqui.
        page.on('request', (r) => { if (/\/api\/v1\/processes\/[^/]+\/audit/.test(r.url())) apiCalls.push(r.url()); });

        await signIn(page, 'manager');
        await mountComponent(page, 'ClaimAuditTrail', { processId: '1' });

        await expect(page.getByTestId('audit-graph')).toBeVisible();
        await expect(page.getByTestId('audit-graph')).toHaveAttribute('data-lanes', '5');
        await expect(page.getByTestId('audit-legend').locator('li')).toHaveCount(5);
        await expect(page.getByTestId('audit-event').first()).toContainText('Dados do sinistro atualizados');
        await expect(page.getByTestId('audit-event').filter({ hasText: 'Prazo ajustado' })).toContainText('Segurado pediu prorrogação');
        expect(apiCalls).toEqual([]);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);

        if (process.env.E2E_SHOTS_DIR) {
            await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/c-auditoria-${width}.png`, fullPage: true, animations: 'disabled' });
        }
    });
}

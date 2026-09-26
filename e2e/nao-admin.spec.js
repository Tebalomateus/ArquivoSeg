import { test, expect } from '@playwright/test';
import { signIn } from './fixtures/session.js';

/**
 * /admin/acessos é gateado no isAdmin do Zitadel, e não numa permissão do
 * próprio IAM: é a tela que conserta uma configuração quebrada, então depender
 * do dado que ela edita é como um tenant se tranca fora de si mesmo.
 *
 * O teste, então, é dos dois lados: quem não é admin não vê o caminho, e forçar
 * a URL não é caminho.
 */

for (const persona of ['viewer', 'contributor', 'manager']) {
    test(`${persona} não alcança a área administrativa`, async ({ page }) => {
        await signIn(page, persona);

        await page.goto('/admin/acessos/papeis');
        await expect(page).toHaveURL(/\/app$/);

        await page.goto('/admin');
        await expect(page).toHaveURL(/\/app$/);

        await expect(page.getByRole('link', { name: 'Acessos' })).toHaveCount(0);
    });
}

test('a raiz manda o admin para o painel administrativo', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/');
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('link', { name: 'Acessos' })).toBeVisible();
});
